from __future__ import annotations

import argparse
import logging
import os
from datetime import date
from pathlib import Path

from .config import load_sources
from .dedup import run as run_dedup
from .fetch import fetch_all
from .rank import DEFAULT_MODEL as DEFAULT_RANK_MODEL, run as run_rank
from .render import run as run_render
from .summarize import DEFAULT_MODEL as DEFAULT_SUM_MODEL, run as run_summarize

ROOT = Path(__file__).resolve().parent.parent


def _load_env_file() -> None:
    """读 experiments/Dong/.env 注入 os.environ；shell 已设的优先，不被覆盖。
    空值跳过——避免把 `KEY=` 这种模板行覆盖成空字符串（比未设置还糟）。
    """
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


def cmd_fetch(args: argparse.Namespace) -> None:
    sources = load_sources(ROOT / "config" / "sources.yaml")
    day = args.date or date.today().isoformat()
    out = fetch_all(sources, ROOT / "data" / day)
    print(out)


def cmd_dedup(args: argparse.Namespace) -> None:
    day = args.date or date.today().isoformat()
    day_dir = ROOT / "data" / day
    in_path = day_dir / "raw.json"
    out_path = day_dir / "deduped.json"
    run_dedup(in_path, out_path, args.window_days, args.fuzzy_threshold)
    print(out_path)


def cmd_rank(args: argparse.Namespace) -> None:
    day = args.date or date.today().isoformat()
    day_dir = ROOT / "data" / day
    in_path = day_dir / "deduped.json"
    out_path = day_dir / "ranked.json"
    run_rank(in_path, out_path, args.model, args.dry_run)
    print(out_path)


def cmd_summarize(args: argparse.Namespace) -> None:
    day = args.date or date.today().isoformat()
    day_dir = ROOT / "data" / day
    in_path = day_dir / "ranked.json"
    out_path = day_dir / "summaries.json"
    run_summarize(in_path, out_path, args.model, args.dry_run, args.min_score)
    print(out_path)


def cmd_render(args: argparse.Namespace) -> None:
    day = args.date or date.today().isoformat()
    day_dir = ROOT / "data" / day
    sources = load_sources(ROOT / "config" / "sources.yaml")
    out_path = ROOT / "briefs" / f"{day}.md"
    run_render(
        summaries_path=day_dir / "summaries.json",
        raw_path=day_dir / "raw.json",
        sources_count=len(sources),
        out_path=out_path,
        date=day,
    )
    print(out_path)


def main() -> None:
    _load_env_file()
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )

    p = argparse.ArgumentParser(prog="deep-dive")
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="拉所有信息源到 data/<date>/raw.json")
    f.add_argument("--date", help="日期（YYYY-MM-DD），默认今天")
    f.set_defaults(func=cmd_fetch)

    d = sub.add_parser(
        "dedup",
        help="raw.json → deduped.json（日期窗口 + URL 规范化 + 标题 fuzzy 去重）",
    )
    d.add_argument("--date", help="日期（YYYY-MM-DD），默认今天")
    d.add_argument(
        "--window-days",
        type=int,
        default=3,
        help="只保留最近 N 天的条目（默认 3，0 表示不过滤）",
    )
    d.add_argument(
        "--fuzzy-threshold",
        type=int,
        default=85,
        help="标题 fuzzy 去重阈值（0-100，默认 85）",
    )
    d.set_defaults(func=cmd_dedup)

    r = sub.add_parser(
        "rank",
        help="deduped.json → ranked.json（每条 LLM 1-5 评分 + 一句理由；按分数降序排序）",
    )
    r.add_argument("--date", help="日期（YYYY-MM-DD），默认今天")
    r.add_argument("--model", default=DEFAULT_RANK_MODEL, help=f"模型（默认 {DEFAULT_RANK_MODEL}）")
    r.add_argument(
        "--dry-run",
        action="store_true",
        help="跳过 LLM 调用，使用关键词 mock 评分（不需要 ANTHROPIC_API_KEY）",
    )
    r.set_defaults(func=cmd_rank)

    s = sub.add_parser(
        "summarize",
        help="ranked.json → summaries.json（对 score>=N 的条目生成中文 short+long 摘要）",
    )
    s.add_argument("--date", help="日期（YYYY-MM-DD），默认今天")
    s.add_argument("--model", default=DEFAULT_SUM_MODEL, help=f"模型（默认 {DEFAULT_SUM_MODEL}）")
    s.add_argument(
        "--min-score",
        type=int,
        default=3,
        help="最低入选分数（默认 3，只对 score>=3 的生成摘要）",
    )
    s.add_argument(
        "--dry-run",
        action="store_true",
        help="跳过 LLM 调用，使用截断式 mock 摘要（不需要 ANTHROPIC_API_KEY）",
    )
    s.set_defaults(func=cmd_summarize)

    rd = sub.add_parser(
        "render",
        help="summaries.json → briefs/<date>.md（套输出契约模板，不调 LLM）",
    )
    rd.add_argument("--date", help="日期（YYYY-MM-DD），默认今天")
    rd.set_defaults(func=cmd_render)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
