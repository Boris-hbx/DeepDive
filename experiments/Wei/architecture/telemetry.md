# Telemetry 架构

> 本文描述 `experiments/Wei/` 的可观测性数据流和组件关系。

## 数据流总览

```
业务模块（fetcher / llm-provider / report-generator / ...）
    │
    │  logger.info / logger.warn / logger.error / logger.audit
    ▼
lib/logger.mjs
    ├── stdout（JSON 单行，供终端实时查看）
    ├── logs/app.log（滚动写入，保留 30 天）
    └── logs/audit.jsonl（只追加，永久保留）

流水线中间产物
    └── data/YYYY-MM-DD/<step>.json（含 _meta 元数据）

报告 / brief 产物
    ├── reports/YYYY/MM/DD/<slug>.{md,html,meta.json}
    └── briefs/YYYY-MM-DD/brief.{md,html}

server.mjs
    └── GET /health → 实时状态快照
```

## 组件职责

### lib/logger.mjs

统一日志入口，所有模块通过它输出，不直接用 `console.log`。

```
输入：level, module, msg, data?
输出：
  - stdout: {"ts":...,"level":...,"module":...,"msg":...,"data":...}
  - app.log: 同上
  - audit.jsonl: 仅 logger.audit() 调用时写入
```

### data/YYYY-MM-DD/ 中间产物

每个 JSON 文件结构：

```
{
  "_meta": {
    "generatedAt": ISO8601,
    "step": "fetch|dedup|rank|summarize",
    "sessionId": "sess_xxxxxxxx",
    "inputCount": N,
    "outputCount": N,
    "durationMs": N,
    "llm"?: { model, calls, inputTokens, cacheReadTokens, outputTokens, estimatedCostUSD }
  },
  "items": [...]
}
```

### reports/<slug>.meta.json

每份报告的元数据文件，与 `.md` / `.html` 同目录：

```json
{
  "id": "2026-04-26-ai-code-agent",
  "title": "AI Code Agent 架构演进",
  "createdAt": "2026-04-26T10:23:45Z",
  "type": "survey",
  "domain": "software-engineering",
  "parentReportId": null,
  "tags": { "user": ["LLM", "Agent"], "auto": ["Claude", "Copilot"] },
  "sources": [{ "title": "...", "url": "..." }],
  "conversationHistory": [],
  "llmCost": { "inputTokens": 18500, "outputTokens": 3200, "estimatedUSD": 0.10 },
  "sessionId": "sess_abc12345"
}
```

`conversationHistory` 用于交互式追问，最多保留 5 轮，超过时自动摘要最早几轮。

### GET /health

```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "0.1.0",
  "lastBriefAt": { "software-engineering": "2026-04-26T08:00:00Z", "cybersecurity": "2026-04-26T08:01:12Z" },
  "lastReportAt": "2026-04-26T09:15:00Z",
  "pendingJobs": 0
}
```

## 成本追踪

每次 LLM 调用后，`llm-provider.mjs` 返回 usage 对象：

```js
{
  model: 'claude-sonnet-4-6',
  inputTokens: 1200,
  cacheReadTokens: 800,
  outputTokens: 350,
  estimatedCostUSD: 0.008   // 按标牌价估算
}
```

调用方把 usage 累加到当前 step 的 `_meta.llm`，最终汇总到 `meta.json`。

成本估算参考（Sonnet 4.6 标牌价）：

| Token 类型 | 单价 |
|---|---|
| input | $3 / 1M |
| cache_read | $0.3 / 1M |
| output | $15 / 1M |

## 本地查看方式

```bash
# 实时跟踪日志
tail -f logs/app.log | jq .

# 查看今日审计事件
cat logs/audit.jsonl | jq 'select(.ts | startswith("2026-04-26"))'

# 查看今日 LLM 成本汇总
cat logs/audit.jsonl | jq '[select(.event | endswith(".complete")) | .data.llmCost.estimatedUSD] | add'

# 查看流水线中间产物元数据
cat data/2026-04-26/deduped.json | jq ._meta
```

## 扩展方向（暂不做）

- OpenTelemetry 导出（等系统稳定后再接）
- Grafana / 自建 dashboard（本地 jq 够用时不引入）
- 分布式 trace（单机运行暂不需要）
