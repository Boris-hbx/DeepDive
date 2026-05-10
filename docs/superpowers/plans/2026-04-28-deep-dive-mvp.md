# DeepDive MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 DeepDive MVP，在 `experiments/Jun/` 下完成每日 brief 生成流水线

**Architecture:** 5步流水线（fetch → dedup → rank → summarize → render），支持多 LLM 后端，CLI + 本地 server

**Tech Stack:** Python 3.x, Jinja2, requests, feedparser, LLM SDK

---

## 文件结构

```
experiments/Jun/
├── design.md              # 设计文档（已存在）
├── NOTES.md               # 实现笔记（完成后写）
├── pyproject.toml         # 项目依赖
├── .env.example           # 环境变量示例
├── config.json            # 配置文件
├── deep_dive/
│   ├── __init__.py
│   ├── __main__.py        # CLI 入口
│   ├── cli.py             # 命令行工具
│   ├── config.py          # 配置管理
│   ├── llm/
│   │   ├── __init__.py    # 工厂函数 get_llm_client()
│   │   ├── base.py        # 抽象基类
│   │   ├── anthropic_backend.py
│   │   ├── openai_backend.py
│   │   └── ...
│   ├── fetch.py           # 信息获取
│   ├── dedup.py           # 去重
│   ├── rank.py            # 重要性排序
│   ├── summarize.py       # LLM 生成摘要
│   └── render.py          # HTML 渲染
├── templates/
│   ├── brief.html
│   └── index.html
├── briefs/                # 每日 brief 输出
└── site/                  # 静态站点
```

---

## Task 1: 项目初始化

**Files:**
- Create: `experiments/Jun/pyproject.toml`
- Create: `experiments/Jun/.env.example`
- Create: `experiments/Jun/config.json`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "deep-dive"
version = "0.1.0"
description = "Insight Exploration - Daily Brief Generator"
requires-python = ">=3.10"
dependencies = [
    "requests>=2.28.0",
    "feedparser>=6.0.0",
    "beautifulsoup4>=4.12.0",
    "jinja2>=3.1.0",
    "anthropic>=0.18.0",
    "openai>=1.0.0",
    "google-generativeai>=0.3.0",
]

