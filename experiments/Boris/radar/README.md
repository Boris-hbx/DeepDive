# Agentic SE Project Radar

Boris 工程的 OSS 项目情报库，持续跟踪 agentic SE 生态（AI 编程助手 / 代码 agent / SWE-bench 等）的早期项目和新动态。

## 文件索引

| 文件 | 内容 | 用途 |
|------|------|------|
| `2026-04-26-radar.md` | 首次全量扫描，~95 个 OSS repo 按 9 类别归档 | 基线参考 |
| `2026-04-26-deepdive.md` | 6 个早期重点候选的深度卡片 | 重点跟踪对象的"档案" |
| `weekly/YYYY-MM-DD-increment.md` | 每周增量（首期约 2026-05-03） | 一周内的变化 |

## 周增量扫描流程

每周日或周一跑一次，关注以下三类变化：

### 1. 重点候选状态变化

对 deepdive 里的每个候选追踪：
- 一周内的 commit 数 / release / 主要 PR
- 是否有 contributor 变动、原作者是否沉默
- issue 高峰 / 新功能讨论
- 商业化动作（融资、产品发布、价格变化）

### 2. 基线 radar 项目变化

对 `2026-04-26-radar.md` 中所有 active 项目扫一遍：
- ⬆️ 新晋活跃（如 early 项目突然增 commit）
- ⬇️ 沉默或归档
- 🔥 star 异常上涨

### 3. 新发现

用 radar 中相同的检索通道（GitHub topics / awesome 清单 / SWE-bench leaderboard / 关键词搜索）扫**最近一周创建**的 repo，挑出 agentic SE 相关的。

## 输出格式（建议模板）

```markdown
# Week of YYYY-MM-DD ~ YYYY-MM-DD

## 1. 重点候选状态
- **Live-SWE-agent**：本周 X commits，Y release（链接），主要变化…
- ...

## 2. 基线项目变化
- ⬆️ 新晋活跃：项目 X（理由）
- ⬇️ 沉默/归档：项目 Y（最后 commit 距今 N 天）
- 🔥 异常上涨：项目 Z（star 一周 +N）

## 3. 新发现
| Name | Repo | 一句话 | 初步评级 |
| ---- | ---- | ----- | ------- |
| ... | ... | ... | early/mid/mature |

## 4. 推荐：本周升降级
- 提名加入深度跟踪：项目 X（理由）
- 移出深度跟踪：项目 Y（理由）

## 5. 本周 callout（可入日报的点）
- ...
```

## 如何触发

### 手动（当前默认）

让 AI 重跑，提示词模板：

> 跑 agentic SE 周增量，覆盖到 YYYY-MM-DD（最近 7 天）。
> 参照 `experiments/Boris/radar/README.md` 的流程，
> 跟踪 `2026-04-26-deepdive.md` 里的 6 个重点候选 +
> 扫 `2026-04-26-radar.md` 基线项目变化 + 新发现。
> 结果存到 `experiments/Boris/radar/weekly/YYYY-MM-DD-increment.md`。

### 自动（可选）

如想固化为定时任务，用 Claude Code 的 `/schedule` 命令注册每周定时 agent。
**注意**：远程 agent 会产生 API 费用（每次约 $0.5-2 不等，看调研深度）。
建议先手动跑 2-3 周看产出质量再决定是否自动化。

## 命名约定

- **全量重扫**：`YYYY-MM-DD-radar.md`（每季度或主题大变时跑一次）
- **深度卡片**：`YYYY-MM-DD-deepdive.md`（首次基线 + 候选名单大改时）
- **周增量**：`weekly/YYYY-MM-DD-increment.md`（日期为该周日）

## 与日报 pipeline 的关系

radar 是**日报输入源的补充**，不替代 RSS 订阅：
- RSS（`config/sources.yaml`）抓的是**已发文章**
- radar 跟的是**项目动态**（新 repo、commit 节奏、release）

后续 fetch 阶段可以加一个 collector，从 radar 的"重点候选"列表抓 GitHub release / 重要 commit 作为 brief 的额外信号。这是后续可做的扩展，不在第一周 MVP 范围。
