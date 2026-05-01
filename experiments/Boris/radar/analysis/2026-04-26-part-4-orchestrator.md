# Parallel Agents 与 Orchestrator：YC 拥挤赛道、被 Cursor 釜底抽薪、和 conflict resolution 这件没人做的事

- 日期：2026-04-26
- 系列：Agentic SE 深度分析 **第 4/7 期**
- 依据数据：`./2026-04-26-part-1-landscape.md`（Phase 1 张力 2 / 反模式 6 / Archetype 4 词汇）+ `./2026-04-26-part-2-runtime.md`（Phase 2 runtime 派 4 家技术架构 + MCP 一等公民观察）+ `./2026-04-26-part-3-infra.md`（Phase 3 子类 A "Weave 是 parallel agents 的真痛点" 论断）+ `../2026-04-26-radar.md` 类别 6 + 类别 7 + 本期新拉的 GitHub API 元数据快照（2026-04-26）+ Cursor 3.2 changelog（2026-04-24）+ Anthropic 2026 Agentic Coding Trends Report + YC W26 demo day 第三方分析 + conductor.build Series A 公告 + Crystal README deprecation note
- 本期定位：**Archetype 4（Agent Orchestrator）派内对比 + parallel agents 这个 UX 形态本身的可疑性分析** —— 主轴 B（接触面）+ 轴 C（自治度），Phase 1 反模式 6 与 张力 2 的正面对决
- 字数：约 4500
- 主对比对象：Emdash、dmux、cmux、Crystal（→ Nimbalyst）
- 支撑对照：conductor、Agent Deck、ccmanager、Superset、HolyClaude、AionUi、open-cowork、OmoiOS、Open Sessions、HumanLayer/CodeLayer、Vibe Kanban（新发现）、oh-my-codex（新发现）、Composio agent-orchestrator（新发现）

---

## 0. 本期不是什么

不是"parallel agents 工具评测"。不是"哪个 orchestrator 最好用"。**本期回答两个结构性问题**：

1. **Phase 1 张力 2 那个论断"parallel agents 是继 chat、inline 之后的第三种 UX 标配"，到 2026-04-26 这个时间点是否还成立**？我的回答会 contrarian —— 它**已经在被证伪的过程中**，证据是 Cursor 3.2 在 2 天前（2026-04-24）的 changelog。
2. **Phase 1 反模式 6 那个"YC 押注同质化"如何兑现**？到本期日期，Crystal 已死、Vibe Kanban 已 sunsetting 转 OSS、HumanLayer 30 天 0 commit + 4 个月没 release。**4 个月内已经死了三个**。剩下的活跃项目里，有几个真在解决 conflict resolution，有几个只是在做 worktree 隔离 + tmux 多路复用？

这两个问题穿成一条主线：**parallel agents 这个赛道的 UX 价值是真的，但"独立 OSS orchestrator"不是这个价值的最优组织形态** —— 它会被 (a) 厂商 IDE 内化（Cursor 3.2 已经在做），(b) infra 派从下面包抄（Composio 自家 agent-orchestrator + Weave merge driver），(c) 同质化竞争里前两名拿走全部融资，剩下死掉。

---

## 1. 数据：12 个 orchestrator + 关联项目活跃度横评（2026-04-26 快照）

| Project | Stars | Created | 30d commits | 30d merged PR | Contributors | 最新 release | 距今 | 商业化 / 融资 |
|---|---|---|---|---|---|---|---|---|
| **Emdash** (核心) | 4,126 | 2025-08-28 | **100+** | **50** | **87** | v1.x stable (2026-04-22) | 4 天 | YC W26，无公开 funding 数额 |
| **dmux** (核心) | 1,498 | 2025-08-20 | 64 | 11 | 13 | v5.7.1 (2026-04-22) | 4 天 | OSS / standardagents 公司 |
| **cmux** (核心) | **15,489** | **2026-01-28** | **100+** | **75** | 82 | v0.63.2 (2026-04-06) | 20 天 | OSS / manaflow-ai 公司 |
| **Crystal → Nimbalyst** (核心) | 3,034 | 2025-06-05 | **0** | **0** | 15 | v0.3.5 (2026-02-26) | **60 天** | **2026-02 deprecated** |
| **conductor** (支撑) | 闭源 | YC S24 | n/a | n/a | n/a | Mac app（持续） | 周内 | **Series A $22M (Spark + Matrix)** |
| Agent Deck | 2,190 | 2025-12-03 | **100+** | n/a | 68 | 持续 | 当天 | OSS |
| ccmanager | 1,033 | 2025-06-07 | 28 | n/a | 16 | 持续 | active | 个人 OSS |
| Superset | **10,035** | 2025-10-21 | **100+** | n/a | 59 | 持续 | active | OSS / superset-sh |
| **HolyClaude** | 2,072 | **2026-03-22** | 11 | n/a | **2** | active | active | 个人 OSS |
| **AionUi** | **22,619** | 2025-08-07 | **100+** | n/a | 81 | active | active | OSS / iOfficeAI（中国团队）|
| open-cowork | 1,021 | 2026-01-13 | 69 | n/a | 10 | 2026-04-22 | 4 天 | OSS / OpenCoworkAI |
| OmoiOS | 44 | 2025-11-16 | 73 | n/a | n/a | active | 当天 | 个人 OSS |
| Open Sessions (Ataraxy) | 977 | 2026-03-19 | **100+** | n/a | n/a | active | active | OSS / Ataraxy Labs |
| **HumanLayer / CodeLayer** | 10,606 | 2024-08-05 | **0** | n/a | 29 | pro-0.20.0 (2025-12-23) | **125 天** | **已实质停滞** |
| Vibe Kanban (新发现) | n/a | 2025 | n/a | n/a | n/a | active | active | **2026-04 商业化 sunsetting，转 OSS** |
| oh-my-codex (新发现) | 18,807 | 2026-04 | n/a | n/a | n/a | n/a | n/a | OSS / 一周涨 14k stars |
| **Composio agent-orchestrator** (新发现) | **6,554** | **2026-02-13** | **100+** | n/a | 25 | active | active | Composio 自家产品 |

