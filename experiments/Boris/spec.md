# Spec: Boris 的 MVP 实现

- 状态：**草稿（待 Boris 评审）** — AI 起草于 2026-04-26
- 作者：Boris + Claude（草稿）
- 日期：2026-04-26
- 关联：[`spec/mvp.md`](../../spec/mvp.md)、[`spec/product.md`](../../spec/product.md)、姊妹实现 [`experiments/Dong/spec.md`](../Dong/spec.md)

## 目标

本周内跑通一条端到端流水线，每天能在 `experiments/Boris/daily-report/` 下产出 1 篇符合 [输出契约](../../spec/mvp.md#输出契约所有人必须一致) 的 brief，并通过 GitHub Actions 自动部署到 `https://boris-hbx.github.io/DeepDive/Boris/`。

**差异化打法**：在标准 brief 之上，引入 **「蓝军 Agent」二次反驳** —— 对每条「最关注的事」，让一个独立 prompt 的 Agent 挑毛病、列反例、戳隐含假设，作为同条目的 critique 副栏展示。灵感来自 `C:\Project\DeepInsight\experiments\hello-fly\src\app\api\insight\route.ts:14-23`。

## 用户故事

作为 Boris，我打开 `https://boris-hbx.github.io/DeepDive/Boris/`，能看到当日 brief：左栏是符合输出契约的「最关注 / 值得一看」，右栏（或折叠区）是蓝军对每条的反驳。每条要点能点回原文。

## 验收条件

mvp.md 已有的（沿用，一字不改）：

- [ ] 至少跑出 1 篇真实数据生成的 brief
- [ ] brief 文件位置和命名符合输出契约（`experiments/Boris/daily-report/YYYY-MM-DD.md`）
- [ ] brief 章节结构符合输出契约
- [ ] 每条要点都有可点击的原文链接
- [ ] 当日无重要事件时使用兜底文案
- [ ] 静态站点能本地预览，能从首页点进当天的 brief
- [ ] `experiments/Boris/NOTES.md` 已写
- [ ] 已 push 到本仓库（**仅在 `experiments/Boris/` 子目录下**）

我自己加的：

- [ ] 一条命令能从零跑出当日 brief（`npm run brief` 或 `pnpm brief`）
- [ ] 蓝军反驳能与原报告对齐（每条 critique 引用原报告里**真实写过**的话，不造稻草人）
- [ ] 蓝军挂掉不阻塞主 brief 输出（fail-soft，照搬 hello-fly 的 `critiqueError` 模式）
- [ ] 链接准确性：brief 里的 URL 全部从 fetch 阶段透传，**不让 LLM 写 URL**
- [ ] 部署到 GitHub Pages /Boris/ 子目录成功（push 后 5 分钟内访问 URL 能看到当日 brief）

## 输出契约

**完全照搬 [`spec/mvp.md`](../../spec/mvp.md#输出契约所有人必须一致)，本 spec 不做任何变动。**

蓝军反驳作为**额外章节**，不污染契约结构。建议 brief 末尾加：

```markdown
## 蓝军反驳（实验性 — Boris 自加）

### 反驳 #1
原观点「<引用原 brief 中具体说法>」
反驳：<反例 / 边界 / 反向证据>

### 反驳 #2
...
```

## 技术栈（**待 Boris 确认**）

> 默认建议倾向"借 hello-fly 的代码 + 走静态导出"，最大化复用且符合 MVP gh-pages 部署。Boris 选定后把"建议"列收掉。

| 维度 | 建议默认 | 备选 | 备注 |
|---|---|---|---|
| 语言 | TypeScript | Python | 复用 hello-fly 的 SDK 调用代码 |
| 站点 | **Next.js 16 + `output: 'export'`**（静态导出） | Astro、纯 HTML、Vite + React | 复用 hello-fly 的 React 组件代码；导出后能直接 push 到 gh-pages |
| LLM | Anthropic Claude（Opus 4.7 默认） | Sonnet 4.6 | hello-fly 已用 Opus；难度差不大 |
| LLM SDK | `@anthropic-ai/sdk`（已在 hello-fly 用） | `openai` 兼容协议 | 直接复用错误处理代码 |
| RSS / HTTP 抓取 | `rss-parser` + `undici` | `feedparser` (Py) | TS 生态轻量选项 |
| HTML 正文抽取 | `@mozilla/readability` + `jsdom` | 不抽取，吃 RSS summary | 视源情况 |
| 去重 | URL 规范化 + 标题 fuzzy（`fastest-levenshtein`） | embedding 聚类 | 第一周简单 |
| 流水线触发 | **构建时一次性跑**（`tsx scripts/run.ts`），输出 .md → Next.js 读取 → static export | server route（hello-fly 模式） | spec 不允许动态后端；必须改成离线跑 |
| 部署 | GitHub Actions workflow，照抄 Dong 的 `deploy-dong-pages.yml`，改名 `deploy-Boris-pages.yml` | gh-pages CLI 手推 | 自动化、与团队约定一致 |
| 配置 | `sources.yaml` | 写死 | 信息源走配置文件 |
| 包管理 | `npm` | `pnpm`、`bun` | 与 hello-fly 一致即可 |

**Boris 你需要回答：**

1. **TypeScript / Next.js 是否定下来？** 决定后续所有依赖。
2. **LLM 模型用哪个？** Opus 4.7 强但慢且贵，Sonnet 4.6 性价比更高；这周是 demo 不是产品，建议默认 Sonnet 4.6 + 在蓝军环节切 Opus。
3. **信息源**：要不要直接复用 Dong 选过的 5 个（DeepMind / OpenAI / Simon Willison / GitHub Blog / Latent Space）？还是你想换 / 加几个？
4. **API key**：本机有 `ANTHROPIC_API_KEY` 吗？workflow 里会用 `secrets.ANTHROPIC_API_KEY` —— 要在 GitHub repo 的 Settings → Secrets 里加（这个动作得你来做，我没权限）。

## 流水线设计

```
┌────────┐   ┌───────┐   ┌──────┐   ┌──────────┐   ┌──────────┐   ┌────────┐
│ fetch  │──▶│ dedup │──▶│ rank │──▶│summarize │──▶│ critique │──▶│ render │
└────────┘   └───────┘   └──────┘   └──────────┘   └──────────┘   └────────┘
   N 个源     URL+标题    LLM 打分    LLM 写每条       蓝军挑刺      .md + Next
   并发拉      fuzzy      ≥阈值      要点摘要        每条反驳        static export
                          才进
```

每步落盘到 `experiments/Boris/data/YYYY-MM-DD/<step>.json`，便于调试。

**关键决策点（建议默认）：**

- **重要性判定**：单条 LLM 给 1–5 分 + 1 句理由；阈值 ≥ 4 进「最关注」、3 进「值得一看」、< 3 丢弃（与 Dong 对齐，便于横评）
- **诚实兜底**：当日所有源加起来 ≥ 4 分的条目数为 0 → 用兜底文案；蓝军环节也跳过
- **链接准确性**：所有 URL 从 fetch 透传，LLM 只写文字
- **prompt 多步**：先逐条评分+摘要 → 合成 brief → 蓝军基于 brief 反驳
- **蓝军 prompt**：直接照搬 hello-fly 的 `CRITIQUE_SYSTEM`（`route.ts:14-23`），明确"不能造稻草人"

**Boris 你需要：** 这套流水线 OK 吗？哪步想换思路？

## 工作目录建议

```
experiments/Boris/
├── spec.md              ← 本文件
├── NOTES.md             ← 实践笔记（mvp.md 必交）
├── daily-report/        ← 输出物（日报归档）
│   └── YYYY-MM-DD.md
├── site/                ← Next.js 项目
│   ├── package.json
│   ├── next.config.ts   ← output: 'export'
│   ├── src/app/
│   │   ├── page.tsx     ← 首页（brief 列表）
│   │   └── reports/[slug]/page.tsx ← 单篇 brief
│   └── public/
├── scripts/             ← 流水线（TS + tsx 跑）
│   ├── run.ts           ← 一键入口
│   ├── fetch.ts
│   ├── dedup.ts
│   ├── rank.ts
│   ├── summarize.ts
│   ├── critique.ts      ← 蓝军，差异化点
│   └── render.ts        ← 写 brief.md
├── data/                ← 中间产物（gitignore 大部分）
│   └── YYYY-MM-DD/
├── config/
│   └── sources.yaml
├── prompts/             ← system prompt 模板
│   ├── rank_system.md
│   ├── summarize_system.md
│   └── critique_system.md
└── .env.example
```

## 部署

按 Dong 的模板照抄一份新 workflow：`.github/workflows/deploy-Boris-pages.yml`

- 触发：`paths: ['experiments/Boris/**', '.github/workflows/deploy-Boris-pages.yml']`
- 构建：`cd experiments/Boris/site && npm ci && npm run build`（Next.js static export 输出到 `out/`）
- 部署：`peaceiris/actions-gh-pages@v4`，`destination_dir: Boris`，`keep_files: true`
- API key：用 GitHub Actions secret `ANTHROPIC_API_KEY` 注入构建环境（构建时跑 LLM 流水线）

> ⚠️ 这要求你在 repo Settings → Secrets and variables → Actions 添加 `ANTHROPIC_API_KEY`。我没权限改这个，得你做。

> ⚠️ 同 Dong 的备忘 #7：workflow 文件落在仓库根（`.github/`），严格读 mvp.md「仅在 `experiments/<你的名字>/` 子目录下」需 PM exception。Boris 你就是 PM，自批即可。

## 不做什么

- ❌ fly.io 部署 / Docker / 任何动态后端 — spec 明确 ❌「动态后端」；hello-fly 的 fly 那套留作未来路线
- ❌ 用户登录 / 认证
- ❌ 自动定时调度（cron 之外的） — workflow 监听 push 即可，本周不引 schedule
- ❌ 数据库 — JSON 文件够
- ❌ 邮件 / IM 推送
- ❌ 历史 brief 全文搜索
- ❌ 高级去重（embedding 聚类） — 第一周 fuzzy 标题
- ❌ 在 `experiments/Boris/` 之外动任何文件，**除了** `.github/workflows/deploy-Boris-pages.yml`（同 Dong 的 PM exception）和 `docs/decisions.md` 追加一行
- ❌ 引入 multi-agent 编排框架 — 蓝军是单次串联调用，不是 LangGraph / CrewAI 那种

## 设计要点 / 约束

- **输出契约硬约束**：brief 文件位置、章节结构、原文链接，一字不改；蓝军章节是契约**之外**的额外章节
- **链接不让 LLM 生成**：URL 从抓取阶段透传
- **失败优雅降级**：单源抓取失败不影响其他；蓝军失败不影响主 brief（fail-soft）
- **可复跑**：中间产物落盘
- **成本可观测**：每跑一次记录 token 消耗到 NOTES.md
- **不引入新依赖前先问** — 但本 spec 列出的依赖批准后视为已确认

## 开放问题（待 Boris 答）

- [ ] 蓝军章节放 brief 末尾还是和「最关注」内联？（影响阅读体验 + 输出契约的边界）
- [ ] 蓝军的 LLM 模型独立配置吗？还是和主洞察共用？
- [ ] 站点首页排序：按日期倒序就行，还是想加个"今日推荐"标签？
- [ ] 是否要把 hello-fly 的「双栏布局 + 配色」照搬过来当首页样式？还是先用最简单的列表？

## 时间盒

- 今天（2026-04-26）：spec 评审 + 决策定稿
- 明天起 3 天：实现 + 跑通 1 篇真实 brief + 部署成功
- 周末：填 NOTES.md + 复盘

## 决策定稿（待填）

> Boris 评审后把 1–4 节的"建议"收掉，落实成单一选项写在这里。