[project.scripts]
deep-dive = "deep_dive.cli:main"
```

- [ ] **Step 2: Create .env.example**

```
LLM_BACKEND=anthropic
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...
```

- [ ] **Step 3: Create config.json**

```json
{
  "sources": {
    "whitelist": [
      "https://news.ycombinator.com/rss"
    ],
    "use_web_search": true,
    "search_engine": "duckduckgo",
    "max_results": 20
  },
  "brief": {
    "max_top_stories": 3,
    "max_secondary_stories": 5
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd experiments/Jun
git add pyproject.toml .env.example config.json
git commit -m "feat(Jun): add project config files"
```

---

## Task 2: LLM 多后端抽象层

**Files:**
- Create: `experiments/Jun/deep_dive/__init__.py`
- Create: `experiments/Jun/deep_dive/config.py`
- Create: `experiments/Jun/deep_dive/llm/__init__.py`
- Create: `experiments/Jun/deep_dive/llm/base.py`
- Create: `experiments/Jun/deep_dive/llm/anthropic_backend.py`
- Create: `experiments/Jun/deep_dive/llm/openai_backend.py`

- [ ] **Step 1: Write failing test**

```python
# tests/llm/test_base.py
import pytest
from deep_dive.llm import get_llm_client

def test_get_llm_client_returns_client():
    client = get_llm_client(backend="anthropic")
    assert client is not None
    assert hasattr(client, "complete")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd experiments/Jun && python -m pytest tests/llm/test_base.py -v
# Expected: FAIL - module not found
```

- [ ] **Step 3: Create deep_dive/__init__.py**

```python
"""DeepDive - Insight Exploration App"""
```

- [ ] **Step 4: Create deep_dive/config.py**

```python
import os
import json
from pathlib import Path

def load_config():
    config_path = Path(__file__).parent.parent / "config.json"
    with open(config_path) as f:
        return json.load(f)

def get_env(key: str, default: str = None) -> str:
    return os.getenv(key, default)
```

- [ ] **Step 5: Create deep_dive/llm/__init__.py**

```python
import os
from .base import LLMClient
from .anthropic_backend import AnthropicClient
from .openai_backend import OpenAIClient

_BACKENDS = {
    "anthropic": AnthropicClient,
    "openai": OpenAIClient,
}

def get_llm_client(backend: str = None) -> LLMClient:
    if backend is None:
        backend = os.getenv("LLM_BACKEND", "anthropic")
    backend_class = _BACKENDS.get(backend)
    if backend_class is None:
        raise ValueError(f"Unknown backend: {backend}")
    return backend_class()

__all__ = ["LLMClient", "get_llm_client"]
```

- [ ] **Step 6: Create deep_dive/llm/base.py**

```python
from abc import ABC, abstractmethod

class LLMClient(ABC):
    @abstractmethod
    def complete(self, prompt: str, system: str = None) -> str:
        """同步补全，返回文本"""
        raise NotImplementedError

    @abstractmethod
    def complete_with_json(self, prompt: str, system: str = None) -> dict:
        """返回 JSON 结构化结果"""
        raise NotImplementedError
```

- [ ] **Step 7: Create deep_dive/llm/anthropic_backend.py**

```python
import os
from anthropic import Anthropic
from .base import LLMClient

class AnthropicClient(LLMClient):
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        self.client = Anthropic(api_key=api_key)

    def complete(self, prompt: str, system: str = None) -> str:
        messages = [{"role": "user", "content": prompt}]
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=messages
        )
        return response.content[0].text

    def complete_with_json(self, prompt: str, system: str = None) -> dict:
        import json
        text = self.complete(prompt, system)
        return json.loads(text)
```

- [ ] **Step 8: Create deep_dive/llm/openai_backend.py**

```python
import os
from openai import OpenAI
from .base import LLMClient

class OpenAIClient(LLMClient):
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        self.client = OpenAI(api_key=api_key)

    def complete(self, prompt: str, system: str = None) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages
        )
        return response.choices[0].message.content

    def complete_with_json(self, prompt: str, system: str = None) -> dict:
        import json
        text = self.complete(prompt, system)
        return json.loads(text)
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
cd experiments/Jun && python -m pytest tests/llm/ -v
# Expected: PASS
```

- [ ] **Step 10: Commit**

```bash
git add deep_dive/__init__.py deep_dive/config.py deep_dive/llm/
git commit -m "feat(Jun): add LLM multi-backend abstraction"
```

---

## Task 3: fetch.py — 信息获取

**Files:**
- Create: `experiments/Jun/deep_dive/fetch.py`
- Create: `tests/deep_dive/test_fetch.py`

- [ ] **Step 1: Write failing test**

```python
# tests/deep_dive/test_fetch.py
import pytest
from deep_dive.fetch import fetch_all

def test_fetch_returns_list():
    items = fetch_all()
    assert isinstance(items, list)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_fetch.py -v
# Expected: FAIL - module not found
```

- [ ] **Step 3: Create deep_dive/fetch.py**

```python
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
    """Web 搜索"""
    # 简化实现，实际可用 duckduckgo-search 等库
    # 这里返回空列表占位，后续可扩展
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_fetch.py -v
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add deep_dive/fetch.py tests/deep_dive/test_fetch.py
git commit -m "feat(Jun): add fetch module for RSS and web search"
```

---

## Task 4: dedup.py — 去重

**Files:**
- Create: `experiments/Jun/deep_dive/dedup.py`
- Create: `tests/deep_dive/test_dedup.py`

- [ ] **Step 1: Write failing test**

```python
# tests/deep_dive/test_dedup.py
import pytest
from deep_dive.dedup import deduplicate

def test_dedup_removes_duplicates():
    items = [
        {"title": "Test 1", "url": "https://example.com/1"},
        {"title": "Test 1", "url": "https://example.com/1"},  # duplicate
    ]
    result = deduplicate(items)
    assert len(result) == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_dedup.py -v
# Expected: FAIL
```

- [ ] **Step 3: Create deep_dive/dedup.py**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_dedup.py -v
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add deep_dive/dedup.py tests/deep_dive/test_dedup.py
git commit -m "feat(Jun): add dedup module with URL and title dedup"
```

---

## Task 5: rank.py — 重要性排序

**Files:**
- Create: `experiments/Jun/deep_dive/rank.py`
- Create: `tests/deep_dive/test_rank.py`

- [ ] **Step 1: Write failing test**

```python
# tests/deep_dive/test_rank.py
import pytest
from deep_dive.rank import rank_items

def test_rank_returns_sorted_list():
    items = [
        {"title": "A", "url": "http://a.com"},
        {"title": "B", "url": "http://b.com"},
    ]
    result = rank_items(items)
    assert isinstance(result, list)
    assert len(result) == 2
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_rank.py -v
# Expected: FAIL
```

