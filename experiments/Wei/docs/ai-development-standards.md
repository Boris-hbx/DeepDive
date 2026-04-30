# AI 辅助开发规范

> 适用范围：`experiments/Wei/` 下所有 AI 辅助开发活动。
> 目标：让 AI 的参与过程透明、可审计、可复现。

## AI 参与度标注

每个 commit message 末尾标注 AI 参与程度：

| 标注 | 含义 |
|---|---|
| `[human]` | 完全人工编写，AI 未参与 |
| `[pair]` | 人机协作：人主导，AI 辅助（补全、建议、审查） |
| `[agent]` | AI 主导生成，人审查后提交 |

示例：
```
feat: add jaccard dedup for title similarity [agent]
fix: handle empty summaries in brief render [pair]
docs: update observability spec [human]
```

## Prompt 管理

所有 LLM prompt 模板集中在 `lib/prompts.mjs`，不散落在业务代码里。

每个 prompt 函数命名规范：`build<Step>SystemPrompt()` / `build<Step>UserPrompt(item)`

修改 prompt 时：
1. 在 `Worklog/wilson-notes.md` 记录修改原因和预期效果
2. 用 `--dry-run` 跑一遍验证输出格式
3. 对比修改前后的输出差异再提交

## LLM 输出解析防御

不依赖 LLM 严格遵守格式，解析层必须有容错：

```
解析顺序：
1. 剥 <thinking>...</thinking> 块（Opus 4.x adaptive thinking）
2. 剥 ```json ... ``` 围栏
3. 找最外层 {...} 或 [...]
4. json.loads
5. 失败 → regex 直接抠关键字段
6. 还失败 → 记 WARN，graceful skip，整批不挂
```

禁止：
- 直接 `JSON.parse(llmResponse)` 不做任何预处理
- 解析失败时抛出异常中断整个批次

## URL 防幻觉约束

LLM 的 output schema **不包含 URL 字段**。URL 全程从 fetch 阶段透传，render 阶段从结构化字段拼接，零 LLM 介入。

违反此约束会导致幻觉链接，是高优先级 bug。

## Dry-run 模式

所有涉及 LLM 调用的步骤必须支持 `--dry-run`，用 mock 数据跑通管道，不消耗 API quota。

用途：
- 没有 API key 时验证下游逻辑
- 排查解析/渲染问题时不烧 quota
- CI 中验证管道完整性

## 代理选择规范

选 LLM 代理时必须确认：
- 按 token 计费（不是按月共享池）
- 不注入额外工具集（Claude Code 共享池型代理会强行注入 Bash 工具，导致响应永远是 `tool_use`）
- 支持 prompt caching 透传

判断方法：官网看"按量计费"字样；用 `curl` 发一个最简请求，检查响应里有没有意外的 `tool_use` 块。

## 新依赖引入流程

1. 说明用途和替代方案
2. 确认后再 `npm install`
3. 在 `Worklog/wilson-notes.md` 记录引入原因
4. 更新 `.env.example`（如果新依赖需要环境变量）

当前已有依赖：`@anthropic-ai/sdk`、`marked`、`rss-parser`、`node-cron`
