# Agentic SE Landscape 2026-Q2：一套理解 95 个 OSS 项目的分析框架

- 日期：2026-04-26
- 系列：Agentic SE 深度分析 **第 1/7 期**
- 依据数据：`../2026-04-26-radar.md`（95 个 OSS repo + 11 个商业对照） + `../2026-04-26-deepdive.md`（6 个早期候选深度卡片）
- 本期定位：**框架文 + 共享词汇** —— 不是项目目录，是一套能复用到第 2-7 期的分类轴、原型定义、张力点和反模式清单
- 字数：约 4500

---

## 前言：为什么要做这一期

Boris 的 radar 整理出来后，我立刻发现一个问题：**radar 里那 9 个临时分类是按"项目长什么样"分的，不是按"它在 agent 体系里扮演什么角色"分的**。

举例：
- "类别 1：自主代码 Agent (CLI / Terminal Daemon)" 里同时塞着 Aider（成熟的人机协作 pair programmer）、Codex CLI（绑 ChatGPT 账号的厂商 hub）和 mini-swe-agent（100 行的 benchmark harness）。三者目标用户、技术形态、商业模式毫无重合。
- "类别 5：Code Agent 框架/SDK/Harness" 里把 Composio（被 1000+ 工具调用的 toolkit 中介）和 how-to-build-a-coding-agent（教程仓库）放一起。前者是基础设施，后者是教学材料。
- Sem/Weave 被放在"类别 7：Agent 开发支撑工具"，但它们的雄心不是"工具"，是"重写 git"——这种归类完全埋没了它们的战略位置。

所以本期不会逐项目讲，而是给整个领域**搭一套有解释力的坐标系**，让后续 6 期深度文都能在这套词汇上展开。

---

## 1. 全景图：三套互补的分析轴

不存在"唯一正确"的分类。我提三套轴，每套在不同问题场景下最有解释力。

### 轴 A：抽象层次（Stack Layer）

这套轴回答的是"**这个项目在 agent 调用栈的哪一层**"。从下到上：

1. **Infra（被调用的）**：被 agent 当工具用，自己不"思考"。Sem/Weave（语义版本控制）、Serena（语义检索 MCP）、Composio（1000+ toolkit 中介）、SWE-ReX（沙盒执行）、ref-tools-mcp、envd 都属于这一层。**特征：用户是其他 agent，不是人**。
2. **Runtime（执行的）**：跑 agent loop 的进程/二进制本身。Aider、Claude Code、Codex CLI、Cline、Crush、Goose 是典型代表。**特征：有自己的主循环（plan→tool→observe），用户直接和它对话**。
3. **Harness（薄壳层）**：比 runtime 更轻——不发明新 agent loop，只把现有 LLM 套上工具调用框架交给 SWE-bench 跑。mini-swe-agent（100 行拿 74% Verified）、SWE-agent、Agentless（甚至明确反对"agent"）。**特征：为评测/研究而生，不是给最终用户用的**。
4. **Orchestrator（编排的）**：管理多个 runtime 进程。Emdash、conductor、dmux、Crystal、Agent Deck、ccmanager。**特征：自己不调 LLM，只调度其他 runtime**。

这套轴最大的价值是**让"我做的不是 agent 本身，我做的是给 agent 用的 X"成为一个清晰可表达的定位**。Ataraxy Labs 这种团队就是吃透了这一点——不和 Cline/Cursor 在 runtime 层卷，去做 infra 层。

### 轴 B：用户接触面（Surface）

这套轴回答的是"**人类怎么碰到它**"。

1. **CLI / Terminal**：Aider、Codex CLI、Gemini CLI、Crush、Goose、Plandex
2. **IDE 嵌入**：Cline、Continue、Roo Code、Kilo Code、Void、Cursor（闭源）
3. **桌面 ADE**：Emdash、Goose（也有桌面）、HumanLayer/CodeLayer。这是 2025-2026 出现的新形态——既不是终端也不是 IDE 内嵌
4. **Cloud / Async**：Devin、Jules、GitHub Copilot Coding Agent、daiv、hermes-swe-agent。issue 进 → PR 出，没有交互界面
5. **Inside-the-PR**：PR-Agent、CodeRabbit、Hodor、Gito。运行在 GitHub workflow 里，user-facing 是 PR comment