- [ ] **Step 3: Create deep_dive/rank.py**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_rank.py -v
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add deep_dive/rank.py tests/deep_dive/test_rank.py
git commit -m "feat(Jun): add rank module with keyword-based scoring"
```

---

## Task 6: summarize.py — LLM 生成摘要

**Files:**
- Create: `experiments/Jun/deep_dive/summarize.py`
- Create: `tests/deep_dive/test_summarize.py`

- [ ] **Step 1: Write failing test**

```python
# tests/deep_dive/test_summarize.py
import pytest
from deep_dive.summarize import generate_brief

def test_generate_brief_returns_string():
    items = [{"title": "Test", "url": "http://test.com", "summary": "Test summary"}]
    result = generate_brief(items, date="2026-04-28")
    assert isinstance(result, str)
    assert "Daily Brief" in result
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_summarize.py -v
# Expected: FAIL
```

- [ ] **Step 3: Create deep_dive/summarize.py**

```python
"""LLM 生成摘要模块"""
from typing import List, Dict
from datetime import datetime

SYSTEM_PROMPT = """你是一个专业的技术编辑，专注于 Agentic Software Engineering 领域。
根据用户提供的信息，生成一份每日洞察简报（Daily Brief）。
输出格式必须严格遵循以下 Markdown 结构：

# Daily Brief — YYYY-MM-DD

> 一句话摘要：今天最值得关注的方向是 ...
>
> 数据源：N 个 / 已扫条目：M / 入选条目：K

## 最关注的事

### 1. <一句话标题>

<2-4句话说什么、为什么重要>

来源：[<原文标题>](<URL>)

### 2. ...
### 3. ...

## 值得一看的事

- <一句话> — [<源>](<URL>)
- ...

## 今日观察小结（可选）

<不超过100字>

注意：
- 只选取真正值得关注的内容，不要凑数
- 如果没有重要事件，输出兜底文案"今日无重要事件"
- 每条必须带原文链接
"""

def format_items_for_prompt(items: List[Dict]) -> str:
    """格式化 items 用于 prompt"""
    lines = []
    for i, item in enumerate(items, 1):
        title = item.get("title", "")
        url = item.get("url", "")
        summary = item.get("summary", "")[:500]  # 限制长度
        lines.append(f"[{i}] {title}\n   URL: {url}\n   Summary: {summary}")
    return "\n\n".join(lines)

def generate_brief(items: List[Dict], date: str = None) -> str:
    """使用 LLM 生成 brief"""
    from .llm import get_llm_client

    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    if not items:
        # 兜底文案
        return f"""# Daily Brief — {date}

> 今日无重要事件。
>
> 数据源：0 个 / 已扫条目：0 / 入选条目：0

## 说明

今日扫描的源中，没有达到入选标准的事项。明天再来。
"""

    formatted_items = format_items_for_prompt(items)
    prompt = f"日期：{date}\n\n请根据以下信息生成每日 brief：\n\n{formatted_items}"

    client = get_llm_client()
    brief = client.complete(prompt=prompt, system=SYSTEM_PROMPT)

    return brief
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_summarize.py -v
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add deep_dive/summarize.py tests/deep_dive/test_summarize.py
git commit -m "feat(Jun): add summarize module with LLM brief generation"
```

---

## Task 7: render.py — HTML 渲染

**Files:**
- Create: `experiments/Jun/deep_dive/render.py`
- Create: `experiments/Jun/templates/brief.html`
- Create: `experiments/Jun/templates/index.html`
- Create: `tests/deep_dive/test_render.py`

- [ ] **Step 1: Write failing test**

```python
# tests/deep_dive/test_render.py
import pytest
from deep_dive.render import render_brief_to_html, render_index

def test_render_brief_to_html():
    brief_md = "# Daily Brief — 2026-04-28\n\n> Test"
    result = render_brief_to_html(brief_md, date="2026-04-28")
    assert isinstance(result, str)
    assert "Daily Brief" in result
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_render.py -v
# Expected: FAIL
```

- [ ] **Step 3: Create templates/brief.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Brief — {{ date }}</title>
    <style>
        body { max-width: 800px; margin: 0 auto; padding: 2rem; font-family: system-ui, sans-serif; line-height: 1.6; }
        h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
        h2 { margin-top: 2rem; color: #444; }
        .meta { color: #666; font-size: 0.9rem; }
        .source { color: #0066cc; }
        a { color: #0066cc; }
        ul { padding-left: 1.5rem; }
        li { margin-bottom: 0.5rem; }
    </style>
</head>
<body>
    {{ content | safe }}
    <footer style="margin-top: 3rem; color: #999; font-size: 0.8rem;">
        <a href="/">← 返回首页</a>
    </footer>
</body>
</html>
```

