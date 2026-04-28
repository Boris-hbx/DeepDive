"""去重模块 - URL 规范化 + 标题相似度"""
from typing import List, Dict
from urllib.parse import urlparse, parse_qs
import re

def normalize_url(url: str) -> str:
    """规范化 URL：去除 utm 参数、锚点等"""
    parsed = urlparse(url)
    # 去除 fragment
    base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    # 去除 query 中的 utm 参数
    params = parse_qs(parsed.query)
    clean_params = {k: v for k, v in params.items() if not k.startswith("utm_")}
    if clean_params:
        query = "&".join(f"{k}={v[0]}" for k, v in clean_params.items())
        return f"{base}?{query}"
    return base

def title_similarity(t1: str, t2: str) -> float:
    """简单标题相似度：基于编辑距离"""
    if not t1 or not t2:
        return 0.0
    t1_lower = t1.lower()
    t2_lower = t2.lower()
    if t1_lower == t2_lower:
        return 1.0
    # 简单实现：检查包含关系
    if t1_lower in t2_lower or t2_lower in t1_lower:
        return 0.8
    return 0.0

def deduplicate(items: List[Dict]) -> List[Dict]:
    """去重"""
    seen_urls = set()
    seen_titles = []
    result = []

    for item in items:
        url = normalize_url(item.get("url", ""))
        title = item.get("title", "")

        # URL 去重
        if url in seen_urls:
            continue

        # 标题相似度去重
        is_duplicate = False
        for seen_title in seen_titles:
            if title_similarity(title, seen_title) > 0.7:
                is_duplicate = True
                break

        if is_duplicate:
            continue

        seen_urls.add(url)
        seen_titles.append(title)
        result.append(item)

    return result
