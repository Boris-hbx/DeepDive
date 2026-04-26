from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict, dataclass
from pathlib import Path

from .fetch import Item

log = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-4-6"
SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "rank_system.md"

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {
            "type": "integer",
            "description": "重要性评分，整数 1-5（5=必看，1=几乎无关）",
        },
        "reason": {
            "type": "string",
            "description": "中文一句话理由，<= 50 字，具体说明为什么是这个分",
        },
    },
    "required": ["score", "reason"],
    "additionalProperties": False,
}


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
    return (
        f"待评分条目（仅一条）：\n\n"
        f"- 来源：{item.source}\n"
        f"- 发布时间：{item.published_iso or item.published or '未知'}\n"
        f"- 标题：{item.title}\n"
        f"- URL：{item.url}\n"
        f"- 摘要（来自源 RSS）：{item.summary[:600] if item.summary else '（无）'}\n\n"
        f"请按系统提示中的标准给出 1-5 整数评分和一句中文理由，输出符合 schema 的 JSON。"
    )


def _score_item_real(client, item: Item, system_prompt: str, model: str) -> tuple[int, str, dict]:
    response = client.messages.create(
        model=model,
        max_tokens=256,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": _format_user_prompt(item)}],
        output_config={"format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
    )
    text = next(b.text for b in response.content if b.type == "text")
    data = json.loads(text)
    usage = {
        "input_tokens": response.usage.input_tokens,
        "cache_read_input_tokens": getattr(response.usage, "cache_read_input_tokens", 0) or 0,
        "cache_creation_input_tokens": getattr(response.usage, "cache_creation_input_tokens", 0) or 0,
        "output_tokens": response.usage.output_tokens,
    }
    return int(data["score"]), str(data["reason"]), usage


_MOCK_HIGH_KEYWORDS = (
    "gpt-5",
    "gpt-6",
    "claude",
    "anthropic",
    "codex",
    "deepseek",
    "agent",
    "coding",
    "mcp",
    "tool use",
)


def _score_item_mock(item: Item) -> tuple[int, str]:
    """Deterministic placeholder scoring for --dry-run."""
    title_lower = item.title.lower()
    if any(kw in title_lower for kw in _MOCK_HIGH_KEYWORDS):
        score = 4
        reason = "[mock] 标题命中 agentic 关键词，--dry-run 占位"
    elif item.source in ("openai", "deepmind"):
        score = 3
        reason = "[mock] 官方源但标题无强信号，--dry-run 占位"
    else:
        score = 2
        reason = "[mock] 默认低分，--dry-run 占位"
    return score, reason


def _load_deduped(path: Path) -> list[Item]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Item(**d) for d in data]


def _write_ranked(items: list[RankedItem], path: Path) -> None:
    path.write_text(
        json.dumps([asdict(i) for i in items], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run(in_path: Path, out_path: Path, model: str, dry_run: bool) -> None:
    items = _load_deduped(in_path)
    log.info("loaded %d deduped items", len(items))

    ranked: list[RankedItem] = []

    if dry_run:
        log.warning("--dry-run 模式：跳过 LLM 调用，使用 mock 评分（供下游联调）")
        for it in items:
            score, reason = _score_item_mock(it)
            ranked.append(RankedItem(**asdict(it), score=score, reason=reason))
    else:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise SystemExit(
                "ANTHROPIC_API_KEY 未设置。请 export ANTHROPIC_API_KEY=... 后重试，"
                "或加 --dry-run 跑占位评分。"
            )
        from anthropic import Anthropic

        system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
        client = Anthropic()

        totals = {"input": 0, "cache_read": 0, "cache_create": 0, "output": 0}
        for i, it in enumerate(items, 1):
            score, reason, usage = _score_item_real(client, it, system_prompt, model)
            ranked.append(RankedItem(**asdict(it), score=score, reason=reason))
            totals["input"] += usage["input_tokens"]
            totals["cache_read"] += usage["cache_read_input_tokens"]
            totals["cache_create"] += usage["cache_creation_input_tokens"]
            totals["output"] += usage["output_tokens"]
            log.info(
                "[%d/%d] score=%d  cache_read=%d  input=%d  output=%d  | %s",
                i,
                len(items),
                score,
                usage["cache_read_input_tokens"],
                usage["input_tokens"],
                usage["output_tokens"],
                it.title[:60],
            )
        log.info(
            "totals: input=%d  cache_read=%d  cache_create=%d  output=%d",
            totals["input"],
            totals["cache_read"],
            totals["cache_create"],
            totals["output"],
        )

    ranked.sort(key=lambda r: (-r.score, r.published_iso or ""))
    _write_ranked(ranked, out_path)
    log.info("wrote %d ranked items → %s", len(ranked), out_path)
