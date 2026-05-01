# Agent Runtime 派内对比：为什么"同一类东西"要做四遍以上

- 日期：2026-04-26
- 系列：Agentic SE 深度分析 **第 2/7 期**
- 依据数据：`./2026-04-26-part-1-landscape.md`（Phase 1 的 archetype/张力/反模式词汇）+ `../2026-04-26-radar.md`（95 个 OSS repo） + 本期新拉的 GitHub API 元数据快照（2026-04-26）
- 本期定位：**Archetype 1（Agent Runtime）派内对比** —— 主轴 A（抽象层次内的 runtime 层）+ 轴 C（自治度）
- 字数：约 4500
- 主对比对象：Aider、Claude Code、Cline、Crush
- 支撑对照：Codex CLI、Gemini CLI、Goose、Plandex、gptme、Continue、Roo Code / Kilo Code

---

## 0. 本期不是什么

不是功能列表对比，不是"哪个最好用"的种草帖。**本期回答的是一个结构性问题**：当一个细分赛道里出现 4 个以上"看起来在做同一件事"的活跃项目时，背后一定有还没被多数人讲清楚的设计哲学差异——否则赢家早就出现了。

Phase 1 把 Aider、Claude Code、Cline、Crush、Goose、Codex CLI 都归在 Archetype 1（Agent Runtime）。**这个归类正确但粗糙**。本期要做的是把这一格切开，让每个 runtime 的"押注"显形。

---

## 1. 数据：runtime 派的活跃度横评（2026-04-26 快照）

先把数据摊开。下面所有数字来自本期 GitHub API 直拉，不是引用 radar。

| Runtime | Stars | Created | 30d commits (main) | 30d merged PRs | 最新 release | 最近 release 距今 | 总 contributors | 商业模式 |
|---|---|---|---|---|---|---|---|---|
| **Aider** | 43,980 | 2023-05 | **14** | **0** | v0.86.0 (2025-08-09) | **8.5 个月** | 180+ | 个人 OSS / 创始人无明确商业实体 |
| **Claude Code** | 闭源 | 2024 | n/a | n/a | 周更（CLI auto-update） | 周内 | n/a | 闭源 / Anthropic 订阅绑定 |
| **Cline** | 61,030 | 2024-07 | 57 | **57** | v3.81.0 (2026-04-24) | **2 天** | 290+ | OSS + 公司化 (cline.bot) |
| **Crush** | 23,518 | 2025-05 | **196** | **70** | nightly + v0.62.1 (2026-04-24) | **2 天** | 110+ | OSS / Charm 公司维护 |
| Codex CLI | 78,060 | 2025-04 | **200+** | **971** | rust-v0.126.0-α (2026-04-26) | **当天** | 100+ | OSS / OpenAI 账号绑定 |
| Gemini CLI | 102,470 | 2025-04 | **200+** | **395** | v0.40.0-α (2026-04-25) | **2 天** | 100+ | OSS / Google 账号绑定 |
| Goose | 43,324 | 2024-08 | **200+** | n/a | v1.32.0 (2026-04-23) | **3 天** | 100+ | OSS / Block 商业品 + LF 基金会 |
| Plandex | 15,300 | 2023-10 | n/a | n/a | n/a | **2025-10 起停滞** | n/a | OSS + plandex.ai 云服务 |

> 注：Codex / Gemini / Goose 的 30d 提交量都被 GitHub API per-page 100 截断后第二页仍满，实际均在 200 以上；Cline 30d 主分支 commit 仅 57 但 merged PR 也 57——意味着**几乎一 PR 一 squash-merge**，与 Codex 把 PR 当工单拆细的风格完全相反。

**这张表读出来的几个反直觉信号**：

