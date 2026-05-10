# Spec: Boris 自动化基础设施（daily brief + weekly radar）

- 状态：**草稿（待 Boris 评审）** — AI 起草于 2026-04-26
- 作者：Boris + Claude（草稿）
- 日期：2026-04-26
- 关联：[`spec.md`](./spec.md)（daily brief MVP）、[`radar/README.md`](./radar/README.md)（weekly 增量流程）、[`radar/analysis/2026-04-26-part-7-synthesis.md`](./radar/analysis/2026-04-26-part-7-synthesis.md)（weekly 方法论来源）

## 目标

为 Boris 的 agentic SE 洞察工程建一套**最小但可演进**的自动化基础设施，覆盖：

1. **每日 brief 自动产出**（`spec.md` MVP 的延续）
2. **每周 radar 增量自动产出**（`radar/README.md` 已有手动流程，本 spec 把它自动化）
3. 两条线**共享同一套基础设施**（调度 / LLM 调用 / 存档 / 通知 / review checkpoint）

**核心约束**：不追"全自动化极致"，按 L1 → L2 → L3 三步走，每步跑稳 2-4 周再升级。L4/L5 不在本 spec 范围。

## 用户故事

作为 Boris：
1. **早上 9 点打开邮箱/Slack**，看到当日 brief 的链接（自动跑完已部署）
2. **每周一上午**，看到 weekly radar 增量报告 PR，扫一眼 approve 即合并
3. **任何时候**能用 `git log` 复现"为什么本周升级了 X 项目、降级了 Y 项目"
4. **任何时候**能干预：手动改 watchlist、临时禁某个源、强制重跑

## 验收条件

### L1 验收（daily brief 自动化）—— 当前重点
- [ ] 每天 UTC 00:00 ± 1h GitHub Actions 自动触发 brief pipeline
- [ ] 跑通 `fetch → dedup → rank → summarize → critique → render` 不报错
- [ ] 生成的 `experiments/Boris/briefs/YYYY-MM-DD.md` 自动 commit + 部署到 GitHub Pages
- [ ] **失败 fail-soft**：单源失败不阻塞、蓝军失败不阻塞主 brief
- [ ] **成本可观测**：每次跑完在 commit message 或 NOTES.md 记录 token 消耗
- [ ] **可手动触发**：workflow 支持 `workflow_dispatch` 让 Boris 在 UI 点按钮重跑
- [ ] **可回放**：中间产物落 `experiments/Boris/data/YYYY-MM-DD/` 且 commit

### L2 验收（加 radar 信号源）—— L1 跑稳 2 周后开
- [ ] `radar-collector.ts` 每天扫 watchlist 中 ≤ 15 个 repo（来自 `radar/watchlist.yaml`，新文件）
- [ ] 抓 GitHub releases / 最近 commit / star 异常（7 天 +N% 阈值）/ 新 issue 高峰
- [ ] radar 信号和 RSS 文章并入同一个 dedup → rank 队列（不分两条 pipeline）
- [ ] brief 渲染时 radar 信号可识别（如加 `🔭` emoji 或独立子段）

### L3 验收（self-evolving radar）—— L2 跑稳 4 周后开
- [ ] 每周一 UTC 02:00 自动跑 weekly radar 增量
- [ ] 输出 `radar/weekly/YYYY-MM-DD-increment.md`（结构见 `radar/README.md`）
- [ ] **自动改 `radar/watchlist.yaml`**：新晋活跃项目升级、停滞项目降级
- [ ] **review checkpoint**：watchlist 修改作为 PR 提交（branch `radar/auto-YYYY-MM-DD`），不直接 push main
- [ ] Boris approve 该 PR 才合入；不 approve 不影响下一次跑
- [ ] PR 描述自动列出"本周升降级清单 + 数据依据"

### 跨层级验收
- [ ] **review 分支策略**：所有自动产出默认 commit 到 `auto/YYYY-MM-DD` 分支；Boris approve 才到 main
- [ ] **预算上限**：每月 LLM 费用不超过 $30；超过时 GitHub Actions 自动暂停并发 issue
- [ ] **观察期**：每个 L1/L2/L3 升级后第一周，每天 Boris 必须人工 review 至少 1 次产出再决定继续