**这套轴的解释力**：它解释了为什么 95 个项目里至少 3 套生态（terminal-native / VS-Code-extension / cloud-async）几乎不互通——彼此甚至不互相 review 代码。也解释了为什么 OpenHands 这种"全入口"项目反而显得没特色。

### 轴 C：自治度（Autonomy Gradient）

这套轴回答的是"**人需要按多少次回车**"。

1. **Copilot / Pair**：每个建议都需要人确认。Aider 的传统模式、Continue
2. **Agent (task-level)**：给一个任务，agent 跑完一段后停下来等批准。Cline 的"plan → 我点 approve → 执行"是典型
3. **Autonomous SWE (issue-level)**：拿一个 GitHub issue 自己跑到 PR。OpenHands、SWE-agent、Devin、daiv、hermes-swe-agent
4. **Fleet / Multi-agent**：多个 issue 并行。SWE-Squad、SWE-AF、Emdash 编排下的 N 个 Claude Code 实例

**这套轴的解释力**：它直接对应"信任浓度"。同一个团队同一周，会在 (1) 用 Aider 改一个函数，在 (3) 让 Devin 修个低优先级 bug，在 (4) 让 Emdash 跑 5 个并行实验。**这不是替代关系，是叠加关系**——这点 radar 里没体现出来。

> **三套轴怎么用**：写技术对比时用 A（抽象层次），写市场/竞品时用 B（接触面），写工作流和团队成熟度时用 C（自治度）。后续 6 期每期挑一套主轴展开就行。

---

## 2. 核心 archetype：7 个有清晰边界的原型

基于上面三套轴交叉，提炼出 7 个原型。每个给定义、代表项目、与相邻原型的边界。

### Archetype 1：Agent Runtime

**定义**：实现完整 agent loop（plan → tool call → observe → repeat）的进程或二进制。用户直接和它对话，它直接调 LLM。
**代表**：Aider、Claude Code（闭源）、Cline、Crush、Goose、Codex CLI
**边界**：和 Harness 的区别在于 Runtime 是**给最终用户**用的产品（有 onboarding、有错误恢复、有持久化会话）；Harness 是给跑分用的最小可执行实现。

### Archetype 2：Agent Harness

**定义**：把 LLM 套上"能调工具"的最薄壳层，目标是让某个模型能跑 SWE-bench 类评测。
**代表**：mini-swe-agent（100 行）、SWE-agent、Agentless（甚至声称"don't need an agent"）
**边界**：和 Runtime 的区别——harness 不在乎 UX，不在乎错误恢复。被 SWE-Gym 这种训练环境调用，或被论文实验调用。**mini-swe-agent 拿 74% Verified 这件事**，恰恰说明 runtime 那些 UX 投入对 benchmark 性能其实没增量贡献。

### Archetype 3：Autonomous Software Engineer

**定义**：拿一个 GitHub issue / Linear ticket 作为输入，自动产出一个 PR 作为输出。中间过程对人不透明。
**代表**：OpenHands（OSS）、Devin（闭源）、Jules、daiv、hermes-swe-agent
**边界**：和 Runtime 的区别——Runtime 期望人在循环里；Autonomous SWE 期望人**不在**循环里。这种类别 GPT Pilot、GPT Engineer 已经在 2026-04 archive，是个值得警惕的信号。

### Archetype 4：Agent Orchestrator

**定义**：自己不调 LLM，只调度多个 Runtime 进程，处理 worktree 隔离 / session 切换 / 输出聚合。
**代表**：Emdash（YC W26）、conductor、dmux、cmux、Agent Deck、ccmanager、Crystal
**边界**：与"Multi-agent framework"（如 MetaGPT、ChatDev）不同——后者是**一个进程内多个 role**，前者是**多个进程并行**。Orchestrator 的产品形态比 multi-agent framework 实际得多——MetaGPT/ChatDev 这种"模拟软件公司"路线在 2024 年很热，但 2026 年活跃度明显不如 Orchestrator 派。