1. **Aider 是这一派里最先停下来的人**。30d 14 commits、30d **0 个 merged PR**、最近 release 距今 8.5 个月——这意味着 Aider 已经不是"在迭代"，是"在维护一个稳定品"。结合最新 commit 内容（`update FAQ token percentages`、`add gpt-5.5 model settings across providers`）——**绝大多数活动是模型 alias 维护**，不是产品演进。
2. **vendor-locked 派的工程节奏全面碾压 provider-agnostic 派**。Codex 30d 971 个 PR、Gemini 395 个、Goose 200+——它们正在以 startup 速度迭代。Aider/Cline 这种社区化 OSS 在迭代速度上已经被甩开半个数量级。
3. **Cline 用最少的 commit 拿到最多 stars**（61k stars / 30d 57 commits）。这是 IDE 内嵌的红利：**VS Code 自带的 GUI/键位/buffer 让 Cline 不需要自己造 UX**。
4. **Crush 是 OpenCode 死后唯一还在跑的 TUI runtime**。OpenCode 已 archive 2025-09，Plandex 2025-10 后停滞。Crush 把这一段 narrative 单独承接下来——这是 Charm 的品牌余荫。

---

## 2. 设计哲学：每个 runtime 真正信奉什么

数据只是表象。真正的差异在每个团队"押了什么"。

### Aider：Git is the source of truth

Aider 最强的、也是最难被复制的执念是 **"every change auto-commits"**。README 第一条卖点不是"AI 多聪明"，是"automatically commits changes with sensible commit messages, use familiar git tools to easily diff, manage and undo AI changes"。

这条哲学的代价是巨大的。它意味着：
- **不能引入新的版本控制抽象**（所以不会原生支持 Sem/Weave 那种 entity-level diff）
- **每个 session 都要落进 git history**，不能像 Cline/Crush 那样维护一个游离的 conversation 状态
- **多 agent 并行天然不友好**——并行 agents 在同一个 worktree 上 auto-commit 会互相打架（这正是 Emdash 这一派 orchestrator 存在的理由）

但 Aider 的赌注本身有内在一致性：**人类 SE 的协作单位本来就是 commit**。如果你信这件事，Aider 是这 4 个 runtime 里唯一把它做到底的。reilly Sweetland 那句被反复引用的 testimonial 总结得最准——"Aider is the precision tool of LLM code gen ... while keeping the developer in control"。**Aider 是 pair programmer，不是 agent**——它在 Phase 1 自治度轴 C 上明确押 (1) Copilot/Pair。

### Claude Code：模型才是壁垒，CLI 只是入口

Claude Code 闭源不开源，但它的设计哲学反而是 4 个里最好读的——因为它的产品形态本身就是一段话：**Anthropic 不打算让 CLI 本身成为产品，CLI 是把 Claude 模型独有能力（prompt caching、1M context、agentic loop 训练）暴露给 power user 的薄壳**。

证据：
- **生态溢出**而非生态投入。Phase 1 已经指出 awesome-claude-code 41k stars、cmux/Agent Deck/ccmanager/Open Sessions 全是第三方做的——Anthropic 自己只更新 CLI 二进制。
- **没有公开 spec**。MCP 是 Anthropic 推的标准，但 Claude Code 自己怎么用 MCP 没有详细文档；prompt caching 怎么触发、agentic 子任务怎么 spawn——全靠用户摸。
- **绑订阅而非 API key**。这是 Codex CLI 抄走的一招，也是 vendor-locked 路线最大的 UX 优势。

Claude Code 的押注是一句话：**模型代差是真的，且会持续**。如果 Anthropic 模型 vs OpenAI 模型在 12 个月后拉不开 5pp 以上 SWE-bench 差距，Claude Code 这层薄壳就没护城河——Cline + 任意 frontier model 就能复刻它的体验。

### Cline：Plan/Act 双模式 + IDE 上下文是 UX 关键

Cline 的产品哲学比 Aider/Crush 更复杂，因为它同时要服务两类用户：**(a) 想让 agent 自己跑的人，(b) 想看着每一步审批的人**。这就是 Plan/Act 双模式存在的本质——**让用户在不同自治度之间快速切换**。

Cline 自己 README 里反复强调 "human-in-the-loop GUI to approve every file change and terminal command"。这表面上看像 Aider 的 pair 路线，**实际上完全不是**——Cline 的 Act 模式真跑起来就是 Phase 1 自治度轴上的 (2) Agent (task-level)，而不是 (1) Pair。Plan 模式只是"准备阶段加一个审批 gate"。