## 输出契约

**daily brief**：完全照搬 `spec.md` 已定义的输出契约，本 spec 不变动。
**weekly radar 增量**：完全照搬 `radar/README.md` 的输出格式，本 spec 不变动。
**自动化层**：不引入新的输出格式，只搬 + 加元数据（生成时间、token 消耗、源数据 hash）。

## 技术架构

### 5 层路径

```
L0 全手动                — Boris 每天自己写
L1 fetch→summarize 直线  ← 当前阶段（Boris spec.md MVP）
L2 加 radar 信号源       ← 下一阶段（L1 稳定后 2 周）
L3 self-evolving radar   ← 远期（L2 稳定后 4 周）
L4 完全自主选题          ← 不在本 spec 范围
L5 多 agent 编排          ← 不在本 spec 范围
```

### 4 个核心组件（贯穿 L1-L3）

| 组件 | 职责 | L1 实现 | L2 增量 | L3 增量 |
|------|------|---------|---------|---------|
| **调度** | 决定何时跑 | GitHub Actions cron + workflow_dispatch | 同 L1 | 加 weekly cron |
| **LLM 调用** | 喂 prompt 出结果 | `@anthropic-ai/sdk` 直接调 | 同 L1（共享 client） | 同 L1 |
| **存档** | 持久化产出 + 中间数据 | 自动 commit 到 git | 同 L1 | watchlist 改动作为 PR |
| **通知** | 让 Boris 知道有产出 | brief URL push 到 GH Pages | 同 L1（可加 email） | weekly PR 邮件提醒 |

### 调度机制对比（已选 GitHub Actions）

| 机制 | 触发 | 成本 | 适用 | 选/不选 |
|------|------|------|------|---------|
| **GitHub Actions cron** | repo 内 `.yml` | API 费 ~$1/次 | 长期主流 | **✅ 已选** |
| Claude Code `/schedule` | CLI 注册远程 agent | API 费 + 订阅 | 实验期快速试 | ❌ 锁定 Claude Code |
| 本地 cron + claude CLI | OS 级（Task Scheduler / launchd） | API 费 | 单机自用 | ❌ 要 Boris 电脑 24/7 开 |
| 完全手动 | Boris 提示 | 0 | 当前默认 | ❌ 不可持续 |

**为什么选 GitHub Actions**：
- DeepDive 已在 GitHub
- Commit 历史 = 天然存档
- secret 管理已有（`ANTHROPIC_API_KEY`）
- spec.md 已规划 `deploy-Boris-pages.yml` 同模式
- 加一个新 workflow 边际成本最低

### Workflow 文件结构（建议）

```
.github/workflows/
├── deploy-Boris-pages.yml     ← 已规划（在 spec.md 里）
├── boris-daily-brief.yml      ← L1 新增：每天跑 brief pipeline
└── boris-weekly-radar.yml     ← L3 新增：每周跑 radar 增量
```

`boris-daily-brief.yml` 草稿（约 50 行 yml）：
- on: schedule(cron) + workflow_dispatch
- jobs: setup-node → npm ci → run pipeline → commit briefs/ + data/ → trigger pages deploy
- env: ANTHROPIC_API_KEY from secrets
- outputs: token usage 写到 step summary

`boris-weekly-radar.yml` 草稿（约 60 行 yml）：
- on: schedule(每周一 UTC 02:00) + workflow_dispatch
- jobs: setup → run weekly increment script → 创建 PR 到 main（不 push main）
- 用 `peter-evans/create-pull-request@v6` 之类的 action

> ⚠️ 这两个 workflow 文件落在仓库根（`.github/`），同 `deploy-Boris-pages.yml` 一样需要 PM exception（你就是 PM，自批）。

### Watchlist 文件（L2 引入）

`experiments/Boris/radar/watchlist.yaml`，结构：

