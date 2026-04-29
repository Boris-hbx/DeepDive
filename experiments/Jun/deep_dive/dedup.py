"""去重模块 - URL 规范化 + 多级相似度检测"""
from typing import List, Dict, Set
from urllib.parse import urlparse, parse_qs
import re

# 常见的追踪参数
TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "msclkid", "ref", "source", "mc_cid", "mc_eid",
    "_ga", "_gl", "igshid", "s_kwcid", "yclid"
}

def normalize_url(url: str) -> str:
    """规范化 URL：去除追踪参数、锚点、协议前缀等"""
    if not url:
        return ""

    parsed = urlparse(url)

    # 去除 fragment
    base = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

    # 去除追踪参数
    params = parse_qs(parsed.query)
    clean_params = {k: v for k, v in params.items()
                   if k.lower() not in TRACKING_PARAMS and not k.startswith("utm_")}

    if clean_params:
        query = "&".join(f"{k}={v[0]}" for k, v in clean_params.items())
        return f"{base}?{query}"
    return base

def tokenize(text: str) -> Set[str]:
    """将文本分词为词集合"""
    if not text:
        return set()
    # 转小写，提取字母数字词
    words = re.findall(r'\b[a-z0-9]+\b', text.lower())
    return set(words)

def jaccard_similarity(set1: Set[str], set2: Set[str]) -> float:
    """计算 Jaccard 相似度"""
    if not set1 or not set2:
        return 0.0
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union > 0 else 0.0

def title_similarity(t1: str, t2: str) -> float:
    """标题相似度：结合精确匹配 + 包含关系 + Jaccard"""
    if not t1 or not t2:
        return 0.0
    t1_lower = t1.lower()
    t2_lower = t2.lower()

    # 精确匹配
    if t1_lower == t2_lower:
        return 1.0

    # 包含关系
    if t1_lower in t2_lower or t2_lower in t1_lower:
        return 0.85

    # Jaccard 相似度
    tokens1 = tokenize(t1)
    tokens2 = tokenize(t2)
    return jaccard_similarity(tokens1, tokens2)

def content_similarity(c1: str, c2: str) -> float:
    """内容摘要相似度"""
    if not c1 or not c2:
        return 0.0
    tokens1 = tokenize(c1)
    tokens2 = tokenize(c2)
    return jaccard_similarity(tokens1, tokens2)

def deduplicate(items: List[Dict], title_threshold: float = 0.6,
                content_threshold: float = 0.5) -> List[Dict]:
    """多级去重：URL → 标题相似度 → 内容相似度"""
    seen_urls: Set[str] = set()
    seen_titles: List[str] = []
    seen_content: List[str] = []
    result: List[Dict] = []

    for item in items:
        url = normalize_url(item.get("url", ""))
        title = item.get("title", "")
        content = item.get("summary", "")[:300]  # 截取前300字符

        # URL 去重
        if url in seen_urls:
            continue

        # 标题相似度检查
        is_duplicate = False
        for seen_title in seen_titles:
            if title_similarity(title, seen_title) > title_threshold:
                is_duplicate = True
                break

        if not is_duplicate:
            # 内容相似度检查（针对不同URL但标题不同的情况）
            for seen_content_text in seen_content:
                if content_similarity(content, seen_content_text) > content_threshold:
                    is_duplicate = True
                    break

        if is_duplicate:
            continue

        seen_urls.add(url)
        seen_titles.append(title)
        seen_content.append(content)
        result.append(item)

    return result