### Archetype 5：Agent-Native Infrastructure

**定义**：被多个 agent runtime 调用的底层服务。不直接面向人类用户。
**代表**：Sem / Weave（语义版本控制）、Serena（语义检索 MCP）、Composio（toolkit 中介）、SWE-ReX（沙盒）、BifrostMCP（VS Code 语义工具→MCP）、ref-tools-mcp
**边界**：与"Agent dev tools"的区别——dev tools 是给写 agent 的人用（如 Ruler 管 rule 文件、Git AI 追踪 attribution）；infra 是给 agent 自己运行时用。**这是当前最被低估的赛道**——投资人和媒体都在追 Runtime，但 infra 才是会被所有 Runtime 集成的，bottleneck 价值更高。

### Archetype 6：Agent Dev Tooling

**定义**：让构建 agent 的人/团队工作得更顺手的辅助工具。
**代表**：Ruler（统一 30+ agent 的 rule 文件）、HumanLayer/CodeLayer（context engineering）、Git AI（追踪 AI 写的每行）、opensrc（npm 包源码喂上下文）、how-to-build-a-coding-agent（教程）
**边界**：服务对象是开发者（写 agent 的、用 agent 的），不是 agent 自己。

### Archetype 7：Evaluation Substrate

**定义**：评测、训练数据、leaderboard、训练环境。
**代表**：SWE-bench（鼻祖）、SWE-bench Pro（更难）、SWE-bench Live（每月加新 issue 防污染）、Terminal-Bench、SWE-Gym、SWE-smith（训练数据生成）、PRarena（追踪真实 PR 数据）
**边界**：与 Harness 的区别——harness 是"跑评测的执行体"，evaluation substrate 是"评测本身（题目、判分、数据）"。

---

## 3. 横向张力：领域内还没有共识的 6 个争论

每个张力点援引具体项目作证据，给出我的判断。

### 张力 1：CLI vs IDE 嵌入——人去哪里和 agent 对话？

CLI 派：Aider、Claude Code、Codex CLI、Crush、Gemini CLI 全部押 terminal。
IDE 派：Cline、Continue、Cursor（闭源）、Roo Code、Void。

**数据**：Cline 61k stars，Cursor 是闭源最成功的 agent IDE，但 Aider 44k + Claude Code 周边生态（awesome-claude-code 41k stars）说明 CLI 派也极强。

**我的判断**：表面是 surface 之争，**深层是"agent 是 IDE 的功能 vs agent 自己是新的 IDE"之争**。Cursor/Cline 路线是把 agent 塞进现有 IDE；Aider/Claude Code 路线是直接绕开 IDE。当 agent 自治度足够高（Archetype 3、4），IDE 反而成累赘——没人会盯着 IDE 看一个跑 30 分钟的 autonomous agent。所以 CLI 派会随自治度提升而扩张。

### 张力 2：单 agent vs parallel agents

押单 agent：Aider、Claude Code、几乎所有 Runtime 项目。
押 parallel：Emdash（YC W26）、conductor、cmux、dmux、Crystal、Superset。

**数据**：parallel 派几乎全部诞生在 2025 下半年。Emdash 4.1k stars 但 87 contributors（不到一年）、cmux 15.5k——这是新形态。

**我的判断**：**parallel agents 是继 chat、inline 之后的第三种 UX 标配**。现在还在早期：worktree 隔离已成标配（Emdash、dmux 都用），但跨 agent 的 conflict resolution 没解决——这正是 Weave（entity-level merge driver）的市场。所以 Archetype 4（Orchestrator）和 Archetype 5（Infra）会**被同一波浪潮拉起来**。

### 张力 3：Provider-agnostic vs vendor-locked

Provider-agnostic：Cline（接所有 LLM）、Kilo Code（500+ models）、Aider（多 provider）、Crush、Emdash（23 个 CLI agent）。
Vendor-locked：Claude Code（只 Anthropic）、Codex CLI（只 OpenAI）、Gemini CLI（只 Google）、Qwen Code（只 Qwen）、Mistral Vibe（只 Mistral）。

