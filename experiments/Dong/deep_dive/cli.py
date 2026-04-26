from __future__ import annotations

import argparse
import logging
from datetime import date
from pathlib import Path

from .config import load_sources
from .fetch import fetch_all

ROOT = Path(__file__).resolve().parent.parent


def cmd_fetch(args: argparse.Namespace) -> None:
    sources = load_sources(ROOT / "config" / "sources.yaml")
    day = args.date or date.today().isoformat()
    out = fetch_all(sources, ROOT / "data" / day)
    print(out)


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

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
