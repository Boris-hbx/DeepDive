"""Main pipeline: fetch → filter → summarize → save brief."""

import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.fetcher import fetch_all
from src.summarizer import generate_brief


def main():
    today = date.today().isoformat()
    print(f"[INFO] Generating brief for {today}...")

    print("[INFO] Fetching articles...")
    articles, total_scanned = fetch_all()
    print(f"[INFO] Found {len(articles)} relevant articles out of {total_scanned} total.")

    print("[INFO] Generating brief with Claude...")
    brief_md = generate_brief(articles, today, total_scanned)

    briefs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "briefs")
    os.makedirs(briefs_dir, exist_ok=True)
    output_path = os.path.join(briefs_dir, f"{today}.md")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(brief_md)

    print(f"[INFO] Brief saved to {output_path}")
    return output_path


if __name__ == "__main__":
    main()