**数据**：vendor-locked 全是 2025 年厂商官方出品。其中 Codex CLI 78k、Gemini CLI 102k——**vendor-locked 的 stars 增速整体压过 provider-agnostic**。

**我的判断**：vendor-locked 暂时赢在两点——(1) 厂商可以做账号绑定免去 API key 配置（Codex CLI 绑 ChatGPT 账号是关键 UX），(2) 厂商可以拿到独占的模型能力（Anthropic 的 prompt caching 和 1M context 在 Claude Code 里是默认状态）。但 OpenHarness 的 ohmo "复用订阅，不烧 API key" 是个值得注意的反向思路——如果它跑通了，vendor-locked 的账号绑定优势就没了。

### 张力 4：Opinionated workflow vs general agent

Opinionated：spec-kitty、moai-adk、Pythagora 路线（强 spec → 强 PRD → 强代码）、Kiro（spec-driven）。
General：OpenHands、Cline、Aider 路线——给你一个对话框自己想干嘛干嘛。

**数据**：opinionated 系普遍商业化（Pythagora 已是付费产品，Kiro 是 AWS 商业品），general 系更多 OSS。

**我的判断**：opinionated 在企业市场会赢——企业需要的不是"一个能干任何事的 agent"，而是"一个能保证按我们 SDLC 流程跑的 agent"。general 在开发者工具市场会赢——开发者讨厌被流程绑住。**这两边不是替代而是分化**。

### 张力 5：Agent ON code vs Code FOR agent

Agent ON code（用 agent 写代码）：Archetype 1-3 的几乎所有项目。
Code FOR agent（写给 agent 用的代码/工具）：Archetype 5（Infra）、ref-tools-mcp、envd、opensrc。

**数据**：Code FOR agent 的 stars 总和远小于 Agent ON code，但增速更猛——Sem 一个月 100+ commits，Composio 28k stars。

**我的判断**：这是 **2026 年最重要的认知转变**。早期所有人都在做"会写代码的 agent"，但当 agent 数量爆炸后，"给 agent 用的代码"成为新瓶颈。Sem/Weave 团队、Composio 团队是这一波最早的赢家。后续会出现"agent-native database"、"agent-native CI"、"agent-native 包管理"等等。这是后续 6 期里值得专门做一期的方向。

### 张力 6：Benchmark-driven vs product-driven

Benchmark-driven：Live-SWE-agent（79.2% Verified）、SE-Agent（80%）、AutoCodeRover（46.2%）、Agentless（50.8%）、Moatless（70.8%）。
Product-driven：Cursor（用户量）、Cline（star 数）、Aider（社区活跃度）。

**数据**：deepdive 卡片里 6 个 benchmark-driven 项目里 4 个已停滞或半停滞（Live-SWE-agent 3 个月无 commit、SE-Agent 7 个月无 commit、Trae Agent 80 天无 commit、Confucius Code Agent 是 Meta 论文配套）。

**我的判断**：**benchmark 驱动的项目结构性短命**——论文一发就完成 KPI，团队解散。Product-driven 的项目反而能持续。所以**SWE-bench 排行榜上的 SOTA 不应该是周报追踪重点**，反而是 PRarena 这种"追踪真实 merged PR 数量"的 benchmark 更值得跟。

---

## 4. 反模式：在 95 个项目里观察到的 6 种"坑"

deepdive 6 个里掉坑了 4 个，扩展到全 radar 这些模式更显眼。

### 反模式 1：学术 PoC dump

**症状**：论文一发就停。最后 commit 距 paper release 不超过 60 天，issue 区"我复现不出"无人答。
**典型**：Live-SWE-agent（3 月无 commit + 复现质疑）、SE-Agent（7 月无 commit）、Confucius Code Agent（Meta 论文配套，无后续）、AutoCodeRover（最后 commit 2024-11）、Agentless（最后 commit 2024-10）。
**识别信号**：repo 里出现 `paper.bib` 或 README 第一段就在引用 arXiv 编号；contributors ≤ 5 且全是同实验室的人。

### 反模式 2：大厂 OSS 装门面