> 注：30d commits per_page=100 上限被打满代表"≥100"实际更多；Agent Deck stars 取 2,190；Composio agent-orchestrator 是 Phase 3 那家拿了 $25M Series A 的 Composio **自己下场**做 orchestrator 的项目，本期才发现，是关键变量。

**这张表读出来的 5 个反直觉信号**：

1. **3 个尸体已经躺平**。Crystal（30d 0 commits + 60 天没 release + 已 deprecated 转 Nimbalyst）、HumanLayer（30d 0 commits + 125 天没 release）、Vibe Kanban（商业化失败转 OSS）。Phase 1 反模式 6 说"YC 押注同质化"是预警，**到 2026-04 已经兑现：4 个月内死了三个**。
2. **cmux 是 5 子赛道里最大的病毒级项目**。**2026-01-28 创建到现在 3 个月，15.5k stars + 82 contributors + 1395 open issues**。stars/issue 比例 ≈ 11:1 高度异常 —— 这是 Phase 1 反模式 3（病毒级暴涨然后衰减）的精确特征。22 种语言 README 翻译进一步坐实"流量驱动 > 工程驱动"。
3. **AionUi 22.6k stars**（5 子类第一名）但中文 issue 占比高、contributor 81 但 commits 集中、有 spam issue（"MFKVault AI Skills Marketplace"）—— 是中国国产产品打 Cowork 标签的产物，与 conductor/Emdash 同一 archetype 但产品形态完全不同（hybrid agent + 国内通讯集成 Feishu/Slack）。
4. **Composio 自家也下场做 orchestrator**（agent-orchestrator 6.5k stars + 30d 100+ commits + 2 个月新生）。**这是 Phase 3 已经预言但本期才看到的 infra → orchestrator 包抄**：Composio 不再满足做 toolkit hub，开始往上一层吃 orchestrator 位。
5. **conductor（YC S24）+ $22M Series A**比 Emdash（YC W26）早一年起跑且融资量级是 Emdash 量级的高一档。**Phase 1 把它们归为同一波是简化 —— 实际 conductor 已经在领先半个 funding 周期**。

---

## 2. 派内分流派：4 个真正的架构流派（不是 3 个）

Phase 1 给了一个粗切，本期细化为 4 流派 + 各自核心赌注 + 最大弱点。**判别标准是"它怎么解决多 agent 的隔离 + 编排 + 输出聚合"这三件事**。

### 流派 A：tmux + worktree（轻量 TUI 派）

- **代表**：dmux、ccmanager、Open Sessions、Vibe Kanban（早期）
- **核心赌注**：**worktree 隔离 + tmux 多路复用 = 已经够了**。开发者本来就在用 tmux，给 tmux 加一层 agent-aware 调度就解决问题，不需要造新 UI、新 IPC、新 ADE。dmux README 一句话明确："Manage multiple AI coding agents in isolated git worktrees. Branch, develop, and merge — all in parallel."
- **核心实现**：dmux 11 agents（Claude Code/Codex/OpenCode/Cline CLI/Gemini CLI/Qwen CLI/Amp CLI/pi CLI/Cursor CLI/Copilot CLI/Crush CLI），每个 pane = 一个 worktree + 一个 agent，按 `m` 进入 merge 流程
- **最大弱点**：**冲突解决完全甩给人**。dmux 的 "Smart merging" 实质上是 git merge + 自动 commit message —— 当 5 个 agent 在同一文件改不同函数时，仍然是 line-level 3-way merge，照样会冲突
- **生死信号**：dmux 30d 64 commits + v5.7.1 + 13 contributors 是个**健康但增速被流派 B 压制**的状态。**ccmanager 30d 28 commits + 16 contributors + 1k stars** 持续在线但永远小众

### 流派 B：自定义桌面 ADE（重量派）