更深一层：**Cline 仓库结构暴露了它的真定位**。`evals/`、`testing-platform/`、`webview-ui/`、`standalone/`、`proto/`、`locales/` —— 这不是个 VS Code 扩展应该有的结构，这是个 **跨 surface 的 agent 平台**，VS Code 只是它当前最成功的 frontend。Cline 已经有 `cli/` 和 `standalone/` 目录——它**正在脱离 VS Code 宿主**。

Cline 真实的押注：**"plan/act 双模式 + 多 surface" 是开发者真需要的工作流**，VS Code 只是过渡载体。如果对了，Cline 在未来 12 月会从 IDE 扩展进化成一个独立 ADE（类似 Emdash 的位置）；如果错了，它会被 Cursor 这种 native agent IDE 吃掉。

### Crush：终端体验本身就是产品

Crush 是 4 个里最容易被误读的。表面看它是个"另一个 CLI agent"，但它的真定位是 **Charmbracelet 把自家 25k+ TUI 应用积累的渲染/交互/键位/动效经验，全部投入到一个 agent 产品里**。

证据点：
- 继承 OpenCode（已 archive）的 narrative，但**没有继承 OpenCode 的代码**——Crush 是 Charm 重写
- README 一句话：**"Crush uses LSPs for additional context, just like you do"**——这是其它 runtime 没明确做的。Aider 靠 tree-sitter 自己做语法分析，Cline 靠 VS Code API，**只有 Crush 直接接 LSP**。这意味着 Crush 在 IDE 化和"纯 CLI"之间走了一条第三路线
- 多 LSP（gopls/nil/typescript-language-server）已配置好，Catwalk 社区维护 provider 列表

Crush 的押注：**"漂亮 + 顺手 + LSP-aware 的 TUI 是真需求，不是噱头"**。这个押注押得对的前提是——**人们真的会长时间在终端里和 agent 对话**。如果 parallel agents（Phase 1 张力 2）成主流，Crush 这种"单 session 极致打磨"的路线会被 Emdash/conductor 这种 orchestrator 边缘化；如果 single-agent + 高质量交互才是主线，Crush 会拿走 Aider 留下的位置。

### 4 个押注用一张表收拢

| Runtime | 一句话信奉 | 如果错了会怎样 |
|---|---|---|
| Aider | Git 是协作的真单位，每个 diff 都是 commit | 如果 entity-level diff (Sem/Weave) 上位，line-level git 过气 |
| Claude Code | Anthropic 模型代差永远存在，CLI 只是壁垒的传送带 | 如果模型趋同（开源模型追到 70% Verified），CLI 薄壳没护城河 |
| Cline | Plan/Act 双模式 + 多 surface 才能 cover 真实工作流 | 如果 Cursor/Antigravity 这种 agent-native IDE 吃掉 IDE 内嵌位，Cline 退路只剩独立 ADE |
| Crush | 终端 TUI 是开发者最忠诚的 surface，体验决定胜负 | 如果 parallel agents 成标配，单 session 极致打磨被 orchestrator 派包饺子 |

---

## 3. 支撑对照：另外 7 个 runtime 各占什么生态位

每个一段话讲完。

**Codex CLI**（OpenAI, 78k stars, 30d 971 PRs）—— 工程节奏是这一派最猛的一个。**和 Claude Code 战略完全一样**（vendor-locked + 账号绑定 + 模型独占能力），但 OpenAI 选择 OSS——猜测原因是 Anthropic 在 Claude Code 闭源路线上的 ecosystem 红利让 OpenAI 看明白了 OSS + 账号绑定才是 Trojan horse 最佳路径。Rust 重写从 v0.126 alpha 节奏看是为打 Cursor/Codex IDE 集成做准备。