**症状**：大厂 release 一个"开源版"，但真正在做的是闭源产品。开源版 0 release、PR 堆积无 merge。
**典型**：Trae Agent（字节，80 天无 commit + 0 release）、Sweep（已转 JetBrains plugin）、ai-pr-reviewer（CodeRabbit 早期版，archived）。
**识别信号**：repo owner 是大厂 org；商业产品（trae.ai、coderabbit.ai）和开源 repo 名字不同；README 里有"alpha / research-friendly"字样。

### 反模式 3：病毒级暴涨然后衰减

**症状**：30 天 5k+ stars，issue/star 比例严重失衡（11k stars 但 8 open issues = 大量观望者），核心贡献者 1 人扛大头。
**典型**：OpenHarness（25 天 11k，HKUDS 上线即热模式）、HKUDS 历史项目 LightRAG（19k+ 但维护节奏已降）。
**识别信号**：上线时间 < 90 天；核心 contributor 1 人 > 50% commits；社交媒体（Twitter/小红书）出现高度相似的安利文。

### 反模式 4：Cline / OpenCode fork 链

**症状**：fork 一个流行项目改名重发，原创性贡献边际。
**典型**：Roo Code（Cline fork，24k stars）、Kilo Code（OpenCode fork，19k stars）、Coro Code（Trae Agent Rust 重写）、trae-agent-rs（Trae Agent 另一 Rust 实现）。
**判断**：fork 不是天然有问题——Roo Code 加了 multi-mode 是真贡献。但 fork 链长了之后维护负担会出问题。**评估时应该看 "fork 后 diverge 了多少 LOC" 而不是 stars**。

### 反模式 5：一次性 hello-world 个人项目

**症状**：0-100 stars，1 个 contributor，commit 集中在 2-4 周内。
**典型**：radar 里 nimbus（0 stars，"Code that ships itself"）、open-swe（0 stars）、SWE-AGILE（4 stars）、hermes-swe-agent（9 stars）、SWE-Squad（11 stars）、codeye（2 stars）。
**判断**：这类项目占 95 个 radar 项目大概 1/3。不是没价值——其中可能藏着 idea 原型——但跟踪它们 ROI 极低。

### 反模式 6（新发现）：YC 押注同质化

**症状**：YC 同一批次出来 2-3 个做几乎一样的事的项目（parallel agents + worktree 是当前的"YC 拥挤赛道"）。
**典型**：Emdash（W26）、conductor（YC）、cmux、Crystal——4 个项目几乎相同的产品定位。
**判断**：YC 押注本身是信号（说明赛道被验证），但**先进入 ≠ 胜出**——Crystal 已 deprecated 转 Nimbalyst。所以"YC W26"标签不应该当成 quality gate。

---

## 5. 市场动力学：谁在出钱

### YC 的押注

YC W26 批次能识别出 **Emdash + conductor 同时下注 parallel agents + worktree**。这是 2026 年 YC 最聚焦的 SE agent 赛道。要看 W26 demo day（应在 2026-03/04 已发生）后是否有 Series A 公告，决定 parallel-agent 这条线是真趋势还是 YC 内卷。

### Anthropic 生态

Anthropic 不直接做开源 agent runtime（Claude Code 闭源），但**生态溢出**异常强：awesome-claude-code 41k stars，Claude Code 周边小工具（Open Sessions、cmux、Agent Deck、ccmanager）几乎构成一个独立的 ecosystem。Anthropic 的策略明显是"我做闭源核心，让生态做周边"——这是 OpenAI/Google 没复制成功的打法。

### OpenAI 生态

Codex CLI 78k stars + OpenAI Agents SDK + awesome-codex-skills。OpenAI 的策略是"我自己做 CLI + SDK，生态围绕我的产品"——更中心化。

### 大厂姿态对照

- **字节**：Trae 闭源 + Trae Agent OSS 装门面（80 天无 commit）。真精力在 trae.ai。
- **Google**：Gemini CLI（102k stars，2026 年 OSS agent stars 第一）+ Jules（async）+ Antigravity（agent-first IDE）。三条线全开。
- **Microsoft**：Copilot 三层（inline / chat / agent mode + cloud Coding Agent）。GitHub 集成是杀手锏。
- **AWS**：Q Developer + Kiro（spec-driven）。企业市场打法。
- **JetBrains**：Junie + Sweep（收编后转 JetBrains plugin）。绑 IDE 是核心。

