from __future__ import annotations

import argparse
import logging
from datetime import date
from pathlib import Path

from .config import load_sources
from .dedup import run as run_dedup
from .fetch import fetch_all
from .rank import DEFAULT_MODEL as DEFAULT_RANK_MODEL, run as run_rank

ROOT = Path(__file__).resolve().parent.parent


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


def main() -> None:
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

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
