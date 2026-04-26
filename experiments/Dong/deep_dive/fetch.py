from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import feedparser
import httpx

from .config import Source

log = logging.getLogger(__name__)

USER_AGENT = "DeepDive/0.0.1 (Dong's MVP; +https://github.com/...)"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)


@dataclass
class Item:
    source: str
    title: str
    url: str
    published: str | None
    published_iso: str | None
    summary: str


def _parse_date(s: str | None) -> str | None:
    """Parse RFC 822 / ISO 8601 date string → UTC ISO 8601, or None."""
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _fetch_one(source: Source, client: httpx.Client) -> list[Item]:
    try:
        resp = client.get(
            source.url,
            headers={"User-Agent": USER_AGENT},
            timeout=TIMEOUT,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        log.warning("fetch failed for %s (%s): %s", source.name, source.url, e)
        return []

    feed = feedparser.parse(resp.content)
    items: list[Item] = []
    for entry in feed.entries:
        url = (entry.get("link") or "").strip()
        title = (entry.get("title") or "").strip()
        if not url or not title:
            continue
        published = entry.get("published") or entry.get("updated")
        items.append(
            Item(
                source=source.name,
                title=title,
                url=url,
                published=published,
                published_iso=_parse_date(published),
                summary=(entry.get("summary") or "").strip(),
            )
        )
    return items


def fetch_all(sources: list[Source], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    all_items: list[Item] = []

    with httpx.Client() as client:
        for s in sources:
            items = _fetch_one(s, client)
            log.info("fetched %d items from %s", len(items), s.name)
            all_items.extend(items)

    out_path = out_dir / "raw.json"
    out_path.write_text(
        json.dumps([asdict(i) for i in all_items], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log.info("wrote %d items → %s", len(all_items), out_path)
    return out_path