### 开源专业户

- **Block (Goose)**：43k stars，Rust，已捐 AAIF/Linux Foundation——**唯一走基金会路线的 OSS code agent**。
- **HKUDS**：上线即热但 90 天后看维护衰减。
- **Charmbracelet (Crush)**：继承 OpenCode（已 archive）。Go + 漂亮 TUI 是品牌。
- **Ataraxy Labs (Sem/Weave)**：唯一专注 Archetype 5（Infra）的早期 startup，产品节奏极强。

---

## 6. 未来 6 个月会被回答的关键开放问题

不是空泛预测，是**有明确观测点**的问题。

1. **Sem/Weave 会被 Cursor/Claude Code/Codex 集成进 diff/merge 流程吗**？观测点：Ataraxy Labs 官博、Cursor changelog、Claude Code release notes 里出现 entity-level diff 字样。
2. **parallel agents 会成为继 chat、inline 之后的第三种 UX 标配吗**？观测点：Cursor / Claude Code / Cline 是否在 6 月前发布"multi-session" feature；Emdash + conductor 之一是否拿到 Series A。
3. **SWE-bench Verified 80% 之后下一个权威 benchmark 是什么**？候选：SWE-bench Pro（Scale 出品）、SWE-bench Live（防污染）、PRarena（真实 PR 数据）、Terminal-Bench。观测点：哪个 benchmark 被 Anthropic/OpenAI/Google 的官方 release notes 引用。
4. **Devstral / Qwen Code / Kimi-CLI 等开源 code LLM 能否撬动闭源垄断**？观测点：6 月前是否出现一个"用开源模型跑到 70% Verified"的可复现实现。
5. **"agent-native infra"会不会出现 Composio 之外的第二个明星**？候选：Sem/Weave、Serena、SWE-ReX。观测点：是否有 infra 项目拿到 $10M+ 融资。
6. **HKUDS 模式（学术组+网红流量）是否可复制**？观测点：OpenHarness 90 天后（2026-07-01）的 commit/issue 比；如果衰减，HKUDS 模式被验证为"上线即热但难持续"。
7. **Aider/GPT Engineer 已 archive 是否预示"早期独立 OSS agent runtime"赛道关闭**？观测点：6 月前是否还有新独立 runtime 拿到 1k+ stars——如果没有，意味着这个 archetype 已经被厂商官方品（Claude Code/Codex/Gemini）和 IDE 内嵌品（Cline/Cursor）瓜分。
8. **Code FOR Agent 这条线是否会出现 IPO 候选**？Composio 28k stars 是当前最像 IPO 体量的——观测点：是否拿 Series B、是否被 Anthropic/OpenAI 收购。

---

## 7. 学习路径：研究每个原型该怎么入门

不是项目列表——是**研究路径**，按"花时间最少 → 理解 archetype 最深"排序。

### 想理解 Agent Runtime（Archetype 1）
最少读 3 个 repo 的源码：
1. **mini-swe-agent**（100 行，30 分钟读完）：理解最小 agent loop 长什么样
2. **Aider**（成熟产品代码）：理解 git-aware、auto-commit、context window 管理这些实战 concern
3. **Cline**（VS Code 内的 plan/act）：理解 IDE 内 agent 怎么和编辑器协作

### 想理解 Agent Harness（Archetype 2）
1. 读 **mini-swe-agent README + 代码**（100 行）
2. 读 **Agentless 论文**：理解为什么"无 agent"反而能拿 50.8% Verified——这会颠覆"agent 越复杂越好"的直觉

### 想理解 Agent-Native Infra（Archetype 5）
1. 读 **Sem 的 README + 跑一遍 sem diff**（亲手感受 entity-level diff vs line-level diff）
2. 读 **Composio 的 architecture doc**：理解 1000+ toolkit 怎么暴露给 agent
3. 读一篇文章：搜 "agent-native infrastructure 2026" 找 a16z/Latent Space 上的 thesis 文章

