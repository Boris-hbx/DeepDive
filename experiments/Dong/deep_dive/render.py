from __future__ import annotations

import json
import logging
from pathlib import Path

log = logging.getLogger(__name__)

# brief 输出契约（来自 spec/mvp.md）
TOP_LIMIT = 3        # 「最关注的事」最多几条
WORTH_LOOK_LIMIT = 5 # 「值得一看的事」最多几条
TOP_THRESHOLD = 4    # score >= TOP_THRESHOLD 的进「最关注」候选池


def _section_top(items: list[dict]) -> str:
    if not items:
        return ""
    lines = ["## 最关注的事", ""]
    for i, it in enumerate(items, 1):
        lines.append(f"### {i}. {it['title']}")
        lines.append("")
        lines.append(it["long"])
        lines.append("")
        lines.append(f"来源：[{it['title']}]({it['url']})")
        lines.append("")
        # 折叠的"延伸思考"块——5 分钟扫的人看不到，深读时点开。
        # 仅当至少有 key_points 或 implications 时输出。
        kp = it.get("key_points") or []
        im = it.get("implications") or []
        if kp or im:
            lines.append("<details>")
            lines.append("<summary>延伸思考</summary>")
            lines.append("")
            if kp:
                lines.append("**关键要点**")
                lines.append("")
                for p in kp:
                    lines.append(f"- {p}")
                lines.append("")
            if im:
                lines.append("**对我们的启示**")
                lines.append("")
                for p in im:
                    lines.append(f"- {p}")
                lines.append("")
            lines.append("</details>")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _section_worth_look(items: list[dict]) -> str:
    if not items:
        return ""
    lines = ["## 值得一看的事", ""]
    for it in items:
        lines.append(f"- {it['short']} — [{it['title']}]({it['url']})")
    lines.append("")
    return "\n".join(lines)


def _build_brief(date: str, summarized: list[dict], n_sources: int, n_scanned: int) -> str:
    top_pool = [s for s in summarized if s["score"] >= TOP_THRESHOLD]
    top = top_pool[:TOP_LIMIT]

    # 「值得一看」池：score == 3 的，再加上 score >= 4 但没进 top 的（避免漏掉）
    worth_look_pool = [s for s in summarized if s["score"] == 3] + top_pool[TOP_LIMIT:]
    worth_look = worth_look_pool[:WORTH_LOOK_LIMIT]

    n_selected = len(top) + len(worth_look)

    if n_selected == 0:
        return _build_fallback(date, n_sources, n_scanned)

    headline_topic = top[0]["title"] if top else worth_look[0]["title"]
    one_liner = f"今天最值得关注的方向是 {headline_topic}。"

    parts = [
        f"# Daily Brief — {date}",
        "",
        f"> 一句话摘要：{one_liner}",
        ">",
        f"> 数据源：{n_sources} 个 / 已扫条目：{n_scanned} / 入选条目：{n_selected}",
        "",
    ]
    if top:
        parts.append(_section_top(top))
    if worth_look:
        parts.append(_section_worth_look(worth_look))
    return "\n".join(parts).rstrip() + "\n"


def _build_fallback(date: str, n_sources: int, n_scanned: int) -> str:
    return (
        f"# Daily Brief — {date}\n"
        f"\n"
        f"> 今日无重要事件。\n"
        f">\n"
        f"> 数据源：{n_sources} 个 / 已扫条目：{n_scanned} / 入选条目：0\n"
        f"\n"
        f"## 说明\n"
        f"\n"
        f"今日扫描的 {n_sources} 个源中，没有达到入选标准的事项。明天再来。\n"
    )


def run(
    summaries_path: Path,
    raw_path: Path,
    sources_count: int,
    out_path: Path,
    date: str,
) -> None:
    summarized = json.loads(summaries_path.read_text(encoding="utf-8")) if summaries_path.exists() else []
    raw = json.loads(raw_path.read_text(encoding="utf-8")) if raw_path.exists() else []

    log.info(
        "rendering: %d summaries, %d raw items, %d sources",
        len(summarized),
        len(raw),
        sources_count,
    )

    brief = _build_brief(date, summarized, sources_count, len(raw))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(brief, encoding="utf-8")
    log.info("wrote brief → %s", out_path)