```yaml
# 周扫名单（来自 Phase 7 第 6.1 节）
weekly:
  - repo: ComposioHQ/composio
    archetype: 5-infra
    why: Series A $25M，看 Series B 信号
    signals: [release, fundraise-news, integration-with-runtime]
  - repo: Ataraxy-Labs/sem
    archetype: 5-infra
    why: agent-native infra 路线代表
    signals: [release, contributor-spike]
  # ... 共 8-12 个

biweekly:
  # 6-10 个，次优先级

dropped:
  # 已降级清单，留给可观测性
  - repo: Live-SWE-agent/...
    reason: 3 月无 commit
    dropped_at: 2026-04-26
```

L3 时 weekly 增量自动改这个文件并提交 PR。

## 流水线设计

### L1 - daily brief（已有 spec.md，本节只补"自动化层"细节）

```
GitHub Actions cron (UTC 00:00)
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  pipeline runner (sees env.ANTHROPIC_API_KEY)             │
│                                                            │
│  fetch → dedup → rank → summarize → critique → render     │
│   │       │      │      │           │           │         │
│   └───────┴──────┴──────┴───────────┴───────────┘         │
│         所有中间产物落到 data/YYYY-MM-DD/                   │
└──────────────────────────────────────────────────────────┘
     │
     ▼
git commit + push → GH Pages 部署 → Boris 看到链接
```

### L2 - 加 radar collector

```
fetch (RSS) ─┐
             ├──> 合并 ──> dedup ──> rank ──> summarize ──> ...
radar-       │
collector ───┘
(scan watchlist
 GitHub API)
```

`radar-collector.ts` 输出与 RSS fetcher 同形态的 `CollectedItem[]`，让 dedup/rank 透明处理。

### L3 - weekly radar 增量 + watchlist self-evolution

```
GitHub Actions cron (每周一 UTC 02:00)
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  weekly-radar runner                                      │
│                                                            │
│  1. 读 radar/watchlist.yaml                                │
│  2. 对每个 weekly 项目跑 gh CLI 抓近 7 天数据              │
│  3. 对 radar/2026-04-26-radar.md 全量扫"是否有变化"        │
│  4. 用关键词搜索新出现的 agentic SE repo                    │
│  5. LLM 综合 → 生成 radar/weekly/YYYY-MM-DD-increment.md   │
│  6. 计算 watchlist 升降级建议                               │
│  7. 修改 radar/watchlist.yaml                              │
└──────────────────────────────────────────────────────────┘
     │
     ▼
创建 PR (branch: radar/auto-YYYY-MM-DD)
     │
     ▼
Boris review → approve → merge → next week 用新 watchlist
```

## 工作目录变更

新增（在 spec.md 已规划的目录之外）：

```
.github/workflows/
├── boris-daily-brief.yml      ← L1
└── boris-weekly-radar.yml     ← L3

experiments/Boris/
├── radar/
│   ├── watchlist.yaml         ← L2 新增
│   └── weekly/                ← L3 自动产出落这
│       └── YYYY-MM-DD-increment.md
└── scripts/
    └── radar-collector.ts     ← L2 新增（与现有 fetch.ts 同目录）
```

不动 spec.md 已规划的任何文件。

## 部署

L1：复用 spec.md 已规划的 `deploy-Boris-pages.yml`（push 触发）。`boris-daily-brief.yml` commit 后自然触发 pages 部署。

L2：无新增部署。

L3：weekly 增量是 PR 流，不直接部署。Boris approve 合入 main 后，可选触发 pages 重新部署（让 weekly 报告也上 Pages）。

## 不做什么

- ❌ **L4 / L5**（完全自主选题 / 多 agent 编排）—— 不在本 spec 范围。Phase 7 反模式 9 已实锤"过早全自动化的 SE agent 都死了"
- ❌ **直接 push main 自动产出** —— 全部走 review 分支或 PR
- ❌ **本地 cron / 本机 daemon** —— 依赖 Boris 电脑 24/7
- ❌ **任何商业 SaaS（Zapier / Make / n8n）** —— 把流程外推到第三方平台
- ❌ **多 agent 编排框架（LangGraph / CrewAI）** —— 与 spec.md 一致
- ❌ **新 LLM provider 接入** —— 全程 Anthropic（与 spec.md 一致）
- ❌ **自建 webhook server** —— GitHub Actions 已经够
- ❌ **修改 spec.md 已定义的输出契约** —— 本 spec 是 wrapper，不动 contract
- ❌ **改 `experiments/Boris/` 之外的代码**，**除了** 两个新 workflow 文件（同 spec.md 的 PM exception）

