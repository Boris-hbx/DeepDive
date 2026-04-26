from __future__ import annotations

import json
import logging
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from rapidfuzz import fuzz

from .fetch import Item

log = logging.getLogger(__name__)

# 一些常见的 tracking / 推荐参数；命中即丢弃
TRACKING_KEYS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "ref",
        "ref_src",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
    }
)


def canonicalize_url(url: str) -> str:
    """规范化 URL：小写 host、去 fragment、去 tracking 参数、去末尾斜杠。"""
    p = urlparse(url.strip())
    netloc = p.netloc.lower()
    qs = [(k, v) for (k, v) in parse_qsl(p.query, keep_blank_values=True) if k.lower() not in TRACKING_KEYS]
    query = urlencode(qs)
    path = p.path.rstrip("/") or "/"
    return urlunparse((p.scheme.lower(), netloc, path, "", query, ""))


def filter_by_date(items: list[Item], window_days: int) -> tuple[list[Item], int]:
    """保留 published_iso 在最近 window_days 天内的条目。无日期的条目保留（保守）。"""
    if window_days <= 0:
        return items, 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    kept: list[Item] = []
    no_date = 0
    for it in items:
        if not it.published_iso:
            no_date += 1
            kept.append(it)
            continue
        try:
            ts = datetime.fromisoformat(it.published_iso)
        except ValueError:
            kept.append(it)
            continue
        if ts >= cutoff:
            kept.append(it)
    return kept, no_date


def dedup_by_url(items: list[Item]) -> list[Item]:
    seen: set[str] = set()
    out: list[Item] = []
    for it in items:
        canon = canonicalize_url(it.url)
        if canon in seen:
            continue
        seen.add(canon)
        out.append(it)
    return out


def dedup_by_title(items: list[Item], threshold: int = 85) -> tuple[list[Item], list[tuple[Item, Item]]]:
    """标题 fuzzy 去重，保留第一次出现（sources.yaml 里靠前的官方源优先）。
    返回 (去重后列表, 被并掉的对子) — 并掉的对子用于日志和审计。
    """
    out: list[Item] = []
    merged: list[tuple[Item, Item]] = []
    for it in items:
        dup_of: Item | None = None
        for kept in out:
            if fuzz.token_set_ratio(it.title, kept.title) >= threshold:
                dup_of = kept
                break
        if dup_of:
            merged.append((it, dup_of))
        else:
            out.append(it)
    return out, merged


def _load_raw(path: Path) -> list[Item]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Item(**d) for d in data]


def _write_items(items: list[Item], path: Path) -> None:
    path.write_text(
        json.dumps([asdict(i) for i in items], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run(in_path: Path, out_path: Path, window_days: int, fuzzy_threshold: int = 85) -> None:
    raw = _load_raw(in_path)
    log.info("loaded %d raw items", len(raw))

    after_date, no_date = filter_by_date(raw, window_days)
    log.info(
        "after date filter (window=%d days): %d items (含 %d 条无日期，已保留)",
        window_days,
        len(after_date),
        no_date,
    )

    after_url = dedup_by_url(after_date)
    log.info("after URL canonicalize+dedup: %d items (并掉 %d)", len(after_url), len(after_date) - len(after_url))

    after_title, merged = dedup_by_title(after_url, fuzzy_threshold)
    log.info("after title fuzzy dedup (threshold=%d): %d items (并掉 %d)", fuzzy_threshold, len(after_title), len(merged))
    for dup, kept in merged[:10]:
        log.info("  并：[%s] %r → 保留 [%s] %r", dup.source, dup.title, kept.source, kept.title)
    if len(merged) > 10:
        log.info("  ... 还有 %d 对未列出", len(merged) - 10)

    _write_items(after_title, out_path)
    log.info("wrote %d items → %s", len(after_title), out_path)
