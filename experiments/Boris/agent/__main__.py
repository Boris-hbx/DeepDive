#!/usr/bin/env python3
"""
CLI entry point for the self-evolving agent.

Usage:
    python -m agent "your task description"
    python -m agent --help
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Self-evolving agent")
    parser.add_argument("task", nargs="?", help="Task description")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed LLM interaction logs")
    args = parser.parse_args()

    if not args.task:
        parser.print_help()
        return

    # Lazy import to avoid slow startup
    from .loop import AgentLoop, _load_api_key

    # Check API key availability early
    try:
        _load_api_key()
    except ValueError as e:
        print(f"[Error] {e}", file=sys.stderr)
        sys.exit(1)

    loop = AgentLoop(verbose=args.verbose)
    result = loop.run(args.task)

    if result.get("error"):
        print(f"\n[Error] {result['error']}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"\n[Done] {result['summary']}")


if __name__ == "__main__":
    main()