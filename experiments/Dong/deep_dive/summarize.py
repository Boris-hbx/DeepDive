from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from .llm import get_client

log = logging.getLogger(__name__)

SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "summarize_system.md"

_THINKING_RE = re.compile(r"<thinking>.*?</thinking>", re.DOTALL | re.IGNORECASE)
_JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*\n?|\n?```\s*$", re.MULTILINE)
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)
# Fallback：模型在中文里经常用未转义双引号做强调（"模型卡死"）破坏 JSON。
# 用这两个 regex 直接抓字段值——这个版本只关注 short / long 两个 key。
_SHORT_RE = re.compile(r'"short"\s*:\s*"(.*?)"\s*,\s*"long"', re.DOTALL)
_LONG_RE = re.compile(r'"long"\s*:\s*"(.*)"\s*}', re.DOTALL)


def _extract_json(text: str) -> dict:
    # 同 rank.py：先剥 <thinking>，再剥 ``` 围栏，再找 JSON
    text = _THINKING_RE.sub("", text).strip()
    text = _JSON_FENCE_RE.sub("", text).strip()
    if not text.startswith("{"):
        m = _JSON_OBJECT_RE.search(text)
        if m:
            text = m.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback：直接 regex 抠 short/long。仅对 summarize 的 schema 有效。
        s_m = _SHORT_RE.search(text)
        l_m = _LONG_RE.search(text)
        if s_m and l_m:
            return {"short": s_m.group(1), "long": l_m.group(1)}
        raise


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
    today = datetime.now(timezone.utc).date().isoformat()
    return (
        f"今日日期（UTC）：{today}\n\n"
        f"待摘要条目（仅一条）：\n\n"
        f"- 来源：{item['source']}\n"
        f"- 发布时间：{item.get('published_iso') or item.get('published') or '未知'}\n"
        f"- 标题：{item['title']}\n"
        f"- URL：{item['url']}\n"
        f"- ranker 打分：{item['score']}（理由：{item['reason']}）\n"
        f"- 源摘要（来自 RSS，质量参差）：{summary or '（无）'}\n\n"
        f"输出两版中文摘要。直接返回 JSON，不要任何前后文字、不要代码块标记、不要调用任何工具，schema：\n"
        f'{{"short": "<≤30 字一句话>", "long": "<60-150 字一段话，2-4 句>"}}\n'
        f"不要在 short 或 long 里放 URL。"
    )


def _summarize_real(client, item: dict, system_prompt: str, retries: int = 1) -> tuple[str, str, dict]:
    last_err: Exception | None = None
    last_text: str = ""
    for attempt in range(retries + 1):
        result = client.complete(
            system=system_prompt,
            user=_format_user_prompt(item),
            # 同 rank.py：留 thinking 预算
            max_tokens=2048,
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
            return str(data["short"]), str(data["long"]), usage
        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
            last_err = e
            log.warning("[尝试 %d/%d] JSON 解析失败 (%s)，原文: %s", attempt + 1, retries + 1, e, result.text[:200])
    raise RuntimeError(f"summarize 解析失败（{retries + 1} 次尝试）。最后原文: {last_text!r}") from last_err


def _summarize_mock(item: dict) -> tuple[str, str]:
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


def run(in_path: Path, out_path: Path, dry_run: bool, min_score: int, backend: str | None = None) -> None:
    ranked = _load_ranked(in_path)
    selected = [r for r in ranked if r["score"] >= min_score]
    log.info("loaded %d ranked items; %d 入选（score >= %d）", len(ranked), len(selected), min_score)

    summarized: list[SummarizedItem] = []

    if dry_run:
        log.warning("--dry-run 模式：跳过 LLM 调用，使用截断式 mock 摘要")
        for it in selected:
            short, long_ = _summarize_mock(it)
            summarized.append(SummarizedItem(
                source=it["source"], title=it["title"], url=it["url"],
                published=it.get("published"), published_iso=it.get("published_iso"),
                score=it["score"], reason=it["reason"],
                short=short, long=long_,
            ))
    else:
        client = get_client(backend=backend)
        log.info("LLM backend: %s, model: %s", client.name, getattr(client, "model", "?"))

        system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
        totals = {"input": 0, "cache_read": 0, "cache_create": 0, "output": 0}
        for i, it in enumerate(selected, 1):
            short, long_, usage = _summarize_real(client, it, system_prompt)
            summarized.append(SummarizedItem(
                source=it["source"], title=it["title"], url=it["url"],
                published=it.get("published"), published_iso=it.get("published_iso"),
                score=it["score"], reason=it["reason"],
                short=short, long=long_,
            ))
            totals["input"] += usage["input_tokens"]
            totals["cache_read"] += usage["cache_read_input_tokens"]
            totals["cache_create"] += usage["cache_creation_input_tokens"]
            totals["output"] += usage["output_tokens"]
            log.info(
                "[%d/%d] cache_read=%d  output=%d  | %s",
                i, len(selected),
                usage["cache_read_input_tokens"], usage["output_tokens"],
                it["title"][:60],
            )
        log.info(
            "totals: input=%d  cache_read=%d  cache_create=%d  output=%d",
            totals["input"], totals["cache_read"], totals["cache_create"], totals["output"],
        )

    _write_summaries(summarized, out_path)
    log.info("wrote %d summaries → %s", len(summarized), out_path)
