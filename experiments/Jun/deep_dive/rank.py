"""重要性排序模块"""
from typing import List, Dict

# Agentic Software Engineering 相关关键词
KEYWORDS = [
    "agent", "llm", "gpt", "claude", "ai", "automation",
    "software engineering", "development", "coding",
    "multi-agent", "workflow", "pipeline", "tool use",
    "devops", "testing", "deployment"
]

def score_item(item: Dict, whitelist_domains: List[str] = None) -> float:
    """计算单条内容的重要性分数"""
    score = 0.0
    title = item.get("title", "").lower()
    url = item.get("url", "").lower()

    # 关键词匹配加分
    for kw in KEYWORDS:
        if kw in title:
            score += 1.0

    # 白名单域名加权
    if whitelist_domains:
        for domain in whitelist_domains:
            if domain in url:
                score += 2.0

    # 来源权威性（简单规则）
    authoritative_domains = ["github.com", "arxiv.org", "huggingface.co"]
    for domain in authoritative_domains:
        if domain in url:
            score += 1.5

    return score

def rank_items(items: List[Dict], whitelist: List[str] = None) -> List[Dict]:
    """对内容按重要性排序"""
    scored = [(item, score_item(item, whitelist)) for item in items]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [item for item, score in scored]