- **代表**：Emdash、conductor、Superset、HolyClaude、AionUi、Crystal/Nimbalyst、HumanLayer/CodeLayer
- **核心赌注**：**parallel agents 需要新 UI、新 IPC、新工作流原语（项目 / session / pane / tab / checkpoint），TUI 不够**。这一派把自己定位为 **"Agentic Development Environment (ADE)"** —— Emdash README 第一句、Nimbalyst 全套页面都是这个词。
- **核心实现**：Electron / Tauri / native macOS 桌面应用 + 内置 git worktree 管理 + 内置 ticket 系统集成（Linear/Jira/GitHub Issues）+ diff viewer + PR creator 一体化
- **最大弱点 1（生存）**：**正面对刚 Cursor**。Cursor 3.2 已发布 multitask + worktrees + multi-root workspaces + tiled agent panes，**"moat is thin" 是 YC Tier List 公开给 Emdash 的判断**
- **最大弱点 2（认知）**：**这一派自己也在挖坑**。cmux 最高 voted issue 之一直接叫 "RIP CURSOR: Add Monaco Editor panel with VS Code-style explorer" —— 这是 cmux 自己承认 terminal-only 不够，要加 IDE 能力。**当 orchestrator 自己往 IDE 方向长，等于承认"独立 ADE"路线立不住，最终归宿是 Cursor / Antigravity**
- **生死信号**：Emdash YC W26 demo day 后 60k downloads + stars 从 demo day 时 2.4k 涨到 4.1k 是真传播，但**没有公开 funding 数额**（不是没融资，是 YC 之外没披露 Series A），4 月内必有动作

### 流派 C：Notification + GUI Dashboard（终端原生派）

- **代表**：cmux、Agent Deck、Open Sessions
- **核心赌注**：**parallel agents 真痛点不是隔离，是"多个后台 agent 跑起来后人脑无法 context-switch"**。cmux 给每个 pane 加蓝色 notification ring + tab 闪烁 + 通知中心 + AI tab 命名 —— 全部解决"我有 5 个 agent 在跑，哪个需要我了"这件事
- **核心实现**：cmux 是 macOS native + Ghostty terminal + AppKit + 通知中心；Agent Deck 是 TUI session manager；Open Sessions 是 tmux sidebar
- **最大弱点**：**通知问题是真痛点但护城河弱**。Cursor 3.2 已经把 "tiled layout" 也加了 —— 通知 + 多 pane 这层 Cursor 自己就能做，且做得更深（cloud agent 也能聚合到同一 UI）
- **生死信号**：cmux 15.5k stars 的 stars/issue 比例（11:1）是 Phase 1 反模式 3 的精确特征。**预测 6 月前 cmux stars 增速会显著放缓** —— 病毒期的尾声

### 流派 D：Spec-driven Multi-agent 编排（重型派）

- **代表**：OmoiOS（Spec-driven multi-agent + Claude + OpenHands 编排）、Composio agent-orchestrator（"plans tasks, spawns agents, and autonomously handles CI fixes, merge conflicts, and code reviews"）
- **核心赌注**：**parallel agents 不是"用户决定 prompt 然后开 N 个 agent"，是"用户说一个 spec，编排器自动拆任务 + 派 agent + 处理冲突"** —— 这是真正的 autonomous fleet
- **核心实现**：OmoiOS 用 spec 驱动，每个 spec 拆成 sub-task 派给 Claude/OpenHands；Composio agent-orchestrator 直接进入 autonomous loop（CI fix + merge conflict 自动处理）
- **最大弱点**：**还在早期**。OmoiOS 才 44 stars，Composio agent-orchestrator 6.5k 但 2 个月新。**这一派代表了 orchestrator 该走的方向，但现在还没产品化兑现**
- **生死信号**：Composio agent-orchestrator 是关键变量 —— 如果 Composio 把这个 OSS 项目做成它 SaaS 的入口，**orchestrator 派会被 infra 派 upstream 吞并**

**4 流派对比一图收**：

| 流派 | 押注 | 解决冲突的方式 | 最大弱点 |
|---|---|---|---|
| A 轻量 TUI | tmux + worktree 已够 | 甩给人手 merge | 永远小众 |
| B 重型 ADE | 需要新 UI 原语 | 自带 diff viewer 但不解决 conflict | Cursor 3.2 釜底抽薪 |
| C 通知中心 | 注意力管理才是真痛点 | 不解决，告诉你哪边在等 | 护城河弱 |
| D Spec 编排 | 用户该说 spec 不是 prompt | 自动 CI fix + merge conflict | 还在早期 |

---

## 3. parallel agents 到底解决什么真问题（不接受官方营销）

### 用户实际跑的 3-5 个真场景

从 Emdash discussions、cmux 高 votes issues、dmux issues、conductor testimonials、Addy Osmani 多 agent 实战文交叉验证，**用户真的在用 parallel agents 干的事**收敛到 3 类：

1. **A/B/C 三种实现方案同时跑**。Conductor 的"Multi-model mode"就是为这个 use case 优化的 —— Claude 写一版、Codex 写一版、Cursor 写一版，跑完用户看 diff 选最好。**这是 parallel 真正不可替代的场景**。
2. **后台长任务 + 前台干别的**。一个 agent 在跑大型 refactor（比如把 100 个文件从 callback 改成 async），用户在 IDE 里继续写新功能；agent 跑完通知用户。cmux 整个 notification system 就是为这个场景设计。**这其实不需要"多 agent 并行"，只需要"agent 后台 + 前台不被打断"** —— 单 agent + IDE 多 buffer 也能做。
3. **不同 ticket 同时分派**。Linear 来 5 个 ticket，分别派给 5 个 worktree 里的 5 个 agent 跑。Emdash 直接接 Linear/Jira/GitHub 是为这个场景。**这场景真但 niche** —— 真正需要"5 个 ticket 同时跑"的开发者团队规模并不大，且企业 IT 流程通常不允许 5 个未 review 的 PR 同时 ship。

