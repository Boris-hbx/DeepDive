"""Use Claude to generate the daily brief from fetched articles."""

import anthropic
from .config import MODEL, SOURCES


SYSTEM_PROMPT = """You are a tech analyst producing a daily brief about Agentic Software Engineering.
You will receive a list of articles (title + URL + source). Your job:
1. Pick the top 1-3 most important items for "最关注的事" section
2. Pick up to 5 items for "值得一看的事" section
3. If nothing is important enough, output the fallback format

Rules:
- Only use URLs from the provided list. NEVER invent URLs.
- Write in Chinese for the brief content.
- Each item in "最关注的事" needs: a one-line title, a 2-4 sentence explanation of what it is and why it matters, and the source link.
- Each item in "值得一看的事" needs: one sentence + source link.
- Be honest: if nothing is truly noteworthy, use the fallback format.
- PRIORITY: Articles about code review, testing, code quality, CI/CD, and from CodeRabbit should be given 3-5x higher weight when selecting items. Include at least 1-2 such articles in the final brief if available."""


def generate_brief(articles, date_str, total_scanned):
    """Call Claude to generate the brief markdown."""
    client = anthropic.Anthropic()
    num_sources = len(SOURCES)

    articles_text = "\n".join(
        f"- [{a['title']}]({a['url']}) (from: {a['source']})"
        for a in articles
    )

    user_prompt = f"""Today's date: {date_str}
Total sources: {num_sources}
Total articles scanned: {total_scanned}
Relevant articles found: {len(articles)}

Articles:
{articles_text}

Please generate the daily brief in the exact markdown format below.

If there are noteworthy items:
```
# Daily Brief — {date_str}

> 一句话摘要：今天最值得关注的方向是 ...
>
> 数据源：{num_sources} 个 / 已扫条目：{total_scanned} / 入选条目：<K>

## 最关注的事

### 1. <一句话标题>

<2-4 sentences>

来源：[<原文标题>](<URL>)

## 值得一看的事

- <一句话> — [<源>](<URL>)
```

If nothing is noteworthy:
```
# Daily Brief — {date_str}

> 今日无重要事件。
>
> 数据源：{num_sources} 个 / 已扫条目：{total_scanned} / 入选条目：0

## 说明

今日扫描的 {num_sources} 个源中，没有达到入选标准的事项。明天再来。
```

Output ONLY the markdown, no extra explanation."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": user_prompt}],
        system=SYSTEM_PROMPT,
    )

    text_blocks = [b for b in message.content if b.type == "text"]
    return text_blocks[0].text if text_blocks else ""