**Gemini CLI**（Google, 102k stars, 30d 395 PRs）—— stars 是 OSS agent 第一名，但 102k 星只迭代出 395 个 PR（仅 Codex 的 40%）。这反映 Google 三条线分散（Gemini CLI + Jules + Antigravity），CLI 这条不是绝对优先。差异化卖点是 **1M context + ReAct**，但 ReAct 这个词在 2026 年已经是 baseline——意味着 Gemini CLI 没有 Codex 的"模型特性独占"那种独门武器。**stars 多但灵魂相对弱**。

**Goose**（Block, 43k stars, Rust）—— 唯一捐 Linux Foundation / AAIF 的 OSS code agent。**这是基金会路线 vs 公司路线的对照实验**。Goose 同时有 desktop 和 CLI，Block 押的是"agent 该是 24/7 在跑的桌面 daemon，不是被人 invoke 的 CLI"——自治度轴 C 上往 (3) Autonomous 倾斜。如果这个押对了，Goose 是这一波里唯一可能跨过 runtime → autonomous SWE 边界的项目。

**Plandex**（15k stars, 2025-10 后无活跃）—— 押 "long task + 2M context + sandbox" 路线，时机太早。它定位的"长任务"在 2024 年是个超前命题，到了 2026 年 Claude Code/Codex 都内置长任务时反而护城河没了。**这是个 cautionary tale：押对方向但被时间表打败**。Phase 1 反模式 1（学术 PoC dump）的商业版变体——"创业 PoC 押对方向但商业兑现窗口比预期长"。

**gptme**（4k stars, 2023-03 起）—— 早期本地优先派。和 Aider 同代，但选择了"local-first + shell+browser+vision"路线而不是 "git-aware pair"。结果差距：Aider 44k vs gptme 4k——**说明 2023-2024 这一代 runtime 里"git-aware"是比"local-first"更强的命题**。但 2026 年风向可能变（隐私/合规/离线诉求上升），gptme 这条线值得持续看。

**Continue**（33k stars）—— 和 Cline 是 IDE 派内最关键的对照。**Continue 押 enterprise IDE 助手**（VS Code + JetBrains + CLI + CI checks 全开），Cline 押 **agent-first IDE 内嵌**。Continue 没做 plan/act 双模式，它的形态更接近"高级 Copilot"而不是"runtime"。Continue 的 stars 增速明显落后 Cline——市场用脚投票：**人们要的是 agent，不是更聪明的 autocomplete**。

**Roo Code (24k) / Kilo Code (19k)** —— Phase 1 反模式 4（fork 链）的代表。Roo Code = Cline fork + multi-mode (Code/Architect/Ask/Debug)，Kilo Code = OpenCode fork + 500+ models 接入。**fork 们的存在本身解释了 Cline/OpenCode 自身的局限**：Cline 单 mode 不够细 → Roo 切 4 mode；OpenCode 没死透但模型接入太窄 → Kilo 接 500+。但 fork 链长了之后维护负担会问题化（Phase 1 已警告），**fork 项目的 stars 不能直接当生命力指标**——要看"fork 后 diverge LOC"。

---

## 4. 技术架构差异：5 个维度横切

| 维度 | Aider | Claude Code | Cline | Crush | Codex CLI | Goose |
|---|---|---|---|---|---|---|
| **Context 管理** | 自实现 repo map (tree-sitter) | Anthropic prompt caching + 1M 默认 | VS Code workspace API + 自管 token | LSP + 自管 session context | OpenAI prompt caching + Responses API | Rust 自实现 + extension 注入 |
| **Tool use** | 自定义 schema (无 native function call) | 闭源 (推测原生 + MCP) | 原生 + **MCP 一等公民** | **MCP (http/stdio/sse) 一等公民** | 原生 + MCP 渐进 | 原生 + extensions |
| **持久化 / Session** | 全靠 git history | CLI session 内 + Anthropic 后端 | webview session + workspace state | **多 session/project** | session 文件 | session + memory daemon |
| **沙盒/隔离** | 跑在 host shell | 跑在 host shell | 跑在 VS Code extension host | 跑在 host shell | Rust subprocess | desktop daemon |
| **Prompt 形态** | 单 system prompt | 闭源 (推测多 sub-agent) | 单 system + plan/act 切换 | 单 system + LSP 注入 | 单 system + 子任务 spawn | 单 system + extension hooks |