**Addy Osmani 的"Search Functionality"案例值得深拆**：三人团队加 search 功能 —— 后端建 endpoint、前端建 UI、tests 等后端完成。这看起来是 parallel 三 agent，**但仔细想就是 dependency graph：tests block on backend，frontend 不能假设 API contract 就开干**。**真正能 parallel 的部分有限**，agent 数量越多协调成本越高。

### 用户实际不用 parallel 干的事（反例）

1. **修一个 bug**。debug 是高度依赖 context 的工作，5 个 agent 各跑一份反而 5 倍 token cost + 5 份噪声答案。**没人这么用**。
2. **写 spec / 文档 / 决策类**。这种工作需要人脑收敛，不能并行展开 —— 5 份不同的 ADR 草稿对用户毫无帮助。
3. **跨文件大型 refactor 涉及 lockfile / DB migration / shared types**。"the pattern breaks predictably on lockfiles, DB migrations, and shared type refactors—know when not to parallelize" —— 这是 "Git Worktrees Need Runtime Isolation" 文里直接点名的反例。

### 用户其实最关心的根本不是 parallel

**cmux 第二高 votes issue 是 #1106 "Add AI provider usage monitoring for Claude and Codex subscriptions"** —— **107 条评论**。这是所有 cmux issue 里最热的之一。用户最大的痛点不是"如何跑更多 agent"，是**"我跑了一堆 agent 我现在欠 Anthropic 多少钱"**。

**这是 parallel agents 派的最大 UX 盲点**：当工具鼓励用户"跑一队 agent"时，没人解决"这队 agent 一晚上烧掉多少 API"的可视化和限额。**Cursor 在这点反而做得好** —— Cursor pricing 模型是固定订阅 + 配额，用户不必盯着 token 心疼。**parallel agents 派必须用 BYOK，每次跑都心疼**——这是隐藏的天花板。

### 一段 contrarian

**parallel agents 当前的实际使用画像更接近"benchmark / research / 探索性工具"，而非"production 工程师日常工具"**。理由：
- **真正的 production 工程师团队 (>5 人)** 用 PR + CI + code review 解决并行问题。一个 PR 一个 review，**根本不需要 orchestrator 帮我并行**。
- **Solo founder / indie hacker** 是 parallel agents 的真用户，但这是个小市场。
- **A/B 多方案对比** 是真 use case 但每周用一次而非每天用 —— **不构成日活级 surface 标配**。

**Phase 1 张力 2 那个"parallel agents 是第三种 UX 标配"判断需要修正**：
> 修正版：parallel agents 是 power user / solo dev / A/B 实验场景的强力工具，**但不是所有开发者每天的 default surface**。Cursor 3.2 把它做成"按需调用的 /multitask 命令"而非 default UI 范式 —— **这才是这个 UX 形态的正确归宿**。

---

## 4. Conflict Resolution Gap：被 Weave 解决，还是被 orchestrator 自己解决？

Phase 3 已论断："Weave（entity-level merge driver）正是 parallel agents 的真痛点"。本期具体回答两个问题。

### 问题 1：当前 4+8 个 orchestrator 里，几个真处理了 conflict resolution？

**答：零个真正处理。** 

逐个核查：
- **Emdash**：worktree 隔离 + diff viewer + merge step，**底层仍是 git merge**。冲突时仍是 line-level conflict markers
- **dmux**："Smart merging — auto-commit, merge, and clean up in one step" —— 实测 README 描述只是把 git merge / commit message 自动化，**没有 entity-level diff**
- **cmux**：完全不处理 merge，每个 worktree 自己 git push，merge 由用户在 GitHub 做
- **Crystal/Nimbalyst**：worktree 隔离 + 用户自己手 merge
- **conductor**：有 "Spotlight testing" 把 changes sync 回 main repo，**但 conflict 仍是 git 级**
- **Composio agent-orchestrator**：README 说"autonomously handles ... merge conflicts" —— **是 4+8 个里唯一公开宣称 auto-handle merge conflicts 的**。但这是 2 月新生项目，6.5k stars 中的实际生产可用度待验证

**所有 ADE 流派 + tmux 流派的 orchestrator 本质都是"worktree 隔离 + 把 merge 甩给人或甩给 GitHub PR review"**。当 5 个 agent 改同一文件时，**它们没有比 git 更聪明**。

### 问题 2：谁会先解决——Weave 被集成，还是 orchestrator 自建？

**两条路径的可行性**：

- **路径 1：Weave 被 orchestrator 集成**。技术上简单 —— Weave 是个 git merge driver，配置一行 .gitattributes 即可。但 **dmux/Emdash/cmux 团队没有动机主动集成**，因为：
  - 集成 Weave 等于承认自家 merge 不够智能 —— 影响产品定位
  - Weave 只支持有限语言（tree-sitter 26 种），不支持的语言反而退化
  - **Weave 本身没融资**（Phase 3 已警告 Ataraxy Labs 融资风险）—— orchestrator 厂商不会绑一个可能 12 个月内消失的依赖
