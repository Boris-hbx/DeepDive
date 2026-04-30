# Observability 规范

> 适用范围：`experiments/Wei/` 下所有模块。
> 目标：让每次运行的行为可追溯、问题可定位、成本可感知。

## 原则

1. **每步落盘**：流水线每个阶段的输入/输出都写到磁盘，不做内存直通
2. **结构化日志**：日志用 JSON 结构输出，便于后续分析
3. **成本可见**：每次 LLM 调用记录 token 用量和估算成本
4. **失败可重跑**：任何步骤失败只需重跑该步，不从头来

## 日志级别

| 级别 | 用途 | 示例 |
|---|---|---|
| `INFO` | 正常流程里程碑 | 抓取完成、LLM 调用成功 |
| `WARN` | 可恢复的异常 | 单源抓取失败、单条 LLM 解析失败 |
| `ERROR` | 不可恢复的错误 | API key 无效、磁盘写入失败 |
| `DEBUG` | 调试细节（默认关闭） | 每条 prompt 内容、原始响应 |

开启 DEBUG：`LOG_LEVEL=debug node insight-cli.mjs ...`

## 日志格式

每条日志输出到 stdout，JSON 单行：

```json
{
  "ts": "2026-04-26T10:23:45.123Z",
  "level": "INFO",
  "module": "fetcher",
  "msg": "fetch completed",
  "data": {
    "source": "Simon Willison",
    "items": 12,
    "durationMs": 843
  }
}
```

必填字段：`ts`、`level`、`module`、`msg`。
`data` 可选，放结构化上下文，不要把敏感信息（API key、密码）放进去。

## 中间产物落盘规范

路径：`data/YYYY-MM-DD/<step>.json`

| 步骤 | 文件 | 内容 |
|---|---|---|
| fetch | `raw.json` | 所有源原始条目 `RawItem[]` |
| dedup | `deduped.json` | 去重后条目 `UniqueItem[]` |
| rank | `ranked.json` | 每条带 score + reason |
| summarize | `summaries.json` | 每条带 short + long |
| brief | `briefs/YYYY-MM-DD/brief.md` | 最终 brief Markdown |
| report | `reports/YYYY/MM/DD/<slug>.md` | 课题综述 Markdown |

每个 JSON 文件头部附加元数据：

```json
{
  "_meta": {
    "generatedAt": "2026-04-26T10:23:45Z",
    "step": "dedup",
    "inputCount": 87,
    "outputCount": 23,
    "durationMs": 12
  },
  "items": [...]
}
```

## LLM 调用观测

每次 LLM 调用完成后，在对应步骤的 JSON 文件 `_meta` 中追加：

```json
"llm": {
  "model": "claude-sonnet-4-6",
  "calls": 23,
  "inputTokens": 32598,
  "cacheReadTokens": 13134,
  "outputTokens": 12075,
  "estimatedCostUSD": 0.42,
  "durationMs": 329000
}
```

成本估算公式（Sonnet 4.6 标牌价）：
- input: $3/1M tokens
- cache_read: $0.3/1M tokens
- output: $15/1M tokens

## 健康检查

`server.mjs` 暴露 `GET /health`，返回：

```json
{
  "status": "ok",
  "uptime": 3600,
  "lastBriefAt": "2026-04-26T08:00:00Z",
  "lastReportAt": "2026-04-26T09:15:00Z"
}
```