**这张表里几个关键观察**：

1. **MCP 是 runtime 派的新分水岭**。Cline / Crush / Claude Code / Codex 都把 MCP 当一等公民。**Aider 没有 MCP**——这是 Aider 进入维护期的最大技术债。MCP 是 2025 年下半年事实上的 agent tool 标准，没接 MCP 的 runtime 在 2026 年就接不到 1000+ Composio toolkit 生态。
2. **持久化是一条没人解决好的边**。所有 runtime 的"session"都是进程内/工作区内概念，**没有一个能跨设备跨时间真正恢复"我上次做到哪儿"**。Goose 的 desktop daemon 是最接近的尝试。**这是 Phase 1 没明确指出的 6 个开放问题之外的第 9 个开放问题**：runtime 派需要持久化层，要么自己做要么外接（这个外接位是 HumanLayer/CodeLayer 在抢的市场）。
3. **沙盒严重缺失**。除了 Goose 的 desktop daemon 形态，4 个主对比对象的 runtime 都直接跑在 host shell 上——这意味着 Phase 1 提到的 SWE-ReX 这种"agent 用沙盒执行"的 infra 还没被任何主流 runtime 默认采用。**这是 Archetype 5 (Infra) 的另一个 untapped 市场**。

---

## 5. Runtime vs Harness 边界：哪些不该叫 runtime

Phase 1 已经画过这条线，但 radar 里有几个项目实际归错了。本期借机校正。

**正经的 Runtime（满足"给最终用户用 + 有 onboarding + 有错误恢复 + 有持久化 session"）**：Aider、Claude Code、Cline、Crush、Codex CLI、Gemini CLI、Goose、gptme、Plandex、Qwen Code、Continue、Cline、Roo Code、Kilo Code。

**实际是 Harness 但被混称为 Runtime 的 radar 项目**：

- **mini-swe-agent**（Phase 1 已正确归为 Harness）—— radar 类别 1 把它当 runtime 列是错的
- **OpenHarness**（HKUDS）—— 名字带 Harness 但被 radar 当 runtime。**实际上它是双层**：Harness 框架 + Ohmo 个人助手参考实现。Harness 那一层应归 Archetype 2，Ohmo 那一层是 runtime。Radar 把它整体当 runtime 是简化失真
- **Trae Agent** —— "research-friendly architecture" 是典型 Harness 自我定位（Phase 1 已识别为大厂 OSS 装门面），它真不是 runtime——它是字节让研究者跑 SWE-bench 的 Harness。Radar 当 runtime 是命名混淆
- **Confucius Code Agent**（Meta facebookresearch/cca-swebench）—— 名字就有 swebench，纯 Harness
- **Live-SWE-agent**、**SE-Agent** —— 都是 Harness（Phase 1 deepdive 已认定为学术 PoC dump）

**为什么这条线值得在第 2 期专门厘清**：因为 radar 对 Boris 的核心价值是"决定每周扫什么"。**如果一个项目是 Harness 而不是 Runtime，它的更新节奏服务的是 paper deadline 而不是 user growth**——就该按论文圈的节奏跟（季度回看），而不是按产品圈的节奏跟（周扫）。

校准后的"真正 Runtime 派"在 Boris radar 里只有 14 个（不是表面 20 个），**第 2-7 期的扫频策略可以据此调整**。

---

## 6. 各自最大的赌注：哪个押对的风险高

把第 2 节的"如果错了"展开成可观测命题。每条都是 12 月内可被证伪的。

### Aider 押"git 永远是核心抽象"
**证伪条件**：Sem/Weave 任意一家被 Cursor/Claude Code/Codex 默认集成（Phase 1 开放问题 1），且 entity-level diff 在主流 SWE workflow 里成为新 baseline。**当前风险等级：中-高**。因为 Aider 已经 8.5 个月没出 release，连"如果发生我能跟上"的能力都在退化。