- **路径 2：orchestrator 自建 entity-level merge**。**Composio agent-orchestrator 已经在做**（README 已宣称）。Emdash 团队 87 个 contributor 也有这个工程能力，但**优先级在抢市场不在做 infra**。

**最可能的实际路径**：
- Composio agent-orchestrator 的 "auto handle merge conflicts" 实现质量决定一切。如果跑通，**Composio 把 conflict resolution + toolkit hub + orchestrator 三件事打包成一个 SaaS**，是 infra 派吞并 orchestrator 派的精确剧本
- Weave 路线**更可能的命运是被 Cursor / Anthropic 直接集成进各自 IDE / Claude Code 的 default merge driver**，而非被中间层 orchestrator 集成。Phase 3 第 1 开放问题就是这个

**对 orchestrator 派的诛心追问**：当所有 orchestrator 都只做 worktree 隔离然后让人手 merge，本质是**把多 agent 协作问题甩给人 + git**。这能称作"parallel agents UX"吗？严格地说，**它叫"parallel agents 启动器"，不叫"parallel agents 协作系统"**。真正的协作要求自动 conflict resolution + cross-agent context sharing + 任务依赖图调度 —— **这些事 4+8 个 orchestrator 全都没做**。

---

## 5. Crystal 已 deprecated 的尸检 + Vibe Kanban 转 OSS 的二次尸检

Phase 1 反模式 6 已经预警 YC 押注同质化，本期要看**已经死掉的尸体告诉我们什么**。

### Crystal 死因（2026-02-26 last commit + README "Crystal Is Now Nimbalyst"）

读 Crystal repo + Nimbalyst README 拼出来：
- Crystal 路线就是**"多 Codex / Claude Code 会话并行 worktree"** —— 流派 B 的早期纯净版
- **Nimbalyst 是完全不同的产品**：内置 Excalidraw、RevoGrid 表格、Monaco 代码编辑器、AI 流式编辑、planning 任务编排 —— **不再是单纯的 parallel agents 启动器，是 AI-native 工作空间**
- Issue #235 "Project dead?"（2026-02 用户问的）+ #200 "mac release 0.3.0 doesn't show any window"（一直未修）= **维护塌方先于产品转型**

**Crystal 死因总结**：
1. **流派 B 的早期纯净版没有商业化路径**。worktree + 多 session 太薄，挡不住 Cursor/conductor 的厚产品
2. **stravu 团队转 Nimbalyst 等于承认"单做 parallel agents starter 不够，必须做完整 workspace"** —— **这恰好印证流派 B 的最大弱点**：要么演化成 Cursor / Antigravity 量级的 ADE，要么被它们吃掉，**没有中间状态可活**

### Vibe Kanban 二次尸检（2026-04 商业化 sunsetting → OSS only）

**Vibe Kanban 比 Crystal 更早被商业化挑战打倒**：
- 商业化形态做不起来（典型 OSS 商业化失败模式：B2C 工具 SaaS 化无人付钱）
- 转 OSS 维护意味着**核心团队不再投入精力**，跟 Aider 进入"模型 alias 维护"是同一种状态
- 这是 Phase 1 反模式 6 的"YC 押注同质化"在非 YC 项目上的对应版本 —— **挤赛道里前 2-3 名拿融资，剩下死或转 OSS**

### HumanLayer 三次尸检（30d 0 commits + 125 天没 release）

HumanLayer 在 Phase 1 / Phase 2 一直是被高看的项目（10.6k stars + "Multi-Claude IDE" 定位 + context engineering 卖点）。**到本期已经死了**：
- last commit 2026-01-07，4 个月不动
- 最后 release pro-0.20.0 是 2025-12-23，5 个月没 release
- 29 个 contributor 但活跃停在去年

**HumanLayer 死因**：和 Crystal 完全不同 —— HumanLayer 不是被同赛道挤死，是**自己赛道定位漂移**。从 "human-in-the-loop 工具"到 "multi-Claude IDE"到 "context engineering 平台"，**每一次定位转移都没找到 PMF**。这个尸体警告：**"agent dev tooling" 这个伞概念里的项目最容易因为定位漂移而死**。

### 三具尸体的共同警示

给后续 orchestrator 项目的三条警告：
1. **要么演化成完整 ADE（cursor / antigravity 量级），要么被吞** —— 中间状态不活
2. **B2C OSS orchestrator 商业化几乎不可能** —— Vibe Kanban + Crystal 都试过，结论一致
3. **定位漂移是 OSS 项目第一杀手** —— HumanLayer 死法每月都在重演

---

## 6. YC 押注同质化：是真趋势还是 VC 制造泡沫？

Phase 1 反模式 6 提出"YC 押注同质化"。本期要给一个判断。

### 证据 1：YC 阵容横评

| Project | YC 批次 | 融资 | 形态 | 状态 |
|---|---|---|---|---|
| Emdash | **W26** | 公开数额未披露 | 桌面 ADE + 23 CLI | 60k downloads + 4.1k stars + Demo day 后正常运转 |
| conductor | **S24** | **Series A $22M** (Spark + Matrix) | macOS app + Codex/Claude Code | Series A 完成，**比 Emdash 早一个 funding 周期** |
| Crystal/Nimbalyst | 非 YC | n/a | 桌面 app | **已 deprecated 转 Nimbalyst** |
| Vibe Kanban | 非 YC | n/a | Rust kanban | **2026-04 商业化 sunsetting** |