### 想理解 Parallel Agents UX（Archetype 4）
1. 装 **Emdash 跑一遍**：用 Claude Code + Cursor 同时跑两个不同实验
2. 对比装 **dmux 或 cmux**：理解 tmux + worktree 的轻量路线 vs Emdash 的 ADE 路线
3. 读 **Crystal 的 deprecation note + 转 Nimbalyst 的原因**：理解这个赛道为什么这么卷

### 想理解评测（Archetype 7）
1. 跑一次 **SWE-bench**（用 sb-cli，云端，几十美金成本）
2. 看 **PRarena 的 dashboard**：理解"真实 merged PR"和"benchmark Verified" 是两件事
3. 读 **SWE-bench Pro 和 SWE-bench Live 的设计 doc**：理解为什么 benchmark 一定要持续更新

### 想理解 Agent Orchestrator（Archetype 4 vs 1 区分）
1. 跑 **Emdash 一周**
2. 读 **conductor.build 官网 + Y Combinator 介绍页**对比
3. 读 **Anthropic 关于 multi-agent 的 engineering 文章**

---

## 给 Boris 的 next-step 建议：第 2-7 期顺序

基于以上 landscape，建议第 2-7 期按以下顺序（**对原计划的微调**），每期主轴明确，避免重复：

| 期号 | 主题 | 主轴 | 重点 archetype | 一句话定位 |
|------|------|------|----------------|-----------|
| **第 2 期** | **Runtime 派对比** | 轴 A（抽象层次）+ 轴 C（自治度） | Archetype 1 | Aider vs Claude Code vs Cline vs Crush 四个 runtime 的设计哲学差异——为什么同一类东西要做四遍 |
| **第 3 期** | **Agent-Native Infra 深挖** | 轴 A | Archetype 5 | Sem/Weave + Serena + Composio 三家做"被 agent 用的基础设施"——这是 2026 年最被低估赛道 |
| **第 4 期** | **Parallel Agents 与 Orchestrator** | 轴 B（接触面）+ 轴 C | Archetype 4 | Emdash vs conductor vs dmux vs cmux——YC W26 拥挤赛道，谁跑出 |
| **第 5 期** | **Benchmark 之争 + Harness 反例** | 轴 A | Archetype 7 + Archetype 2 | SWE-bench 80% 后路在何方 + 为什么 100 行 mini-swe-agent 能拿 74%（训练/RL 并入此期作为子节） |
| **第 6 期** | **Code Review / PR Bot 的真实 ROI** | 轴 B | PR 类工具 + Archetype 3 | PR-Agent / CodeRabbit / Hodor / autonomous SWE 的 PR 谁的实际 merge 率高 |
| **第 7 期** | **Synthesis：12 个月回看 + 未来 12 个月预测** | 全部三轴 | 全部 7 个 archetype | 第 6 个开放问题各自给答案，更新 archetype 定义和反模式清单 |

**对原计划的关键调整**：
- 原计划第 3 期（infra）保留位置不变 —— Sem/Weave 节奏极快，6 月前可能就被大厂集成，新闻点在前
- 第 5 期 benchmark 提到 Archetype 2 (Harness) —— mini-swe-agent 是 benchmark 故事里最有 narrative 的反例
- 第 6 期把"review"扩展为"review + autonomous SWE 的 merge 率" —— 单看 review bot 故事不够大，加上 PRarena 数据就有看点
- **不建议单独做"训练/RL"一期** —— radar 里这块只有 5 个 repo 且半数是论文配套，不够撑 3000 字。并入第 5 期作为子节

**优先看的项目（按周扫频率分级）**，给后续每期作素材池：

- **每周必看**（4 个）：Sem、Weave、Emdash、Cline
- **双周看**（5 个）：OpenHarness、conductor、Goose、Composio、Serena
- **月度看**（3 个）：OpenHands、SWE-bench Pro、PRarena
- **季度回看**（停滞类）：Live-SWE-agent、SE-Agent、Trae Agent、AutoCodeRover、Agentless

这套节奏跑 12 周后回到第 7 期 synthesis，节奏刚好。