### Claude Code 押"Anthropic 模型代差永远存在"
**证伪条件**：6 月前出现一个用开源模型（Devstral/Qwen/Kimi-CLI）跑到 ≥70% Verified 的可复现实现（Phase 1 开放问题 4）。**当前风险等级：低-中**。Claude Opus 4.5/4.6/4.7 仍领先 SWE-bench Verified，但开源追赶速度比 18 个月前任何人预期的都快。

### Cline 押"VS Code 永远是 IDE 主战场 + plan/act 是真需求"
**证伪条件 A**：Cursor / Antigravity 这种 agent-native IDE 在企业市场拿到 50% 以上 IDE share；**证伪条件 B**：parallel agents（Emdash 这一派）成主流，把 IDE 内单 agent 的位置稀释。**当前风险等级：中**。Cline 已经在做 standalone 是对的——它自己也意识到了风险。

### Crush 押"终端 TUI UX 是真需求"
**证伪条件**：未来 12 月没有任何独立 TUI runtime（非厂商出品的 Codex/Gemini/Claude Code）拿到 50k+ stars。**当前风险等级：中-高**。Crush 现在 23k——和 Aider 当年同期相比偏慢。OpenCode 死了、Plandex 停了、gptme 增速慢——TUI 这条线可能是结构性的小众。

### Codex CLI 押"OSS + 账号绑定 = 终极传送门"
**证伪条件**：OpenAI 模型订阅渗透不及 ChatGPT 普及度（即"会用 ChatGPT 但不会装 Codex CLI"的鸿沟无法跨越）。**当前风险等级：低**。78k stars + 30d 971 PRs 的工程节奏说明 OpenAI 已经把这赌注当成战略级。

### Goose 押"agent 是 desktop daemon"
**证伪条件**：6 月前 Goose 的 desktop 用户数没显著超过 CLI 用户数；或基金会路线导致决策慢于公司路线（看 v1.32 → v1.33 的 cadence）。**当前风险等级：中**。Goose 的形态最特殊也最敢，但 Block 自己的注意力还在 Square/Cash App，Goose 不是命脉。

---

## 7. 给 Boris 的判断

### 要用哪个：日常 agentic SE 工作选哪个 runtime

**主用 Claude Code，副用 Cline。** 理由：

1. **Claude Code 主攻 single-turn + 高质量 deep work**。Anthropic 模型在长 context + tool use 上的真实质量目前没其他 runtime 能比，且 1M context + prompt caching 在 CLI 默认开启省心。Boris 的 DeepDive 项目本身就是文本/spec/markdown 重的工作流——Claude Code 是天然 fit。
2. **Cline 副用做 IDE 内 plan/act**。当任务需要"我要看着它一步一步做" + 需要 IDE buffer 上下文时，Cline 的 webview UX 比 Claude Code 在终端里强。两个并存不冲突。
3. **不用 Aider**。8.5 个月没 release，已经从产品退化为模型 alias 维护品。除非 Boris 是 git-purist 重度依赖 auto-commit，否则没理由选 Aider over Claude Code。
4. **不用 Codex CLI / Gemini CLI**。这俩是 OpenAI / Google 模型用户的 default，Boris 既然有 Claude 主用就不必再开第三条 LLM 账户线。

### 要赌哪个：未来 12 月最可能扩张/被收购/拿融资

**最可能爆发：Cline**。理由：

- 61k stars 是 OSS runtime 派第一名（撇开 vendor-locked 的 Codex/Gemini）
- 仓库结构已显示 standalone / cli / 多 surface 准备 —— 它在脱离 VS Code 这个潜在天花板
- Plan/Act 双模式 + MCP 一等公民 —— 比 Aider 的固守、比 Crush 的 single session 都更能 scale 到企业场景
- 投资视角：**它是这一派里唯一能讲出"OSS + 公司化 + 多 surface" 三重 narrative 的项目**

次选押注：**Goose**。理由——desktop daemon 形态如果对了，会跨过 runtime → Archetype 3 (Autonomous SWE) 边界，这是更大的 narrative。但 Block 自家注意力分散是变量。

**最可能被收购**：Crush 或 Cline。Charm 团队（Crush）和 cline.bot 都是合理的被 Anthropic / OpenAI / GitHub 收购对象——一旦 vendor 战决出胜负，赢家会买 OSS 品牌固化生态。

