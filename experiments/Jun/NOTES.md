# Jun 的实践笔记

## 技术栈
- Python 3.x
- Jinja2（模板渲染）
- requests + feedparser（信息获取）
- LLM 多后端抽象（Anthropic/OpenAI）
- click（CLI）

## 信息源
- Hacker News RSS（待扩展）
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