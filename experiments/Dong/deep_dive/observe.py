from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from .llm import get_client

log = logging.getLogger(__name__)

SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "observe_system.md"

_THINKING_RE = re.compile(r"<thinking>.*?</thinking>", re.DOTALL | re.IGNORECASE)
_JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*\n?|\n?```\s*$", re.MULTILINE)
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)

# Brief 输出契约也用过的阈值，保持一致
TOP_THRESHOLD = 4
TOP_LIMIT = 3
WORTH_LOOK_LIMIT = 5


def _extract_json(text: str) -> dict:
    text = _THINKING_RE.sub("", text).strip()
    text = _JSON_FENCE_RE.sub("", text).strip()
    if not text.startswith("{"):
        m = _JSON_OBJECT_RE.search(text)
        if m:
            text = m.group(0)
    return json.loads(text)


@dataclass
class ObservedItem:
    source: str
    title: str
    url: str
    published: str | None
    published_iso: str | None
    score: int
    reason: str
    summary: str
    key_points: list[str] = field(default_factory=list)
    implications: list[str] = field(default_factory=list)


def _format_user_prompt(item: dict) -> str:
    raw_summary = (item.get("summary") or "").strip()
    if len(raw_summary) > 1500:
        raw_summary = raw_summary[:1500] + "...(已截断)"
    today = datetime.now(timezone.utc).date().isoformat()
    return (
        f"今日日期（UTC）：{today}\n\n"
        f"待观察条目（仅一条）：\n\n"
        f"- 来源：{item['source']}\n"
        f"- 发布时间：{item.get('published_iso') or item.get('published') or '未知'}\n"
        f"- 标题：{item['title']}\n"
        f"- URL：{item['url']}\n"
        f"- ranker 打分：{item['score']}（理由：{item['reason']}）\n"
        f"- 源摘要（来自 RSS，质量参差）：{raw_summary or '（无）'}\n\n"
        f"按系统提示输出三段：summary（内容简介）+ key_points（关键要点数组）+ implications（对我们的启示数组）。\n"
        f"直接返回 JSON，不要任何前后文字、不要代码块标记、不要调用任何工具，schema：\n"
        f'{{"summary": "<1-2 句>", "key_points": ["...", "..."], "implications": ["...", "..."]}}\n'
        f"任何字段里都不要放 URL。"
    )


def _observe_real(client, item: dict, system_prompt: str, retries: int = 1) -> tuple[dict, dict]:
    last_err: Exception | None = None
    last_text: str = ""
    for attempt in range(retries + 1):
        result = client.complete(
            system=system_prompt,
            user=_format_user_prompt(item),
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
            return {
                "summary": str(data.get("summary", "")).strip(),
                "key_points": [str(x).strip() for x in (data.get("key_points") or []) if str(x).strip()],
                "implications": [str(x).strip() for x in (data.get("implications") or []) if str(x).strip()],
            }, usage
        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
            last_err = e
            log.warning("[尝试 %d/%d] JSON 解析失败 (%s)，原文: %s", attempt + 1, retries + 1, e, result.text[:200])
    raise RuntimeError(f"observe 解析失败（{retries + 1} 次尝试）。最后原文: {last_text!r}") from last_err


def _observe_mock(item: dict) -> dict:
    title = item["title"]
    src = (item.get("summary") or title).replace("\n", " ").strip()[:120]
    return {
        "summary": f"[mock] {src}",
        "key_points": [
            f"[mock] 关键要点 1：标题命中 score={item['score']}",
            "[mock] 关键要点 2：占位条目，待真 LLM 替换",
        ],
        "implications": [
            "[mock] 启示 1：dry-run 模式产物，不能直接对外",
            "[mock] 启示 2：跑真 LLM 验证后再 commit",
        ],
    }


def _split_top_worth(observed: list[ObservedItem]) -> tuple[list[ObservedItem], list[ObservedItem]]:
    """复用 brief 的分组规则，让 observations 和 brief 条目顺序一致便于交叉阅读。"""
    top_pool = [o for o in observed if o.score >= TOP_THRESHOLD]
    top = top_pool[:TOP_LIMIT]
    worth_pool = [o for o in observed if o.score == 3] + top_pool[TOP_LIMIT:]
    worth = worth_pool[:WORTH_LOOK_LIMIT]
    return top, worth


def _render_section(items: list[ObservedItem], start_index: int) -> str:
    out = []
    for i, it in enumerate(items, start_index):
        out.append(f"### {i}. {it.title}")
        out.append("")
        out.append("**内容简介**")
        out.append("")
        out.append(it.summary or "（无）")
        out.append("")
        if it.key_points:
            out.append("**关键要点**")
            out.append("")
            for kp in it.key_points:
                out.append(f"- {kp}")
            out.append("")
        if it.implications:
            out.append("**对我们的启示**")
            out.append("")
            for im in it.implications:
                out.append(f"- {im}")
            out.append("")
        out.append(f"来源：[{it.title}]({it.url})")
        out.append("")
        out.append("---")
        out.append("")
    return "\n".join(out)


def _render_md(observed: list[ObservedItem], date: str) -> str:
    top, worth = _split_top_worth(observed)
    parts = [
        f"# 今日观察 — {date}",
        "",
        "> 这是 DeepDive brief 的「二次提炼」——在自动化 brief 的「最关注 + 值得一看 + 原文链接」之上，",
        "> 加一层「内容简介 + 关键要点 + 对我们的启示」三段式分析，给 agent 工程从业者使用。",
        ">",
        f"> 关联 brief：[`../briefs/{date}.md`](../briefs/{date}.md)",
        "",
        "---",
        "",
    ]
    if top:
        parts.append("## 最关注的事")
        parts.append("")
        parts.append(_render_section(top, 1))
    if worth:
        parts.append("## 值得一看的事")
        parts.append("")
        parts.append(_render_section(worth, len(top) + 1))
    if not top and not worth:
        parts.append("## 说明")
        parts.append("")
        parts.append("今日没有 score≥3 的入选条目。建议直接读 brief 的兜底文案。")
        parts.append("")
    return "\n".join(parts).rstrip() + "\n"


def _load_ranked(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def run(
    in_path: Path,
    out_md_path: Path,
    dry_run: bool,
    min_score: int,
    backend: str | None = None,
    date_str: str | None = None,
) -> None:
    ranked = _load_ranked(in_path)
    selected = [r for r in ranked if r["score"] >= min_score]
    log.info("loaded %d ranked items; %d 入选（score >= %d）", len(ranked), len(selected), min_score)

    observed: list[ObservedItem] = []

    if dry_run:
        log.warning("--dry-run 模式：跳过 LLM 调用，使用 mock 三段式")
        for it in selected:
            obs = _observe_mock(it)
            observed.append(ObservedItem(
                source=it["source"], title=it["title"], url=it["url"],
                published=it.get("published"), published_iso=it.get("published_iso"),
                score=it["score"], reason=it["reason"],
                **obs,
            ))
    else:
        client = get_client(backend=backend)
        log.info("LLM backend: %s, model: %s", client.name, getattr(client, "model", "?"))
        system_prompt = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

        totals = {"input": 0, "cache_read": 0, "cache_create": 0, "output": 0}
        skipped = 0
        for i, it in enumerate(selected, 1):
            try:
                obs, usage = _observe_real(client, it, system_prompt)
            except Exception as e:
                log.warning("[%d/%d] 跳过 (%s): %s", i, len(selected), type(e).__name__, it["title"][:60])
                skipped += 1
                continue
            observed.append(ObservedItem(
                source=it["source"], title=it["title"], url=it["url"],
                published=it.get("published"), published_iso=it.get("published_iso"),
                score=it["score"], reason=it["reason"],
                **obs,
            ))
            totals["input"] += usage["input_tokens"]
            totals["cache_read"] += usage["cache_read_input_tokens"]
            totals["cache_create"] += usage["cache_creation_input_tokens"]
            totals["output"] += usage["output_tokens"]
            log.info(
                "[%d/%d] cache_read=%d output=%d | %s",
                i, len(selected),
                usage["cache_read_input_tokens"], usage["output_tokens"],
                it["title"][:60],
            )
        log.info(
            "totals: input=%d cache_read=%d cache_create=%d output=%d (skipped %d/%d)",
            totals["input"], totals["cache_read"], totals["cache_create"], totals["output"],
            skipped, len(selected),
        )

    # 输出顺序按 score desc + published_iso asc，与 brief render 一致
    observed.sort(key=lambda o: (-o.score, o.published_iso or ""))

    date = date_str or datetime.now(timezone.utc).date().isoformat()
    out_md_path.parent.mkdir(parents=True, exist_ok=True)
    out_md_path.write_text(_render_md(observed, date), encoding="utf-8")
    log.info("wrote observations → %s", out_md_path)
