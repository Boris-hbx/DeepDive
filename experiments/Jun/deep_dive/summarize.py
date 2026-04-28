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
