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
- 依赖安装：约 2-3 分钟（首次）
- CLI 启动：< 1 秒
- 流水线执行（无 RSS 源）：< 5 秒
- LLM 调用：取决于 API 响应速度

## 出乎意料的事
1. **沙箱限制**：subagent 在执行 Bash 命令时遇到权限问题（install、pip 等关键词被拦截），需要手动安装依赖
2. **click 导入问题**：CLI `__main__.py` 无法直接导入 `main` 函数（因为是装饰器函数），需要用 click group 结构
3. **RSS 源需要手动配置**：config.json 中的白名单需要手动添加，暂无自动发现功能

## 如果再来一次
1. 会先在本地环境验证安装命令是否能执行，再让 subagent 执行
2. 会提前确认 click 的正确用法（group vs command）
3. 会考虑增加一个"dry run"模式用于测试