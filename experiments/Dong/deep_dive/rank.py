from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from .fetch import Item
from .llm import get_client

log = logging.getLogger(__name__)

SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "rank_system.md"

_JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*\n?|\n?```\s*$", re.MULTILINE)
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> dict:
    text = text.strip()
    text = _JSON_FENCE_RE.sub("", text).strip()
    if not text.startswith("{"):
        m = _JSON_OBJECT_RE.search(text)
        if m:
            text = m.group(0)
    return json.loads(text)


@dataclass
class RankedItem:
    source: str
    title: str
    url: str
    published: str | None
    published_iso: str | None
    summary: str
    score: int
    reason: str


def _format_user_prompt(item: Item) -> str:
    today = datetime.now(timezone.utc).date().isoformat()
    return (
        f"今日日期（UTC）：{today}\n\n"
        f"待评分条目（仅一条）：\n\n"
        f"- 来源：{item.source}\n"
        f"- 发布时间：{item.published_iso or item.published or '未知'}\n"
        f"- 标题：{item.title}\n"
        f"- URL：{item.url}\n"
        f"- 摘要（来自源 RSS）：{item.summary[:600] if item.summary else '（无）'}\n\n"
        f"按系统提示中的标准评分。直接返回 JSON，不要任何前后文字、不要代码块标记、不要调用任何工具，schema：\n"
        f'{{"score": <1-5 整数>, "reason": "<中文一句话，≤50 字>"}}'
    )


def _score_item_real(client, item: Item, system_prompt: str, retries: int = 1) -> tuple[int, str, dict]:
    last_err: Exception | None = None
    last_text: str = ""
    for attempt in range(retries + 1):
        result = client.complete(
            system=system_prompt,
            user=_format_user_prompt(item),
            max_tokens=256,
        )
        usage = {
            "input_tokens": result.input_tokens,
            "cache_read_input_tokens": result.cache_read_tokens,
            "cache_creation_input_tokens": result.cache_creation_tokens,
            "output_tokens": result.output_tokens,
        }
        last_text = result.text
        try:
            data = _extract_json(result.text)
            return int(data["score"]), str(data["reason"]), usage
        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
            last_err = e
            log.warning("[尝试 %d/%d] JSON 解析失败 (%s)，原文: %s", attempt + 1, retries + 1, e, result.text[:200])
    raise RuntimeError(f"rank 解析失败（{retries + 1} 次尝试）。最后原文: {last_text!r}") from last_err


_MOCK_HIGH_KEYWORDS = (
    "gpt-5", "gpt-6", "claude", "anthropic", "codex", "deepseek", "agent", "coding", "mcp", "tool use",
)


def _score_item_mock(item: Item) -> tuple[int, str]:
    title_lower = item.title.lower()
    if any(kw in title_lower for kw in _MOCK_HIGH_KEYWORDS):
        return 4, "[mock] 标题命中 agentic 关键词，--dry-run 占位"
    if item.source in ("openai", "deepmind"):
        return 3, "[mock] 官方源但标题无强信号，--dry-run 占位"
    return 2, "[mock] 默认低分，--dry-run 占位"


def _load_deduped(path: Path) -> list[Item]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Item(**d) for d in data]


def _write_ranked(items: list[RankedItem], path: Path) -> None:
    path.write_text(
        json.dumps([asdict(i) for i in items], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run(in_path: Path, out_path: Path, dry_run: bool, backend: str | None = None) -> None:
    items = _load_deduped(in_path)
    log.info("loaded %d deduped items", len(items))

    ranked: list[RankedItem] = []

    if dry_run:
        log.warning("--dry-run 模式：跳过 LLM 调用，使用 mock 评分（供下游联调）")
        for it in items:
            score, reason = _score_item_mock(it)
            ranked.append(RankedItem(**asdict(it), score=score, reason=reason))
    else:
        client = get_client(backend=backend)
        log.info("LLM backend: %s, model: %s", client.name, getattr(client, "model", "?"))

        system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
        totals = {"input": 0, "cache_read": 0, "cache_create": 0, "output": 0}
        for i, it in enumerate(items, 1):
            score, reason, usage = _score_item_real(client, it, system_prompt)
            ranked.append(RankedItem(**asdict(it), score=score, reason=reason))
            totals["input"] += usage["input_tokens"]
            totals["cache_read"] += usage["cache_read_input_tokens"]
            totals["cache_create"] += usage["cache_creation_input_tokens"]
            totals["output"] += usage["output_tokens"]
            log.info(
                "[%d/%d] score=%d  cache_read=%d  input=%d  output=%d  | %s",
                i, len(items), score,
                usage["cache_read_input_tokens"], usage["input_tokens"], usage["output_tokens"],
                it.title[:60],
            )
        log.info(
            "totals: input=%d  cache_read=%d  cache_create=%d  output=%d",
            totals["input"], totals["cache_read"], totals["cache_create"], totals["output"],
        )

    ranked.sort(key=lambda r: (-r.score, r.published_iso or ""))
    _write_ranked(ranked, out_path)
    log.info("wrote %d ranked items → %s", len(ranked), out_path)
