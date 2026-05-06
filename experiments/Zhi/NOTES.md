# Zhi 的实践笔记

## 技术栈

- 语言：Python 3.9
- LLM：Anthropic Claude Opus 4.6（`claude-opus-4-6`）
- 抓取：`requests` + `feedparser`
- 静态站点：纯 Python 生成 HTML（无框架）
- 托管方式：本地预览（暂未部署）

## 信息源

选了 5 个源，覆盖头部 AI 公司官方博客 + 社区 + 独立博主：

| 源 | 类型 | 选择理由 |
|---|---|---|
| Hacker News | API | 社区热度最高的技术聚合站，覆盖面广 |
| Anthropic Blog | RSS | Claude 生态一手信息 |
| OpenAI Blog | RSS | GPT 生态一手信息 |
| Simon Willison | Atom | AI 工具链方向最活跃的独立博主 |
| GitHub Blog | RSS | 开发者工具和 Copilot 动态 |

## 流水线设计

```
fetch（并行抓取 5 个源）
  → filter（关键词匹配，筛选 Agentic SE 相关）
  → dedup（URL 去重）
  → summarize（Claude 一次性生成完整 brief）
  → save（输出 Markdown 到 briefs/）
  → render（生成静态 HTML 站点）
```

单 agent，无多步分解。抓取和摘要是两个独立脚本，手动串联。

## Prompt 思路

- 采用 system prompt + user prompt 分离：system 定义角色和规则，user 提供当天数据
- 核心约束：只能使用提供的 URL，不能编造链接
- 输出格式直接在 prompt 中给出完整模板，减少格式偏差
- 迭代 1 次：初版直接可用，未做多轮调优

## 成本 / 时延

- 抓取阶段：~10 秒（HN API 逐条请求是瓶颈）
- LLM 调用：~15-20 秒（Opus 4.6，单次调用，~2000 token 输出）
- 总计：约 30 秒跑完一次
- Token 消耗：输入 ~1500 token，输出 ~800 token，单次成本约 $0.05

## 出乎意料的事

1. **好**：Claude Code 从零搭建整个流水线非常快，从想法到跑通不到 20 分钟
2. **差**：模型 ID 踩坑——`claude-opus-4-20250514` 和 `claude-opus-4-6` 是不同的，API key 权限和模型 ID 的对应关系不直观
3. **好**：抓取 + 关键词过滤的简单方案效果不错，79 篇中筛出 21 篇相关，最终 brief 质量可读

## 如果再来一次

- HN 抓取改成批量请求（当前逐条太慢）
- 加一个缓存层，避免重复抓取相同内容
- 关键词过滤太粗糙，可以用 LLM 做二次相关性判断
- 静态站点可以用更好的 CSS 样式，当前极简