### 要丢弃哪个：从 radar 里降权

**降权 / 季度回看**：
- **Aider**：从"周扫"降到"季度回看"。除非出 v0.87 + 加 MCP 这种重大动作，否则没消息可追
- **Plandex**：已停滞 6 个月，从 radar 降为参考
- **gptme**：本地优先派单点项目，stars 4k 增速慢，季度看一次足够

**保持每周扫**：Cline、Crush、Codex CLI（追 OpenAI 战略动作）、Goose（追 desktop daemon 数据）。

**第 2 期对 radar 的反向修正**：
1. **OpenHarness** 应在第 5 期（Harness）里讲，第 2 期不再当 runtime 跟
2. **Trae Agent** / **Live-SWE-agent** / **SE-Agent** / **Confucius** 全部从 radar 类别 1（runtime）剔除，移入类别 5/8（harness/eval）

---

## 8. 一段 contrarian：Cline 的 plan/act 其实比看起来更接近 Cursor

主流叙述里，Cline 是 IDE 内嵌 OSS 派代表，Cursor 是 native agent IDE 闭源代表，二者对立。

但仔细看：
- Cline 的 **Plan/Act 双模式** ≈ Cursor 的 **Ask/Edit/Agent 三模式**
- Cline 的 **MCP 一等公民** ≈ Cursor 在 0.45 后追加的 MCP 支持
- Cline 的 **standalone / cli / webview-ui** 多 surface ≈ Cursor 早期 fork VS Code 走的路

**真正的差异不是 OSS vs 闭源，而是"VS Code 扩展形态 vs IDE fork 形态"**。Cline 在用 VS Code 扩展机制做 Cursor 在用 fork IDE 做的事。这是两种产品形态在同一个产品哲学下的工程妥协差异——**等到 VS Code 扩展 API 边界限制 Cline 进一步演化时（已经在发生：standalone 目录就是答案），Cline 必然要么 fork VS Code，要么变成桌面 ADE**。

Boris 的预测：**Cline 在 12 月内会发布一个 standalone 桌面版本**（不再依赖 VS Code 安装），变成与 Cursor / Antigravity / Emdash 同一象限的产品。**这才是 Cline 真正的押注**——而不是它 README 里讲的"VS Code AI 助手"。

---

## 9. 本期收束

Runtime 派 4+ 个项目存在不是浪费，是因为**这一层有 4 个相互正交的押注同时在跑**：
1. **协作单位**之争（Aider 押 commit，Cline 押 plan）
2. **模型护城河**之争（Claude Code 押差距持续，Codex 押差距收敛）
3. **surface**之争（Crush 押 terminal，Cline 押 IDE，Goose 押 desktop）
4. **自治度**之争（Aider 押 pair，Goose 押 daemon）

12 月内会被回答的开放问题（接 Phase 1 第 7 条）：**早期独立 OSS agent runtime 赛道是否关闭**？观测点：
- Aider 是否在 6 月前出 v0.87 / 加 MCP（否：实锤进入维护期）
- Cline 是否发布 standalone 桌面版（是：从 IDE 派毕业）
- Crush 是否突破 50k stars（否：TUI 路线天花板印证）
- Goose 桌面 DAU 是否首次反超 CLI DAU（是：daemon 路线对了）
- 是否还有新 OSS runtime 拿到 1k+ stars（否：赛道关闭，全面让位给 vendor 派）

---

## Phase 3 前瞻

下期（第 3 期）转入 **Archetype 5：Agent-Native Infrastructure** —— 不再讨论谁来跑 agent，讨论 agent 自己怎么读 / 写 / 合并代码。Sem / Weave / Serena / Composio / SWE-ReX 五家会被放在同一张图上，主问题是：**当 runtime 派从 4 个收敛到 2-3 个时，谁来给所有 runtime 提供"看代码"和"改代码"的底层能力**——这条线在本期 4 个 runtime 的技术架构差异表里已经露出空缺（持久化、沙盒、entity-level diff 都没人做）。
