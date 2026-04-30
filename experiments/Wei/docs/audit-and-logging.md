# 审计与日志规范

> 适用范围：`experiments/Wei/` 下所有模块。
> 目标：关键操作留痕，问题发生后能还原现场。

## 审计事件清单

以下操作必须写审计日志，路径：`logs/audit.jsonl`（每行一个 JSON）：

| 事件 | 触发时机 | 必填字段 |
|---|---|---|
| `report.generate.start` | 开始生成课题综述 | topic, domain, triggeredBy |
| `report.generate.complete` | 综述生成完成 | reportId, durationMs, llmCost |
| `report.generate.failed` | 综述生成失败 | topic, error, step |
| `brief.generate.start` | 开始生成每日 brief | domain, date, triggeredBy |
| `brief.generate.complete` | brief 生成完成 | domain, date, itemCount, llmCost |
| `brief.generate.failed` | brief 生成失败 | domain, date, error, step |
| `feedback.submit` | 用户提交反馈 | reportId, type, saveAsSkill |
| `skill.save` | Skill 保存 | skillId, keywords, sourceReportId |
| `report.regenerate` | 基于反馈重新生成 | reportId, feedbackCount |
| `followup.start` | 开始交互式追问 | parentReportId, round |
| `followup.complete` | 追问完成 | reportId, parentReportId, round |
| `server.start` | 服务器启动 | port, version |
| `cron.trigger` | 定时任务触发 | jobName, scheduledAt |

## 审计日志格式

```json
{
  "ts": "2026-04-26T10:23:45.123Z",
  "event": "report.generate.complete",
  "sessionId": "sess_abc123",
  "data": {
    "reportId": "2026-04-26-ai-code-agent",
    "topic": "AI Code Agent 架构演进",
    "domain": "software-engineering",
    "durationMs": 42300,
    "llmCost": {
      "inputTokens": 18500,
      "outputTokens": 3200,
      "estimatedUSD": 0.10
    }
  }
}
```

禁止写入审计日志的内容：
- API key、密码、token
- 用户输入的完整 prompt 原文（摘要可以）
- 个人身份信息

## 日志文件管理

| 文件 | 内容 | 保留策略 |
|---|---|---|
| `logs/audit.jsonl` | 审计事件流水 | 永久保留，只追加 |
| `logs/app.log` | 应用运行日志 | 保留最近 30 天 |
| `data/YYYY-MM-DD/` | 流水线中间产物 | 保留最近 14 天 |
| `reports/` | 生成的报告 | 永久保留 |
| `briefs/` | 每日 brief | 永久保留 |

`logs/` 和 `data/` 已加入 `.gitignore`，不入库。`reports/` 和 `briefs/` 入库。

## 运行时日志实现

`lib/logger.mjs` 提供统一日志接口：

```js
import { logger } from './lib/logger.mjs';

// 普通日志
logger.info('fetcher', 'fetch completed', { source: 'Simon Willison', items: 12 });
logger.warn('dedup', 'jaccard threshold miss', { title: '...', score: 0.55 });
logger.error('llm-provider', 'API call failed', { error: err.message, attempt: 2 });

// 审计日志（同时写 audit.jsonl）
logger.audit('report.generate.complete', { reportId, durationMs, llmCost });
```

`logger.audit()` 同时输出到 stdout（INFO 级别）和 `logs/audit.jsonl`。

## 错误分类

| 类型 | 处理方式 | 是否写审计 |
|---|---|---|
| 单源抓取失败 | WARN + 跳过该源，继续其他源 | 否 |
| 单条 LLM 解析失败 | WARN + graceful skip，重试 1 次 | 否 |
| LLM 429 限流 | 指数退避重试（1s/2s/4s），最多 3 次 | 否 |
| 整批 LLM 失败 | ERROR + 写审计 `*.failed` 事件 | 是 |
| 磁盘写入失败 | ERROR + 写审计 + 终止当前任务 | 是 |
| API key 无效 | ERROR + 写审计 + 终止进程 | 是 |

## Session ID

每次 `insight-cli.mjs` 或 server 处理一个请求，生成一个 `sessionId`（`sess_` + 8位随机hex），贯穿该次任务的所有日志，便于跨模块追踪同一次运行。