## 设计要点 / 约束

- **review-by-default**：自动产出全部默认到 review 分支或 PR；不 approve 不进 main
- **预算上限**：每月 LLM 费用不超过 $30，超时 GH Actions 暂停 + 自动发 issue
- **观察期硬要求**：每个 L1/L2/L3 升级后第一周，每天 Boris 必须 review 至少 1 次
- **fail-soft 全程**：任何单步失败不阻塞主流程
- **可观测性**：每次跑完输出 token 消耗、各步耗时；commit message 含核心元数据
- **可干预**：所有 cron 都同时支持 `workflow_dispatch`；watchlist 是普通 yaml 文件 Boris 随时改
- **不引入新依赖**前先问 —— 但本 spec 已批准的依赖（`@anthropic-ai/sdk`、`peter-evans/create-pull-request`）视为已确认

## 失败模式预案

| 失败 | 自动反应 | 通知方式 |
|------|---------|---------|
| 单 RSS 源 fetch 失败 | 跳过该源继续 | 落 NOTES.md，无通知 |
| LLM 调用 timeout | 重试 1 次后跳过该步 | step summary 标红 |
| 蓝军 critique 失败 | 跳过 critique 段，主 brief 照常出 | step summary 标红 |
| 当日所有源加起来 < 4 分条目数为 0 | 用兜底文案（spec.md 已定义） | step summary 标黄 |
| LLM 月预算超 | 暂停 cron，发 issue | GitHub issue + email |
| weekly PR 创建失败 | 写日志，不阻塞下周 | issue |

## 开放问题（待 Boris 答）

- [ ] **L1 启用时间**：`spec.md` MVP 跑通后立即启自动化，还是手动跑 1 周再开 cron？
- [ ] **触发时间**：UTC 00:00 / Beijing 08:00 / 或其它？
- [ ] **预算上限 $30/月** 够不够？要不要先卡 $10/月做 L1？
- [ ] **L2 引入时机**：L1 稳定 2 周是硬约束还是建议？
- [ ] **L3 watchlist 自动改**：是否同时让 Boris 收到邮件 / Slack 通知，还是只看 GitHub PR 提醒？
- [ ] **review 分支策略**：`auto/YYYY-MM-DD` 还是 `radar/auto-...` 还是统一前缀？
- [ ] **失败通知渠道**：只在 GitHub issue 还是要 email？要不要接 Boris 的 Telegram？

## 时间盒（建议）

- 今天起 1 周：spec.md MVP 跑通（这是 L1 前提）
- 接下来 1 天：本 spec 评审 + 决策定稿 + 写 `boris-daily-brief.yml`
- L1 自动化跑 2 周观察期 → L2 开发（约 1 天）
- L2 跑 4 周观察期 → L3 开发（约 2-3 天）
- L3 跑 8 周后回头评估是否继续向 L4 推进（**默认不**）

## 决策定稿（待填）

> Boris 评审后把"建议默认"列收掉，落实成单选写在这里。

- 调度机制：⬜ GitHub Actions / ⬜ Claude Code schedule / ⬜ 其他
- 触发时间：⬜ UTC 00:00 / ⬜ Beijing 08:00 / ⬜ 其他 ____
- 月预算上限：⬜ $30 / ⬜ $10 / ⬜ 其他 ____
- L2 触发条件：⬜ L1 稳定 2 周 / ⬜ Boris 主动触发
- L3 watchlist 自动改：⬜ 全自动 PR / ⬜ 仅产报告，watchlist 仍人工改
- 失败通知：⬜ 仅 GitHub issue / ⬜ +email / ⬜ +Telegram

## 给后续 weekly 增量做这事的输入

如果 weekly radar 增量也用本 spec 的 L3 实现，**Phase 7 第 7 节已经给出方法论清单**。本 spec 不重复。
