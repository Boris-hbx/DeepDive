from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict, dataclass
from pathlib import Path

log = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-sonnet-4-6"
SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "summarize_system.md"

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "short": {
            "type": "string",
            "description": "一句话摘要，中文，≤30 字。给「值得一看的事」用。",
        },
        "long": {
            "type": "string",
            "description": "一段话摘要，中文，60-150 字，2-4 句。给「最关注的事」用。",
        },
    },
    "required": ["short", "long"],
    "additionalProperties": False,
}


@dataclass
class SummarizedItem:
    source: str
    title: str
    url: str
    published: str | None
    published_iso: str | None
    score: int
    reason: str
    short: str
    long: str


def _format_user_prompt(item: dict) -> str:
    summary = (item.get("summary") or "").strip()
    if len(summary) > 1500:
        summary = summary[:1500] + "...(已截断)"
    return (
        f"待摘要条目（仅一条）：\n\n"
        f"- 来源：{item['source']}\n"
        f"- 发布时间：{item.get('published_iso') or item.get('published') or '未知'}\n"
        f"- 标题：{item['title']}\n"
        f"- URL：{item['url']}\n"
        f"- ranker 打分：{item['score']}（理由：{item['reason']}）\n"
        f"- 源摘要（来自 RSS，质量参差）：{summary or '（无）'}\n\n"
        f"按 schema 输出 short + long 两版中文摘要。不要在摘要里放 URL。"
    )


def _summarize_real(client, item: dict, system_prompt: str, model: str) -> tuple[str, str, dict]:
    response = client.messages.create(
        model=model,
        max_tokens=512,
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
    return str(data["short"]), str(data["long"]), usage


def _summarize_mock(item: dict) -> tuple[str, str]:
    """从源摘要 / 标题截字段做占位摘要。"""
    src = (item.get("summary") or "").strip()
    if not src:
        src = item["title"]
    src = src.replace("\n", " ").strip()

    short = (item["title"][:28] + "..") if len(item["title"]) > 30 else item["title"]
    long_text = src[:150] if len(src) >= 60 else (src + "（[mock] 源摘要太短，--dry-run 占位）")
    return short, "[mock] " + long_text


def _load_ranked(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_summaries(items: list[SummarizedItem], path: Path) -> None:
    path.write_text(
        json.dumps([asdict(i) for i in items], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def run(in_path: Path, out_path: Path, model: str, dry_run: bool, min_score: int) -> None:
    ranked = _load_ranked(in_path)
    selected = [r for r in ranked if r["score"] >= min_score]
    log.info(
        "loaded %d ranked items; %d 入选（score >= %d）",
        len(ranked),
        len(selected),
        min_score,
    )

    summarized: list[SummarizedItem] = []

    if dry_run:
        log.warning("--dry-run 模式：跳过 LLM 调用，使用截断式 mock 摘要")
        for it in selected:
            short, long_ = _summarize_mock(it)
            summarized.append(
                SummarizedItem(
                    source=it["source"],
                    title=it["title"],
                    url=it["url"],
                    published=it.get("published"),
                    published_iso=it.get("published_iso"),
                    score=it["score"],
                    reason=it["reason"],
                    short=short,
                    long=long_,
                )
            )
    else:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise SystemExit(
                "ANTHROPIC_API_KEY 未设置。请 export ANTHROPIC_API_KEY=... 后重试，"
                "或加 --dry-run 跑占位摘要。"
            )
        from anthropic import Anthropic

        system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
        client = Anthropic()

        totals = {"input": 0, "cache_read": 0, "cache_create": 0, "output": 0}
        for i, it in enumerate(selected, 1):
            short, long_, usage = _summarize_real(client, it, system_prompt, model)
            summarized.append(
                SummarizedItem(
                    source=it["source"],
                    title=it["title"],
                    url=it["url"],
                    published=it.get("published"),
                    published_iso=it.get("published_iso"),
                    score=it["score"],
                    reason=it["reason"],
                    short=short,
                    long=long_,
                )
            )
            totals["input"] += usage["input_tokens"]
            totals["cache_read"] += usage["cache_read_input_tokens"]
            totals["cache_create"] += usage["cache_creation_input_tokens"]
            totals["output"] += usage["output_tokens"]
            log.info(
                "[%d/%d] cache_read=%d  output=%d  | %s",
                i,
                len(selected),
                usage["cache_read_input_tokens"],
                usage["output_tokens"],
                it["title"][:60],
            )
        log.info(
            "totals: input=%d  cache_read=%d  cache_create=%d  output=%d",
            totals["input"],
            totals["cache_read"],
            totals["cache_create"],
            totals["output"],
        )

    _write_summaries(summarized, out_path)
    log.info("wrote %d summaries → %s", len(summarized), out_path)