- [ ] **Step 4: Create templates/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeepDive — 洞察探索</title>
    <style>
        body { max-width: 800px; margin: 0 auto; padding: 2rem; font-family: system-ui, sans-serif; }
        h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
        .brief-list { list-style: none; padding: 0; }
        .brief-item { padding: 1rem; margin: 1rem 0; border: 1px solid #ddd; border-radius: 8px; }
        .brief-item:hover { background: #f9f9f9; }
        .brief-item a { text-decoration: none; color: #333; font-weight: bold; }
        .brief-item .meta { color: #666; font-size: 0.85rem; margin-top: 0.5rem; }
    </style>
</head>
<body>
    <h1>DeepDive — 洞察探索</h1>
    <p>每日 Agentic Software Engineering 领域洞察</p>
    <ul class="brief-list">
    {% for brief in briefs %}
        <li class="brief-item">
            <a href="/briefs/{{ brief.date }}.html">{{ brief.date }}</a>
            <div class="meta">数据源：{{ brief.source_count }} 个</div>
        </li>
    {% endfor %}
    </ul>
</body>
</html>
```

- [ ] **Step 5: Create deep_dive/render.py**

```python
"""HTML 渲染模块"""
import re
from pathlib import Path
from jinja2 import Template
from typing import List, Dict

def markdown_to_html(md: str) -> str:
    """简单的 Markdown 转 HTML（用于渲染）"""
    # 这里用正则做简单转换，实际可用 markdown 库
    html = md
    # 标题
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    # 链接
    html = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', html)
    # 引用
    html = re.sub(r'^> (.+)$', r'<blockquote>\1</blockquote>', html, flags=re.MULTILINE)
    # 列表
    html = re.sub(r'^- (.+)', r'<li>\1</li>', html, flags=re.MULTILINE)
    # 段落
    html = re.sub(r'\n\n', '</p><p>', html)
    return f"<p>{html}</p>"

def render_brief_to_html(brief_md: str, date: str) -> str:
    """将 brief Markdown 渲染为 HTML"""
    template_path = Path(__file__).parent.parent / "templates" / "brief.html"
    with open(template_path) as f:
        template = Template(f.read())

    content = markdown_to_html(brief_md)
    return template.render(date=date, content=content)

def render_index(briefs: List[Dict]) -> str:
    """渲染首页"""
    template_path = Path(__file__).parent.parent / "templates" / "index.html"
    with open(template_path) as f:
        template = Template(f.read())

    # 按日期排序，最新的在前
    sorted_briefs = sorted(briefs, key=lambda x: x.get("date", ""), reverse=True)
    return template.render(briefs=sorted_briefs)

def save_html(html: str, output_path: Path):
    """保存 HTML 到文件"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        f.write(html)
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_render.py -v
# Expected: PASS
```

- [ ] **Step 7: Commit**

```bash
git add deep_dive/render.py templates/
git commit -m "feat(Jun): add render module with Jinja2 templates"
```

---

## Task 8: CLI 和主流程

**Files:**
- Create: `experiments/Jun/deep_dive/__main__.py`
- Create: `experiments/Jun/deep_dive/cli.py`

- [ ] **Step 1: Write failing test**

```python
# tests/deep_dive/test_cli.py
import pytest
from deep_dive.cli import run_pipeline

def test_run_pipeline_returns_brief_path():
    result = run_pipeline(date="2026-04-28")
    assert result is not None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_cli.py -v
# Expected: FAIL
```

- [ ] **Step 3: Create deep_dive/cli.py**

```python
"""CLI 主逻辑"""
import click
from pathlib import Path
from datetime import datetime
from .fetch import fetch_all
from .dedup import deduplicate
from .rank import rank_items
from .summarize import generate_brief
from .render import render_brief_to_html, render_index, save_html
from .config import load_config

def run_pipeline(date: str = None) -> Path:
    """运行完整流水线"""
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    print(f"Running pipeline for {date}...")

    # 1. Fetch
    print("Fetching sources...")
    items = fetch_all()
    print(f"  Fetched {len(items)} items")

    # 2. Dedup
    print("Deduplicating...")
    items = deduplicate(items)
    print(f"  After dedup: {len(items)} items")

    # 3. Rank
    print("Ranking...")
    config = load_config()
    whitelist = config.get("sources", {}).get("whitelist", [])
    items = rank_items(items, whitelist)
    print(f"  Ranked {len(items)} items")

    # 4. Summarize
    print("Generating brief...")
    brief_md = generate_brief(items, date)

    # 5. Render
    print("Rendering...")
    brief_html = render_brief_to_html(brief_md, date)

    # 保存 brief
    briefs_dir = Path(__file__).parent.parent / "briefs"
    briefs_dir.mkdir(exist_ok=True)
    brief_path = briefs_dir / f"{date}.md"
    with open(brief_path, "w") as f:
        f.write(brief_md)

    # 生成站点
    site_dir = Path(__file__).parent.parent / "site"
    site_dir.mkdir(exist_ok=True)

    # 保存 HTML
    html_path = site_dir / "briefs" / f"{date}.html"
    save_html(brief_html, html_path)

    # 更新首页
    update_index(site_dir, date)

    print(f"Done! Brief saved to {brief_path}")
    return brief_path

def update_index(site_dir: Path, date: str):
    """更新首页"""
    # 收集所有 briefs
    briefs_dir = Path(__file__).parent.parent / "briefs"
    briefs = []
    if briefs_dir.exists():
        for f in briefs_dir.glob("*.md"):
            briefs.append({"date": f.stem})
    index_html = render_index(briefs)
    save_html(index_html, site_dir / "index.html")

@click.command()
@click.option("--date", help="Brief date (YYYY-MM-DD)", default=None)
@click.option("--serve", is_flag=True, help="Start local server after generation")
@click.option("--port", default=8080, help="Server port")
def main(date, serve, port):
    """DeepDive - 洞察探索 CLI"""
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    brief_path = run_pipeline(date)

    if serve:
        import http.server
        import socketserver
        site_dir = Path(__file__).parent.parent / "site"

        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(site_dir), **kwargs)

        print(f"Serving at http://localhost:{port}")
        with socketserver.TCPServer(("", port), Handler) as httpd:
            httpd.serve_forever()

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Create deep_dive/__main__.py**

```python
"""CLI 入口点"""
from .cli import main

if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd experiments/Jun && python -m pytest tests/deep_dive/test_cli.py -v
# Expected: PASS
```

- [ ] **Step 6: Commit**

```bash
git add deep_dive/cli.py deep_dive/__main__.py
git commit -m "feat(Jun): add CLI with run and serve commands"
```

---

## Task 9: 端到端测试

- [ ] **Step 1: 运行完整流水线**

```bash
cd experiments/Jun
python -m deep_dive run --date 2026-04-28
```

- [ ] **Step 2: 检查输出**

```bash
# 检查 brief 文件
ls -la briefs/
cat briefs/2026-04-28.md

# 检查 site
ls -la site/
ls -la site/briefs/
```

- [ ] **Step 3: 验证输出契约**

对照 `spec/mvp.md` 检查：
- [ ] 文件位置：`briefs/YYYY-MM-DD.md`
- [ ] 章节结构：最关注的事、值得一看的事、今日观察小结
- [ ] 每条带原文链接
- [ ] 无重要事件时有兜底文案

- [ ] **Step 4: Commit**

```bash
git add briefs/2026-04-28.md
git commit -m "feat(Jun): generate first brief for 2026-04-28"
```

---

## Task 10: 编写 NOTES.md

- [ ] **Step 1: 创建 experiments/Jun/NOTES.md**

```markdown
# Jun 的实践笔记

## 技术栈
- Python 3.x
- Jinja2（模板渲染）
- requests + feedparser（信息获取）
- LLM 多后端抽象（Anthropic/OpenAI）

## 信息源
- Hacker News RSS
- Web Search（待实现）

## 流水线设计
fetch → dedup → rank → summarize → render

## Prompt 思路
使用 system prompt 指定输出格式，user prompt 传入原始内容

## 成本 / 时延
（待实际运行后补充）

## 出乎意料的事
（待补充）

## 如果再来一次
（待补充）
```

- [ ] **Step 2: Commit**

```bash
git add NOTES.md
git commit -m "feat(Jun): add implementation notes"
```