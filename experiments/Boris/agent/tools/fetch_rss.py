#!/usr/bin/env python3
"""
fetch_rss — Fetch and parse items from an RSS feed.

Usage:
    python fetch_rss.py <url> [limit]
"""

import sys
import urllib.request
import xml.etree.ElementTree as ET


def fetch_rss(url: str, limit: int = 10) -> list[dict]:
    with urllib.request.urlopen(url, timeout=15) as r:
        raw = r.read()

    root = ET.fromstring(raw)
    channel = root.find("channel")
    if channel is None:
        print("Error: No <channel> element found in RSS", file=sys.stderr)
        sys.exit(1)

    items = []
    for item in channel.findall("item"):
        if len(items) >= limit:
            break
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        desc = (item.findtext("description") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        if title:
            items.append(
                {
                    "title": title,
                    "link": link,
                    "description": desc[:200] + ("..." if len(desc) > 200 else ""),
                    "pub_date": pub_date,
                }
            )
    return items


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    if not url:
        print("Usage: python fetch_rss.py <url> [limit]", file=sys.stderr)
        sys.exit(1)

    items = fetch_rss(url, limit)
    import json
    print(json.dumps(items, indent=2, ensure_ascii=False))