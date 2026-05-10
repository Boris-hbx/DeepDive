# Design: MVP 实现方案（Jun）

- 日期：2026-04-28
- 作者：Jun
- 关联：[`spec/mvp.md`](../../spec/mvp.md)

## 整体架构

```
experiments/Jun/
├── deep_dive/
│   ├── __init__.py
│   ├── __main__.py        # CLI 入口
│   ├── cli.py             # 命令行工具
│   ├── config.py          # 配置管理
│   ├── llm/
│   │   ├── __init__.py    # 工厂函数 get_llm_client()
│   │   ├── base.py        # 抽象基类 LLMClient
│   │   ├── anthropic_backend.py
│   │   ├── openai_backend.py
│   │   ├── google_backend.py
│   │   ├── deepseek_backend.py
│   │   └── ...
│   ├── fetch.py           # 获取信息（RSS/Web/Search）
│   ├── dedup.py           # 去重
│   ├── rank.py            # 重要性排序
│   ├── summarize.py       # LLM 生成摘要
│   └── render.py          # Jinja2 → HTML
├── templates/
│   ├── brief.html         # 单篇 brief 模板
│   └── index.html         # 站点首页模板
├── briefs/
│   └── YYYY-MM-DD.md      # 每日 brief 输出
├── site/                  # 生成的静态站点
│   ├── index.html
│   └── briefs/
└── NOTES.md
```

## 流水线设计

### 1. fetch.py — 信息获取

支持三种模式，配置在 `config.json`：

```python
# 配置结构
sources:
  whitelist: ["https://news.ycombinator.com/rss", ...]
  use_web_search: true
  search_engine: "duckduckgo"  # 或 "google", "bing"
  max_results: 20
```

**职责：** 从白名单 URL 拉取内容 + Web Search 补充，统一输出结构化 items

### 2. dedup.py — 去重

基于 URL 规范化 + 标题相似度去重：
- URL 规范化（去除 utm 参数、锚点）
- 标题相似度（编辑距离 < 3 或包含相同核心词）
- 时间窗口（只保留最近 N 天的内容）

### 3. rank.py — 重要性排序

基于 LLM 评分或规则打分：
- 来源权威性（白名单权重更高）
- 标题关键词匹配（agent, LLM, software engineering...）
- 内容新鲜度

### 4. summarize.py — 生成摘要

调用 LLM 生成 brief，按输出契约格式输出 Markdown

### 5. render.py — 渲染站点

Jinja2 模板渲染，生成静态 HTML

## LLM 多后端抽象

### Base 接口

```python
class LLMClient:
    def complete(self, prompt: str, system: str = None) -> str:
        """同步补全，返回文本"""
        raise NotImplementedError

    def complete_with_json(self, prompt: str, system: str = None) -> dict:
        """返回 JSON 结构化结果"""
        raise NotImplementedError
```

### 配置方式

`.env` 或 `config.json`：

```json
{
  "llm_backend": "anthropic",
  "api_key": "sk-...",
  "model": "claude-sonnet-4-20250514"
}
```

### 支持的后端

- Anthropic (Claude)
- OpenAI (GPT 系列)
- Google (Gemini)
- DeepSeek
- 其他 OpenAI 兼容接口

## CLI 交互设计

```bash
# 手动触发生成
python -m deep_dive run --date 2026-04-28

# 启动本地预览 server
python -m deep_dive serve --port 8080

# 一键生成 + 预览
python -m deep_dive run --date 2026-04-28 --serve
```

## 输出契约

必须符合 `spec/mvp.md` 中的输出契约：

```
briefs/YYYY-MM-DD.md 格式：

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
```

兜底文案（无重要事件时）：
```
# Daily Brief — YYYY-MM-DD

> 今日无重要事件。
>
> 数据源：N 个 / 已扫条目：M / 入选条目：0

## 说明

今日扫描的 N 个源中，没有达到入选标准的事项。明天再来。
```

## 技术栈

- Python 3.x
- Jinja2（模板渲染）
- LLM 多后端抽象层
- requests + BeautifulSoup（网页抓取）
- RSS feedparser

## 验收条件

- [ ] 至少 1 篇真实数据 brief
- [ ] 文件位置和命名符合契约
- [ ] 章节结构符合契约
- [ ] 每条带原文链接
- [ ] 无重要事件时用兜底文案
- [ ] 静态站点能本地预览
- [ ] NOTES.md 已写