**信号**：YC W26 demo day 是"被 conductor S24 + $22M Series A"已经卡位的赛道。Emdash 是后来者，moat 被独立分析师公开评为"thin"。**这不是 YC 内卷，是 YC 在已被验证的赛道继续下注 + 后来者面临窗口缩小**。

### 证据 2：a16z / Anthropic 视角

**Anthropic 自己的 2026 Agentic Coding Trends Report 已把 orchestrator 写进官方报告** —— 内容是 "use an orchestrator to coordinate specialized agents working in parallel—each with dedicated context—then synthesize results"。这是赛道被官方认可的实锤信号。

但同一份报告强调的是**"orchestrator 协调 specialized agents（不同 role）"**而非**"orchestrator 协调多个相同 role 的 agent 在不同 worktree 跑"** —— 这两件事 narrative 上接近，工程上完全不同。**当前 orchestrator 派做的是后者，Anthropic 期待的是前者**。这个错位是 12 月内会被回答的关键问题。

### 证据 3：用户量数据

最硬的数据：
- Emdash: 60k downloads（demo day 后 1 个月）
- cmux: 15.5k stars（3 个月病毒期）
- Composio agent-orchestrator: 6.5k stars（2 个月）
- oh-my-codex: 18.8k stars（一周涨 14k） —— **这是 Phase 1 反模式 3 的精确特征**

**stars / downloads 都在涨，但没有任何一家公开过 DAU 数据**。这是关键 —— **OSS orchestrator 的 stars 极高，但实际日活可能极低**。Vibe Kanban 商业化失败就是数据印证。

### 我的判断

**YC 押注本身是真信号（赛道被验证），但同质化必有大量死亡**。预测：
- **6 月内**：Emdash 拿 Series A（量级 $20-30M，跟 conductor 同档）
- **9 月内**：Vibe Kanban / Crystal / HumanLayer 之外，**dmux 或 Agent Deck 之一会停止维护或被收购**
- **12 月内**：parallel agents 这个 UX 形态会**被 Cursor / Claude Code 默认内置**（已发生在 Cursor 3.2），剩下"独立 orchestrator"只在 power user / solo dev / 中国国产场景活下去（AionUi 在中国市场已是事实第一名）

**parallel agents 不会成为所有开发者的 default UX 标配** —— 它会成为 IDE 厂商的 advanced feature + 一小撮独立 orchestrator 服务 niche 用户的双轨格局。**Phase 1 张力 2 那个"第三种 UX 标配"判断需要降级**。

---

## 7. vendor-locked vs agnostic 在 orchestrator 层的表现

Phase 1 张力 3 的 agnostic vs vendor-locked 在 runtime 层已经讲过。**到 orchestrator 层，agnostic 是不是核心价值主张**？

### Agnostic 阵营

- **Emdash**：23 个 CLI 实锤（Amp / Auggie / Autohand / Charm / Claude Code / Cline / Codebuff / Codex / Continue / Cursor / Droid / Gemini / Copilot / Goose / Hermes / Kilocode / Kimi / Kiro / Mistral Vibe / OpenCode / Pi / Qwen Code / Rovo Dev）—— **agnostic 拉满**
- **dmux**：11 个 agent
- **ccmanager**：8 个（Claude Code/Gemini CLI/Codex CLI/Cursor Agent/Copilot CLI/Cline CLI/OpenCode/Kimi CLI）
- **Agent Deck**：跨 Claude/Gemini/OpenCode/Codex
- **Vibe Kanban**：10+ 个

### Vendor-leaning 阵营

- **conductor**：主推 Claude Code + Codex，不做 23 agent 兼容（**conductor 团队在赌 Anthropic + OpenAI 二者必有其一胜出**）
- **HolyClaude**：Claude 优先（名字暗示）
- **AionUi**：Claude Code 主 + Gemini + Codex
- **cmux**：notification 设计是为 Claude / Codex 优化的，但底层是 terminal 任意 agent

### Agnostic 是核心价值还是短期红利

我的判断：**agnostic 是当前的红利但不是长期护城河**。理由：

1. **Cursor / Claude Code 自己加 multi-session 已经在发生**（Cursor 3.2 实锤）。当用户在 Cursor 里就能跑 5 个 background agent，**外接 agnostic orchestrator 的吸引力立刻下降一个数量级**
2. **Agnostic 是工程量黑洞**。Emdash 维护 23 agent 兼容意味着每个 agent 出新版本都要适配 —— 这是 Charm/Aider/Cline 这些 runtime 项目从来不愿意做的事，因为没护城河
3. **真实用户切换成本不高**。开发者不会同时用 23 agent，常用就 2-3 个。**agnostic 是 marketing 卖点，不是日活驱动**

**agnostic 派的真出路是 D 流派（spec-driven 编排）** —— 让 23 agent 各自专精不同任务（一个写 SQL 另一个写 React 第三个 fix bug），由 spec 编排器调度。**这是 Composio agent-orchestrator 路线的真潜力**。如果停留在"用户选择哪个 agent，orchestrator 启动"，agnostic 没有故事。

