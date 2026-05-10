"""信息获取模块 - RSS + Web Search"""
import requests
import feedparser
from typing import List, Dict
from urllib.parse import urlparse, parse_qs

def fetch_rss(url: str) -> List[Dict]:
    """获取 RSS 源内容"""
    items = []
    feed = feedparser.parse(url)
    for entry in feed.entries:
        items.append({
            "title": entry.get("title", ""),
            "url": entry.get("link", ""),
            "published": entry.get("published", ""),
            "summary": entry.get("summary", ""),
            "source": url
        })
    return items

def fetch_whitelist(urls: List[str]) -> List[Dict]:
    """获取白名单 URL 的内容"""
    items = []
    for url in urls:
        try:
            items.extend(fetch_rss(url))
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")
    return items

def search_web(query: str, engine: str = "duckduckgo", max_results: int = 20) -> List[Dict]:
    """Web 搜索 - 待实现"""
    # TODO: 实现 web search
    return []

def fetch_all() -> List[Dict]:
    """从所有源获取内容"""
    from .config import load_config
    config = load_config()
    sources = config.get("sources", {})

    items = []
    # 抓取白名单
    whitelist = sources.get("whitelist", [])
    items.extend(fetch_whitelist(whitelist))

    # Web Search 补充
    if sources.get("use_web_search", False):
        # TODO: 实现 web search
        pass

    return items