"""Fetch articles from configured sources."""

import requests
import feedparser
from datetime import datetime, timedelta
from .config import SOURCES, TOPIC_KEYWORDS, PRIORITY_SOURCES, PRIORITY_KEYWORDS


def fetch_hn_stories(source):
    """Fetch top stories from Hacker News API, filtered by topic relevance."""
    resp = requests.get(source["url"], timeout=15)
    resp.raise_for_status()
    story_ids = resp.json()[: source.get("max_items", 30)]

    articles = []
    for sid in story_ids:
        item_url = f"https://hacker-news.firebaseio.com/v0/item/{sid}.json"
        item = requests.get(item_url, timeout=10).json()
        if not item or item.get("type") != "story":
            continue
        title = item.get("title", "")
        url = item.get("url", f"https://news.ycombinator.com/item?id={sid}")
        articles.append({"title": title, "url": url, "source": source["name"]})
    return articles


def fetch_rss(source):
    """Fetch articles from an RSS/Atom feed."""
    feed = feedparser.parse(source["url"])
    articles = []
    for entry in feed.entries[:20]:
        title = entry.get("title", "")
        url = entry.get("link", "")
        articles.append({"title": title, "url": url, "source": source["name"]})
    return articles


def fetch_github_trending(source):
    """Fetch trending repos from GitHub search API (created in last 7 days, sorted by stars)."""
    since = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    queries = ["agent", "AI coding", "LLM tool", "copilot", "MCP"]
    articles = []
    seen_repos = set()

    for q in queries:
        params = {
            "q": f"{q} created:>{since}",
            "sort": "stars",
            "order": "desc",
            "per_page": source.get("max_items", 20) // len(queries),
        }
        try:
            resp = requests.get(source["url"], params=params, timeout=15)
            if resp.status_code == 200:
                for repo in resp.json().get("items", []):
                    name = repo["full_name"]
                    if name in seen_repos:
                        continue
                    seen_repos.add(name)
                    desc = repo.get("description") or ""
                    title = f"{name}: {desc[:80]}" if desc else name
                    articles.append({
                        "title": title,
                        "url": repo["html_url"],
                        "source": source["name"],
                    })
        except requests.RequestException:
            continue

    return articles


def is_relevant(article):
    """Check if an article title is relevant to our topic."""
    title_lower = article["title"].lower()
    if article.get("source") in PRIORITY_SOURCES:
        return True
    if any(kw.lower() in title_lower for kw in PRIORITY_KEYWORDS):
        return True
    return any(kw.lower() in title_lower for kw in TOPIC_KEYWORDS)


def fetch_all():
    """Fetch from all sources, filter by relevance, deduplicate by URL."""
    all_articles = []
    for source in SOURCES:
        try:
            if source["type"] == "hn_api":
                articles = fetch_hn_stories(source)
            elif source["type"] == "rss":
                articles = fetch_rss(source)
            elif source["type"] == "github_trending":
                articles = fetch_github_trending(source)
            else:
                continue
            all_articles.extend(articles)
        except Exception as e:
            print(f"[WARN] Failed to fetch {source['name']}: {e}")

    relevant = [a for a in all_articles if is_relevant(a)]

    seen_urls = set()
    deduped = []
    for a in relevant:
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            deduped.append(a)

    return deduped, len(all_articles)