---

## 8. 给 Boris 的判断

### 要用哪个：日常想跑 parallel agent 选哪个

**主用 Cursor 3.2 内建 + 副用 dmux**。理由：

1. **Cursor 3.2 的 multitask + worktrees + tiled agent panes 已经做得够好**。Boris 既然 Phase 2 已经决定主用 Claude Code + Cline 副用，**Cursor 作为"想跑 parallel 时的工具"使用即可**。不必装独立 orchestrator
2. **dmux 副用**：当不在 Cursor 内、纯 terminal 工作流时，dmux 是流派 A 里最简洁的。30d 64 commits + v5.7.1 + 健康，且不需要桌面 app
3. **不用 Emdash**：虽然 23 agent 牛逼，但 Boris 实际只用 Claude / Cursor / Codex 几个 —— Emdash 的 agnostic 红利对 Boris 不成立。**装一个新的 Electron 应用 ROI 低**
4. **不用 cmux**：macOS only + 1395 open issues + stars 病毒期特征明显。**Boris 在 Windows，且 cmux 路线即将归一到 Cursor**。直接降权
5. **不用 conductor**：闭源 + Mac only + 主要打 Claude Code 用户。Boris 用 Claude Code 但 macOS 不是主战场
6. **不用 AionUi**：22.6k stars 但中文场景 + Cowork 形态对 Boris 不 fit

### 要赌哪个：12 月内最可能拿融资 / 被收购 / 扩张

**第一押注：Composio agent-orchestrator（流派 D）**。理由：
- Composio 母体已经 $25M Series A + Lightspeed 背书（Phase 3 已认定）
- agent-orchestrator 是 Composio 从 infra 上探到 orchestrator 的关键产品
- **如果 Composio 把这个 OSS 项目做成 SaaS 入口，6 月内会有 Series B** + **agent-orchestrator stars 会突破 20k**
- **赌的是 infra → orchestrator 的 upstream 包抄成立**

**第二押注：Emdash 拿 Series A**。理由：
- YC W26 + 60k downloads + 87 contributor 的工程节奏
- 4 月内必有 funding 动作（Demo day 已过 1 个月）
- **赌的是 Emdash 在被 Cursor 包饺子前融到下一轮，撑过 12 月**

**不押 conductor 后续**：$22M Series A 已拿到，下一轮要看产品数据兑现，6 月内可能没新闻。

### 要丢弃哪个：从 radar 里降权

**降权 / 季度回看**：
- **Crystal**：已 deprecated，移到 "已死参考" 单独分组
- **HumanLayer / CodeLayer**：30d 0 commits + 125 天没 release，从"周扫"降到"季度回看"。**保留作为"agent dev tooling 定位漂移"反例**
- **HolyClaude**：2 contributor + 个人项目，不进 radar 主表
- **OmoiOS**：44 stars 太小，挪到 "experimental 关注列表"

**保持每周扫**：Emdash（追融资 + Cursor 反应）、Composio agent-orchestrator（追 SaaS 化）、dmux（追流派 A 健康度）、Cursor changelog（追 multi-session 演进 —— **这是 orchestrator 派生死的最重要 signal source**）。

### 6 月内决胜事件：5 个可观测信号

1. **Cursor 3.3+ 是否进一步把 multi-session 做成 default UI（而非 advanced feature）** —— 决定独立 orchestrator 的生死。**这是 #1 重要信号**
2. **Emdash 是否拿 Series A 公告** —— 决定 YC W26 押注是否兑现
3. **Composio agent-orchestrator 是否突破 20k stars + 是否官方与 Composio SaaS 整合** —— 决定 infra 派是否吞并 orchestrator 派
4. **AionUi 中国市场是否突破 30k stars** —— 决定 orchestrator 是否在中国国产场景找到独立路径
5. **dmux 或 Agent Deck 任意一家是否停止维护** —— 验证 Phase 1 反模式 6 同质化的进一步死亡

---

## 9. radar 反向修正

本期对 Phase 1 / radar 的归类修正：

1. **Composio agent-orchestrator 应入 radar 类别 6（Multi-Agent / Parallel Coding Orchestrator）**。当前 radar 只有 Composio 主项目（在类别 5 框架/SDK），但 ComposioHQ/agent-orchestrator 是独立项目 + 6.5k stars + 2 个月 100+ commits —— 必须入 radar
2. **Vibe Kanban (BloopAI/vibe-kanban) 应入 radar 类别 6**。本期才发现这个项目，且已在 sunsetting 状态 —— 作为流派 A/B 的死亡案例必须记录
3. **oh-my-codex 应入 radar**。一周涨 14k stars 的现象级病毒项目，是 Phase 1 反模式 3 的最新 case study
4. **HumanLayer / CodeLayer 应从类别 7 移到 "已实质停滞" 子分类**，与 Crystal 并列
5. **AionUi 应在类别 6 提升 priority** —— 22.6k stars + 81 contributor 量级实际上是 orchestrator 派 stars 第一名（如果不算 cmux 的病毒虚高）

**对 Phase 1 张力 2 的实质性修正**（重要）：
> 原版："parallel agents 是继 chat、inline 之后的第三种 UX 标配"
> 修正版：parallel agents 是 IDE 厂商（Cursor 3.2 已发布）的 advanced feature + 一小撮独立 orchestrator 服务 power user 的双轨格局，**不会成为所有开发者每天的 default surface**

**对 Phase 1 反模式 6 的实质性扩展**：
> 原版："YC 押注同质化"
> 扩展版：到 2026-04，**4 个月内已死 3 个**（Crystal 转 Nimbalyst / Vibe Kanban 商业化失败 / HumanLayer 实质停滞）。**同质化 + 同时被 Cursor/Anthropic 上方挤压 = 死亡加速**

---

## 10. 一段 contrarian：Anthropic 报告里的 orchestrator 是另一种 orchestrator

**主流叙述**：parallel agents = 多个 worktree + 多个 Claude Code = orchestrator 协调 = Phase 1 张力 2 标配。

**仔细读 Anthropic 2026 Agentic Coding Trends Report**：Anthropic 自己定义的 orchestrator 是 **"coordinate specialized agents working in parallel—each with dedicated context—then synthesize results into integrated output"** —— **specialized + synthesize = 不同 agent 干不同事且最终汇总，不是 N 个相同 agent 各跑一份**。

这是两种完全不同的 orchestrator 哲学：
- **当前 orchestrator 派的"复制式 parallel"**：5 个 Claude Code 跑 5 个 ticket，互不相干
- **Anthropic 的"分工式 parallel"**：planner agent + coder agent + reviewer agent + tester agent，由 orchestrator 编排上下游

**这两件事 narrative 上挂在一起，工程上完全不同**：
- 复制式 parallel 的瓶颈是 conflict resolution + notification + cost monitoring（当前 Emdash/cmux 在解决的）
- 分工式 parallel 的瓶颈是 task decomposition + cross-agent context handoff + result synthesis（这是 Composio agent-orchestrator + OmoiOS 在解决的）

**长期赢家在第二种哲学这边**。理由：复制式 parallel 的 ROI 上限有限（一个开发者顶多看 5 个 worktree），但分工式 parallel 可以从"5 个 ticket"扩展到"100 个 sub-task"，是真正的 agent fleet。

**Boris 的预测**：12 月内，"orchestrator" 这个词的 default 含义会从"parallel worktree starter"漂移到"task-decomposing agent fleet manager"。**dmux / Emdash / cmux 现在做的事在那时会被叫做 "session manager" 而不是 "orchestrator"**。这是行业用语演化的必然，**也是 Composio agent-orchestrator 卡位最准的理由**。

---

## 11. 本期收束

12 个 orchestrator + 关联项目分 4 流派、3 死、9 活：
1. **流派 A（轻量 TUI）**：dmux / ccmanager / Open Sessions 健康但永远小众
2. **流派 B（重型 ADE）**：Emdash / conductor / Superset / AionUi / Crystal-deprecated / HumanLayer-dead —— 流派内部死了 2 个，活下来的正面对刚 Cursor 3.2
3. **流派 C（通知中心）**：cmux / Agent Deck —— 病毒期特征明显，6 月内 stars 增速会放缓
4. **流派 D（Spec 编排）**：Composio agent-orchestrator / OmoiOS —— **被低估的真正 orchestrator 路线**

Phase 1 张力 2（parallel agents 第三种 UX 标配）需要降级 —— 它是 IDE 厂商的 advanced feature + niche 独立工具的双轨格局，不是默认形态。

Phase 1 反模式 6（YC 押注同质化）已经兑现 —— 4 个月内死了 3 个项目。

Phase 3 第 1 个开放问题（Sem/Weave 被集成）的 orchestrator 端答案：**4+8 个 orchestrator 没有一个真处理 conflict resolution，全部把 merge 甩给人**。Composio agent-orchestrator 是唯一公开宣称 auto-handle 的，但是 2 月新生项目，质量待验证。

12 月内会被回答的开放问题（接 Phase 1 + Phase 2 + Phase 3）：
- **Cursor 3.3+ 是否把 parallel agents 做成 default UI** —— 决定独立 orchestrator 的存亡
- **Composio agent-orchestrator 是否完成 infra → orchestrator 的 upstream 吞并** —— 决定赛道由谁主导
- **Emdash Series A 是否兑现 + 量级是否对标 conductor** —— 决定 YC W26 押注的回报
- **"orchestrator" 词义是否从复制式 parallel 漂移到分工式 fleet** —— 决定整个 archetype 的下一阶段定义

---

## Phase 5 前瞻

下期（第 5 期）转入 **Archetype 7（Evaluation Substrate）+ Archetype 2（Agent Harness）的对刚** —— SWE-bench Verified 80% 之后路在何方 + 为什么 100 行 mini-swe-agent 能拿 74%（即"runtime 派的全部 UX 投入对 benchmark 性能没有增量贡献"这个反例如何解释）。本期的发现 —— **orchestrator 派的 Composio agent-orchestrator 自带 "auto-handle merge conflicts"** —— 与 Phase 5 会重叠：当 evaluation 评估的不再是单 agent 的 SWE-bench 通过率，而是 fleet 的 PR merge 率（PRarena 路线），**当前所有 benchmark 都跟不上 orchestrator 派演化**，这会是 Phase 5 的核心矛盾。
