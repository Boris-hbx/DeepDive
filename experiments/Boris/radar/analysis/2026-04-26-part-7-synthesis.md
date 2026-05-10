# Synthesis：6 期回看、12 月预测、给 Boris 的最终 SOP

- 日期：2026-04-26
- 系列：Agentic SE 深度分析 **第 7/7 期（收官篇）**
- 依据数据：`./2026-04-26-part-1-landscape.md` 至 `./2026-04-26-part-6-review.md` 的全部论断 + `../2026-04-26-radar.md`（95 个 OSS）+ `../2026-04-26-deepdive.md`（6 个深度卡片）。**本期不做新调研**
- 本期定位：**收官篇 / 框架定稿 / 12 月预测 / 给 Boris 自己的 weekly workflow SOP**
- 字数：约 4500

---

## 0. 这一期是什么

不是 Phase 1-6 的目录复述。这一期做 4 件事：

1. **框架定稿**：7 个 archetype 吸收 Phase 2-6 的修正，给最终版 + OSS 可行性评级（一个 Phase 1 没有的新维度）
2. **三套分析轴的实战评估** + 反模式清单从 6 条扩到 9 条 + Phase 1 那 8 个开放问题逐个回答
3. **12 月预测 10 条**：每条带概率 + 时间点 + 可观测信号
4. **给 Boris 的最终 weekly workflow SOP**：周扫盘 / 双周盘 / 丢弃清单 / 日报选材规则 / 常驻栏目候选 + weekly 增量分析方法论

后半部分（第 6-7 节）是 Boris 直接抄进 weekly workflow 的实操内容。

---

## 1. 框架定稿：7 个 archetype 的最终定义

Phase 1 给的初始 7 个 archetype 在 Phase 2-6 实战中陆续被修正。本节是吸收所有修正后的最终版。**新增 OSS 可行性评级**这一维度——Phase 6 §11 论断 1 + Phase 4 三具尸体 + Phase 3 子类 D/E "伪 infra 需求" 共同迫使我们承认：**OSS 可行性不是 archetype 内在属性，是一道额外的筛子**。

### Archetype 1：Agent Runtime

- **最终定义**：跑完整 agent loop（plan→tool→observe→repeat）的进程或二进制，有 onboarding / 错误恢复 / 持久化 session，目标用户是人类开发者
- **最终代表**：Aider（维护期）、Claude Code（闭源）、Cline、Crush、Codex CLI、Gemini CLI、Goose、Continue
- **删除 / 降级**：Plandex（已停滞）、gptme（小众）、AlphaCodium（实为 harness，已死）
- **Phase 2 关键修正**：从"runtime UX 是核心价值"修正为 **"runtime UX 服务的维度根本不在 SWE-bench 评测里"**（Phase 5 §3 层次 c 的反例）。runtime 的 UX 投入服务的是 fleet / 持久化 / cost / 协作 / review 这 5 个 SWE-bench 不评估的维度
- **OSS 可行性评级：中**。理由——provider-agnostic 的纯 OSS runtime（Aider 路线）已进入维护期；vendor-locked OSS（Codex CLI / Gemini CLI）由厂商承包，工程节奏远超社区版。**纯 OSS runtime 创业窗口已合上**
- **与 Archetype 2 (Harness) 的边界**：runtime 给最终用户用，harness 给评测跑。**这条线 Phase 2 §5 校正了 4 个 radar 项目的归类**（OpenHarness / Trae / Confucius / Live-SWE-agent 实为 harness）

### Archetype 2：Agent Harness

- **最终定义**：把 LLM 套上"能调工具"的最薄壳层，目标是跑 SWE-bench 类评测
- **最终代表**：mini-swe-agent（活）、SWE-agent 本体（活）、Agentless（已死 16 月）
- **Phase 5 关键修正**：mini-swe-agent 100 行拿 74% Verified 这件事的真正含义不是"agent 架构无意义"，而是 **"benchmark 维度太窄 + 模型能力已经吃掉 agent 架构差异 + Verified 设计偏向简单 harness"** 三层叠加（Phase 5 §3）
- **OSS 可行性评级：低**。harness 注定是少数学术团队的长期 SDK（Princeton / UIUC），不是创业赛道。**单 paper harness 注定 1 年内死**（Phase 5 §7 5 项目尸检全部命中）
- **与 Archetype 1 的边界已厘清**

### Archetype 3：Autonomous Software Engineer

- **最终定义**：拿 issue / ticket 输入 → PR 输出，中间过程对人不透明
- **最终代表**（OSS）：OpenHands（**唯一活体，且已 transition 到 infra 形态**）
- **最终代表**（商业）：Devin（67% merge rate）、GitHub Copilot Coding Agent（量级最大）、Jules、Codegen（被 Phase 6 补入）、Cursor Agents（部分形态）
- **删除 / 降级**：Devika（19.5k stars 但 7 月停滞）、Devon（11 月停滞）、Sweep（已转 JetBrains plugin）、daiv / hermes-swe-agent / pilot（个人项目 < 500 stars）
- **Phase 6 关键修正**："Archetype 3 在 OSS 视角下已死，仅商业品活"。**OpenHands 例外是因为它实质上从 Archetype 3 transition 到 Archetype 5 + Archetype 1 的混合**（Phase 6 §4）
- **OSS 可行性评级：极低**。Sweep / Devika / Devon 三具尸体已经把死亡剧本写完。**新进入 OSS autonomous SWE 赛道的项目几乎注定走完同一条曲线**

### Archetype 4：Agent Orchestrator

- **最终定义（Phase 4 §10 contrarian 修正）**：**这个名字 12 月内会分裂成两个**：
  - **"Session Manager"**（复制式 parallel）—— dmux / Emdash / cmux / Crystal / conductor 当前在做的事，本质是 "worktree 隔离 + agent 启动器"
  - **"Agent Fleet Manager"**（分工式 parallel，Anthropic 报告的真定义）—— Composio agent-orchestrator / OmoiOS 的方向，"task-decomposing agent fleet"
- **最终代表**：Emdash、cmux、dmux、conductor、Composio agent-orchestrator、AionUi（中国市场）
- **删除 / 降级**：Crystal（→ Nimbalyst）、Vibe Kanban（商业化失败）、HumanLayer / CodeLayer（30d 0 commits + 125 天没 release）
- **Phase 4 关键修正**：Phase 1 张力 2 的"parallel agents 是第三种 UX 标配"判断 **降级**——它是 IDE 厂商的 advanced feature（Cursor 3.2 已发布 multitask）+ 一小撮独立 orchestrator 服务 power user 的双轨格局，不是默认形态
- **OSS 可行性评级：中**。当前流派 A（dmux 类轻量 TUI）能活但永远小众；流派 B（重型 ADE）正面对刚 Cursor 3.2 + 已死 3 个；流派 D（Composio agent-orchestrator）是真潜力位但被 infra 派 upstream 占着

### Archetype 5：Agent-Native Infrastructure

- **最终定义（Phase 3 大幅收窄）**：**子类 A + 子类 C 才是真赛道**。Phase 1 把整个 infra 派当一个赛道是错的——它实际是 5 个子类，其中 D（Sandbox）/ E（Context Provision）是**伪赛道**
- **最终代表**：
  - 子类 A（Semantic Version Control）：Sem、Weave —— **唯一 runtime 做不出来的子类**
  - 子类 B（Semantic Code Retrieval）：Serena（人气王但收编风险中-高）、cocoindex-code、BifrostMCP
  - 子类 C（Tool / Integration Hub）：Composio（$25M Series A，infra 派天花板）
  - 子类 D（Sandbox）：SWE-ReX（已半停滞）、envd（维护期）—— **被云 PaaS + runtime 自建吃掉**
  - 子类 E（Context Provision）：opensrc、ref-tools-mcp —— **不构成独立赛道**
- **Phase 3 关键修正**：Phase 1 张力 5 "Code FOR agent 最被低估"判断需要精确化为 **"子类 A + 子类 C 才是真正赛道"**。子类 B 是过渡期需求，子类 D/E 不构成独立 OSS 赛道
- **OSS 可行性评级**（按子类细分）：
  - 子类 A：**高**（无人收编 + 重工程门槛 + 跨语言 AST 是 5+ 人年）
  - 子类 B：**中-低**（MCP 标准化 = 死刑判决，差异化只剩"实现质量"）
  - 子类 C：**高**（Composio 已实证）
  - 子类 D：**低**（被吃掉中）
  - 子类 E：**中**（utility 形态可活但做不大）

### Archetype 6：Agent Dev Tooling

- **最终定义**：让构建 agent 的人/团队工作更顺手的辅助工具
- **最终代表**：Ruler、HumanLayer/CodeLayer（**已实质停滞，作为定位漂移反例**）、Git AI、opensrc（Phase 3 反向修正建议从 infra 移到这里）
- **Phase 4 + Phase 3 关键修正**：HumanLayer 死因不是被同赛道挤死，是 **"agent dev tooling 这个伞概念里的项目最容易因为定位漂移而死"**（Phase 4 §5 第三具尸检）
- **OSS 可行性评级：低**。这个 archetype 充满"自我感动型项目"——开发者觉得自己需要的工具不等于市场需要

### Archetype 7：Evaluation Substrate

- **最终定义（Phase 5 大幅修正）**：评测 / 训练数据 / leaderboard / 训练环境
- **最终代表**：
  - 活：SWE-bench（鼻祖维护期，leaderboard 持续）、SWE-bench Pro（Scale，下一代候选）、Terminal-Bench（Laude，第二候选）、PRarena（弹药库非权威）、mini-swe-agent / SWE-agent（harness）、rllm（通用 RL infra）、Devstral（OSS model）
  - 死：SWE-bench Live（11 月停滞）、SWE-Gym、SWE-smith、AlphaCodium、AutoCodeRover、SE-Agent、Live-SWE-agent、Agentless、GitTaskBench、AlgoTune、EvoControl
- **Phase 5 关键修正**：
  - 张力 6 精确化为 **"单 paper benchmark KPI 项目结构性 1 年内死"**（不是所有 benchmark-driven，而是"单 paper"）
  - 开放问题 3 答案：**SWE-bench Pro + Terminal-Bench 双轨**（不是单一新权威）。Goodhart 周期 12-18 月
  - **Goodhart 不是病，是 benchmark 完成历史使命的标志**（Phase 5 §12 contrarian）
  - OpenEvolve 应从 evaluation 移到"Search/Optimization"
  - rllm 应降级到"通用 LLM 训练 infra"，不进 agentic SE 主表
- **OSS 可行性评级：中**。学术 / 基金会路线（Princeton / Laude / Berkeley）能活；Scale / 商业 benchmark 也能活；**单 paper 配套永远死**

### 一图收拢：7 个 archetype 的 OSS 可行性

| Archetype | 最终核心代表 | OSS 可行性 | 12 月内最大变量 |
|---|---|---|---|
| 1 Runtime | Cline / Crush（独立）+ Codex/Gemini CLI（厂商）| 中 | Cline 是否 standalone 桌面；Aider 是否复活加 MCP |
| 2 Harness | mini-swe-agent | 低 | 无（结构性少数学术团队） |
| 3 Autonomous SWE | OpenHands（唯一）| 极低 | OpenHands 是否新增 hosted PR review mode |
| 4 Orchestrator | Composio agent-orchestrator + Emdash | 中 | "orchestrator" 词义是否漂到 fleet manager |
| 5 Infra (子类 A) | Sem / Weave | **高** | Ataraxy Labs 是否 Series A |
| 5 Infra (子类 C) | Composio | **高** | 是否被收购或 Series B |
| 6 Dev Tooling | Ruler 等 | 低 | 无（碎片化） |
| 7 Eval | SWE-bench Pro / Terminal-Bench / PRarena | 中 | OpenAI 是否恢复报 Verified |

---

## 2. 三套分析轴的最终评估

Phase 1 给了三套轴（A 抽象层次 / B 接触面 / C 自治度）。6 期实战下来：

### 哪套轴最有解释力

**轴 A（抽象层次）最有解释力**。理由：
- Phase 2 用它把 runtime 派和 harness 派的边界画清，校正了 4 个 radar 项目的错归类
- Phase 3 在它基础上把 infra 派内部切成 5 个子类，**这是 6 期最重要的框架贡献**
- Phase 5 用它把"benchmark 跑分"和"产品价值"分开，解决了 mini-swe-agent 反例的解读

**轴 B（接触面）次之**。Phase 6 的精确切分"Inside-the-PR 实际是 4 块 4 命运"是它的高光时刻。

**轴 C（自治度）最弱**。理由：
- Phase 2 后基本没用到——一个项目同时能在多个自治度运行（Cline 的 Plan/Act 双模式就是反例），轴 C 区分度不强
- Phase 6 的"OSS / 商业边界"比"自治度"更能解释 Archetype 3 的死活

### 是否需要补第四套轴

**需要**。Phase 6 §11 论断 1-2 + Phase 3 子类 D/E 共同迫使我们承认：**OSS 可行性 / 商业可行性的边界是一道独立的筛子**——而且这道筛子比"自治度"对 Boris 更实用。

**第四套轴 D：OSS / 商业可行性边界**：
- **OSS 高**：子类 A（Sem/Weave）、子类 C（Composio）、长期 SDK 类 harness（mini-swe-agent）
- **OSS 中**：runtime 派、orchestrator 派、benchmark 派、Code FOR agent 子类 B
- **OSS 低 / 极低**：autonomous SWE、code review bot、子类 D 沙盒、子类 E context provision

**Boris 的实际选盘几乎只看轴 A + 轴 D**。轴 B 用来理解 surface 之争（写日报时偶尔需要），轴 C 在 Phase 1 后基本被 Plan/Act 双模式打成 binary 状态。

### 不容易归类的边界 case

- **OpenHands**：从 Archetype 3 transition 到 Archetype 5 + Archetype 1 的混合。**轴 A 失效**——同时跨多层
- **OpenHarness**：双层（Harness + Ohmo runtime），radar 简化失真
- **Composio agent-orchestrator**：infra 母体长出来的 orchestrator，**轴 A 不能单独归类**——它本质是 Composio infra 战略的延伸
- **Cursor Agents 在 PRarena 排第 3**：但 97% merge rate 是因为"用户在 IDE 里完成大部分工作然后让 Cursor 帮忙开 PR"——和"agent autonomous 产 PR" 完全不是同一件事。**轴 C 在这里失败**

---

## 3. 反模式清单更新（6 → 9 条）

### 原 6 条精确化

1. **反模式 1（学术 PoC dump）→ 精确化为"单 paper benchmark KPI 项目"**：识别信号细化为"项目存在唯一目的是出 1 篇 paper"而非"出现 paper.bib"。mini-swe-agent + Devstral 是反例（长期 SDK / 商业 model 性质能活）。Phase 5 §7 5 项目尸检全部命中
2. **反模式 2（大厂 OSS 装门面）→ Phase 6 §3 提出 2.b 变种**：**"商业 SaaS 完成 PMF 后抛弃 OSS 拐杖"**。识别信号：(a) 商业品 ARR 跨过 $25M，(b) OSS arm 最近 release 距今 > 18 月，(c) 商业品官网完全不提 OSS 入口。**CodeRabbit archive ai-pr-reviewer 是标准案例**
3. **反模式 3（病毒级暴涨）→ 兑现**：cmux 15.5k stars + 1395 open issues（11:1）+ oh-my-codex 一周涨 14k stars 全部命中。stars/issue ≥ 10:1 是精确特征
4. **反模式 4（fork 链）→ 维持**：Roo Code / Kilo Code / Coro Code 健在但维护负担显现
5. **反模式 5（一次性 hello-world）→ 维持**：占 95 个 radar 项目约 1/3。跟踪 ROI 极低
6. **反模式 6（YC 押注同质化）→ 实锤**：Phase 4 数据兑现——4 个月内死 3 个（Crystal / Vibe Kanban / HumanLayer）。**同质化 + 同时被 Cursor/Anthropic 上方挤压 = 死亡加速**

### Phase 2-6 新增 3 条

7. **反模式 7（runtime 维护期）—— Phase 2 提出**：**症状**：项目仍有 30d commits 但 release 距今 ≥ 6 月、commits 全是 model alias 维护、最新 PR 全是 dependency bump、不接 MCP / 不接新协议。**典型**：Aider（30d 14 commits + 8.5 月没 release）、Plandex（已停 6 月）。**识别信号**：搜索 PR 关键词 "alias / model settings / dependency"，占比 > 60%

8. **反模式 8（OSS autonomous SWE 死亡剧本）—— Phase 6 提出**：**症状**：阶段 1 病毒式 stars → 阶段 2 发现 merge rate 上限 → 阶段 3 转 IDE 内 assistant 或停滞。**典型**：Sweep（已转身）、Devika（19.5k stars + 7 月停滞）、Devon（11 月停滞）。**识别信号**：stars > 3k 但 production merge rate 数据从未公开 + 6 月内无新 release

9. **反模式 9（agent dev tooling 定位漂移）—— Phase 4 提出**：**症状**：项目从一个伞概念漂到另一个（"human-in-the-loop"→"multi-Claude IDE"→"context engineering"），每次定位转移都没找到 PMF。**典型**：HumanLayer / CodeLayer（10.6k stars + 30d 0 commits + 125 天没 release）。**识别信号**：项目 README 在过去 12 月内被重写 ≥ 3 次且每次主标题不同

---

## 4. Phase 1 的 8 个开放问题逐个回答

### 问题 1：Sem/Weave 会被 Cursor/Claude Code/Codex 集成进 diff/merge 流程吗？

- **当前答案：仍未回答**
- **关键证据**（Phase 3 §2）：Sem 30d 100+ commits、Weave 73 commits、Apache 2.0 license + 4 产品矩阵、但 Ataraxy Labs **无公开融资记录**
- **观测信号**：Cursor / Claude Code / Codex release notes 出现 "entity-level diff" 或 "structural merge"

### 问题 2：parallel agents 会成为继 chat、inline 之后的第三种 UX 标配吗？

- **当前答案：已部分回答 — 否（降级）**
- **关键证据**（Phase 4 §3 + §6 + §10）：Cursor 3.2 已加 multitask + worktrees + tiled agent panes，但做成 advanced feature 而非 default UI 范式。4 个月内 Crystal / Vibe Kanban / HumanLayer 死亡 = YC 押注同质化兑现
- **修正版判断**：parallel agents 是 IDE 厂商 advanced feature + 一小撮独立 orchestrator 服务 power user / solo dev / 中国国产场景的**双轨格局**，**不会成为所有开发者每天的 default surface**

### 问题 3：SWE-bench Verified 80% 之后下一个权威 benchmark 是什么？

- **当前答案：已回答 — SWE-bench Pro + Terminal-Bench 双轨**
- **关键证据**（Phase 5 §2）：OpenAI 已停止报 Verified、转推 Pro；Anthropic 同时报 Verified + Pro + Terminal-Bench；Live 已死
- **次要发现**：PRarena 是分析弹药库非权威。**Goodhart 周期 12-18 月**——Pro 也会被 Goodhart 化

### 问题 4：Devstral / Qwen Code / Kimi-CLI 等开源 code LLM 能否撬动闭源垄断？

- **当前答案：部分回答 — 路径成立，差距仍 40pp**
- **关键证据**（Phase 5 §6）：Devstral（24B + RL + OpenHands harness）拿 46.8% Verified vs Anthropic 87.6%
- **观测信号**：6 月内出现首个 ≥70% Verified 的 OSS 模型实现。**当前概率 < 30%**

### 问题 5：infra 派会出现 Composio 之外的第二个明星吗？

- **当前答案：仍未回答（最可能候选已锁定）**
- **关键证据**（Phase 3 §10）：Sem/Weave (Ataraxy Labs) 是子类 A 唯一玩家 + 工程节奏强
- **观测信号**：Ataraxy Labs Series A 公告（按节奏 2026-Q3 应到时间）

### 问题 6：HKUDS 模式（学术组+网红流量）是否可复制？

- **当前答案：仍未回答（Phase 1 后未深挖）**
- **关键证据**：6 期里只有 Phase 1 提到 OpenHarness 25 天 11k stars 的暴涨
- **观测信号**：OpenHarness 90 天后（2026-07-01）的 commit/issue 比；如果衰减，HKUDS 模式被验证为"上线即热但难持续"

### 问题 7：Aider/GPT Engineer 已 archive 是否预示"早期独立 OSS agent runtime"赛道关闭？

- **当前答案：已回答 — 是**
- **关键证据**（Phase 2 §6 + §9）：Aider 30d 14 commits + 8.5 月没 release，已实质进入维护期；Plandex 2025-10 后停滞；Crush 23k 增速比 Aider 当年慢；新独立 runtime 没有突破 1k stars 的（除 vendor-locked 派）
- **结论**：Phase 1 第 7 个开放问题的标准答案是 **"已关闭"**——这个 archetype 已经被 vendor 官方品（Claude Code/Codex/Gemini）和 IDE 内嵌品（Cline/Cursor）瓜分

### 问题 8：Code FOR Agent 这条线是否会出现 IPO 候选？

- **当前答案：已回答 — Composio 已是 pre-IPO trajectory 但被收购概率 > 独立 IPO**
- **关键证据**（Phase 3 §4）：$25M Series A + Lightspeed + Vercel/HubSpot/Rubrik 创始人 angel + agentic learning infrastructure 战略转向
- **次要观察**：CodeRabbit $40M ARR + $550M valuation 是另一个 IPO 候选（review 端而非 Code FOR agent 端）

---

## 5. 12 月预测：10 条带概率和观测信号

每条结构：**预测 / 概率 / 时间点 / 可观测信号**。

### 预测 1：Composio 12 月内被收购或拿 Series B（>$50M valuation 上调）

- **概率**：高（70%）
- **时间点**：年底前
- **信号**：Composio 官博 / TechCrunch / Lightspeed 公告。被 Anthropic / OpenAI / Salesforce 收购的概率高于独立 Series B

### 预测 2：Ataraxy Labs（Sem/Weave）拿 Series A，否则团队解散

- **概率**：binary（融资 60% / 解散 40%）
- **时间点**：6 月前
- **信号**：Ataraxy 官博 + a16z/Sequoia/Greylock 任一家的 thesis 文章里出现 "structural merge" 字样

### 预测 3：Cline 12 月内发布 standalone 桌面版本（脱离 VS Code 宿主）

- **概率**：高（75%）
- **时间点**：年底前
- **信号**：Cline release notes 出现 standalone .dmg / .exe 包；cline/standalone 目录被 promote 到主 README

### 预测 4：Aider 12 月内出 v0.87 或 archive 二选一

- **概率**：偏向 archive（archive 60% / 复活 40%）
- **时间点**：年底前
- **信号**：v0.87 加 MCP（复活信号）；或 README 加 "in maintenance" / archive 标签（死亡确认）

### 预测 5：Cursor 把 multi-session 做成 default UI（不再是 advanced feature），独立 orchestrator 派进一步收缩

- **概率**：中-高（65%）
- **时间点**：6 月前（Cursor 3.4-3.5 cycle）
- **信号**：Cursor changelog；dmux / Emdash / cmux 任意一家 30d commit 数显著下降（同期对比）

### 预测 6：Emdash 拿 Series A（量级 $20-30M，对标 conductor）

- **概率**：中（55%）
- **时间点**：6 月前
- **信号**：YC W26 demo day 后 conductor 用了 12 个月走到 $22M Series A，Emdash 应在 6 月内有动作

### 预测 7：6 月内不会出现 ≥70% Verified 的 OSS 模型；12 月内可能出现 ≥60%

- **概率**：6 月 < 30% / 12 月 60%
- **时间点**：12 月
- **信号**：Mistral / Qwen / DeepSeek / Kimi / Meta 任一家发布新 OSS code-specific model + 第三方独立验证 Verified 跑分

### 预测 8：OSS autonomous SWE 赛道在 12 月内再死至少 1 家（在 OpenHands 之外）

- **概率**：高（80%）
- **时间点**：12 月
- **信号**：daiv / hermes-swe-agent / pilot 之一停止维护；或 Devika / Devon 进一步从 GitHub 删除

### 预测 9：Codegen 或 Greptile 之一被 GitHub / Anthropic / Microsoft 收购

- **概率**：中（50%）
- **时间点**：12 月
- **信号**：TechCrunch / The Information 报道；GitHub blog；Greptile ARR 公开数字跨过 $20M 阈值

### 预测 10：出现至少 1 个明确挂 "AI-aware review" 标签的 OSS 项目突破 1k stars

- **概率**：中-高（60%）
- **时间点**：12 月
- **信号**：GitHub trending；Hodor / Gito / Mutahunter 任一家转向"AI-aware"定位；或全新项目挂这个标签

### 加分预测（不计入主 10 条）

- **大厂动作**：Anthropic 12 月内推出官方 "Claude Code Cloud"（autonomous SWE 形态）—— 概率 中（45%）
- **大厂动作**：字节 / Meta 在 agentic SE OSS 上的投入持续低于 Google / Microsoft —— Trae Agent 80 天无 commit 不是孤例
- **新 archetype 不会出现**：12 月内不会出现第 8 个 archetype——所有变化都在 7 个内部消化

---

## 6. Boris 的 actionable 输出

这一节是 Boris 直接抄进 weekly workflow 的内容。

### 6.1 最终深度跟踪盘（每周必扫，10 个项目）

按 archetype 分组。**每周扫的标准**：项目对 Phase 1 那 8 个开放问题或第 5 节那 10 个预测有直接观测价值。

| # | 项目 | Archetype | 跟踪理由（一句）| 关键观测信号 |
|---|---|---|---|---|
| 1 | **Cline** | 1 Runtime | OSS runtime 派最可能扩张品 | release notes / standalone 目录变化 / MCP 集成节奏 |
| 2 | **Crush** | 1 Runtime | TUI 路线天花板验证 + Charm 品牌健康度 | 30d commit 数 / 是否突破 50k stars |
| 3 | **Codex CLI** | 1 Runtime | OpenAI 战略动作风向标 | 30d PR 数（当前 971，看是否减速）/ Rust 重写进度 |
| 4 | **Sem** | 5 Infra A | Code FOR agent 子类 A 唯一玩家 | Ataraxy 官博 / Cursor / Claude Code release notes 出现 entity-level diff |
| 5 | **Weave** | 5 Infra A | merge driver 是否被任何 OSS runtime 默认 | .gitattributes 配置出现在主流 OSS runtime |
| 6 | **Composio** | 5 Infra C | infra 派天花板 + Series B / 收购候选 | 官博 / Lightspeed 公告 / TechCrunch |
| 7 | **Composio agent-orchestrator** | 4 Orch (D 流派) | infra → orchestrator 包抄是否成立 | stars 增速 / SaaS 化进度 |
| 8 | **Emdash** | 4 Orch (B 流派) | YC W26 押注是否兑现 | Series A 公告 / 用户量 / Cursor 反应 |
| 9 | **OpenHands** | 3 Autonomous SWE | OSS autonomous SWE 唯一活体 | release / Kubernetes + RBAC 进度 / 是否新增 hosted PR review mode |
| 10 | **PRarena dashboard** | 7 Eval | 唯一中立的产 PR 数据源 | 数据更新 / 是否新增第 7 个 agent |

**Cursor changelog** 不在表里但**应作为周扫 sidebar**——决定 orchestrator 派 + runtime 派生死的最重要单一 signal source。

### 6.2 双周扫描盘（次优先级，8 个项目）

| 项目 | Archetype | 跟踪理由 |
|---|---|---|
| Goose | 1 Runtime | desktop daemon 路线是否对 / DAU 反超 CLI |
| Gemini CLI | 1 Runtime | Google 三条线（CLI + Jules + Antigravity）哪条赢 |
| Serena | 5 Infra B | Cursor 是否内建 semantic search（Serena 存亡信号）|
| AionUi | 4 Orch | 中国市场 orchestrator 第一名 / 是否突破 30k stars |
| Codegen | 3 Autonomous SWE | 被低估的第二真 autonomous SWE，被收购候选 |
| CodeRabbit | (商业) | review 端龙头，下一个动作（IPO / 大客户）|
| Greptile | (商业) | 被收购候选 |
| SWE-bench Pro leaderboard | 7 Eval | 下一代权威候选第一名，新 submission |

### 6.3 已可丢弃 / 降权清单

明确从 radar 主表删除或降到"季度回看 / 案例库"。

**完全删除**：
- **Crystal**：已 deprecated 转 Nimbalyst
- **Vibe Kanban**：商业化失败转 OSS
- **Devon**：11 月停滞
- **Sweep**：已转 JetBrains plugin（不再是 issue→PR bot）
- **ai-pr-reviewer**：archived 2025-12-18
- **Mutahunter**：12 月停滞
- **SWE-bench Live**：11 月停滞
- **EvoControl**：3 月停滞 + 论文配套
- **Confucius Code Agent**：Meta 大厂装门面标本

**降到"季度回看 / 案例库"**：
- **Aider**：除非 v0.87 + MCP 否则没消息可追
- **Plandex**：已停 6 月
- **HumanLayer / CodeLayer**：作 reset 反例 9（定位漂移）保留
- **Devika**：作 reset 反例 8（OSS autonomous SWE 死亡剧本）保留
- **Agentless / AutoCodeRover / Live-SWE-agent / SE-Agent / AlphaCodium / GitTaskBench / SWE-Gym / SWE-smith**：作 reset 反例 1（单 paper benchmark KPI）保留
- **SWE-ReX / envd**：作 reset infra 子类 D "伪赛道"标本保留
- **opensrc / ref-tools-mcp**：作 reset infra 子类 E "不构成独立赛道"标本保留
- **gptme**：本地优先派小众
- **Trae Agent / OpenHarness**：归 harness 而非 runtime；OpenHarness 90 天观测点（2026-07-01）

### 6.4 日报选材建议

**该入日报的 7 类**：
1. **infra 派融资 / 收购**：Composio / Sem/Weave / Serena 任一家融资公告
2. **PRarena 数据更新（每周）**：以"绝对量级 + 趋势变化 + 复杂度归一化估算"三元组形式，不引用排名
3. **大厂 release notes 中的 benchmark 选择**：Anthropic / OpenAI / Google 用哪个 benchmark 报新 model 分数（决定权威格局）
4. **OSS autonomous SWE 死亡 / 转身**：daiv / pilot / hermes-swe-agent / Devika / Devon 任一家
5. **YC / a16z / Sequoia 在 agentic SE 的新押注**：明确赛道 + 量级
6. **Cursor / Cline / Crush / Claude Code release notes 中的 agent 形态变化**：parallel agents / standalone / multi-session / MCP 一等公民
7. **新挂 "AI-aware review" 标签的 OSS 项目突破 1k stars**：§5 预测 10 兑现信号

**不该入日报的 6 类**：
1. **"X 模型拿 Y% SWE-bench Verified"**：跑分新闻搬运工模式，价值已耗尽
2. **个人 hello-world 项目**：< 500 stars + 1 contributor + 30d 集中 commits（Phase 1 反模式 5）
3. **Cline / OpenCode fork 链新版本**：Roo Code v0.X / Kilo Code v0.X 这类（Phase 1 反模式 4）
4. **单仓库 / < 500 stars 的新 OSS code review bot**：已被 Phase 6 §11 论断 1 结构性证伪
5. **任何"我们也开源了 code review bot"的公司公告**：CodeRabbit 死亡剧本会重演
6. **PRarena 排名变动新闻**："X agent 排第 N" 类型（任务复杂度不可比，排名误导）

**常驻栏目候选 3 个**：
- **本周 PRarena 数据**（每周 100 字 sidebar）：绝对量级 + 趋势变化 + 复杂度归一化估算
- **本周 archive 清单**（每周 sidebar）：哪些 OSS 项目本周 archive / 30d commits 跌到 0 / release 距今超过 6 月
- **本周 funding**（每周 sidebar）：agentic SE 赛道融资 / 收购 / IPO 公告（按 archetype 标注）

不建议设的栏目：
- **本周 SWE-bench leaderboard 更新**——Phase 5 §10 已论证，跑分新闻价值已耗尽
- **本周新 GitHub trending agent OSS**——Phase 1 反模式 3 + 5 决定多数是噪声

---

## 7. 给后续 weekly 增量的方法论

不是 README.md 已有的"如何写 weekly"流程，是 6 期实战提炼的**有效与无效方法**。

### 6 期里被验证有效的研究方法（应在 weekly 复用）

1. **PRarena 数据交叉验证**（Phase 5 + Phase 6 高频使用）：当厂商自报 metric 时，用 PRarena 公开数据做 lower bound 对照（如 Devin 67% vs PRarena 60.9%）
2. **30d commit 数判断停滞**（Phase 2 / 3 / 4 / 5 / 6 全部用）：30d commits = 0 + release 距今 > 6 月 = 实质停滞。这比"contributors 数量"更精确
3. **stars/issue 比例判断病毒虚高**（Phase 4 兑现）：≥ 10:1 = 病毒期特征（cmux、oh-my-codex 命中）
4. **README 第一段识别项目类型**（Phase 1 / Phase 5 / Phase 6 用）：出现 paper.bib / arXiv / "research-friendly" → harness；出现 "This repo is not the X free tier!" → 商业品 funnel；出现 "agentic development environment" → 流派 B 重型 ADE
5. **对照表横切法**（Phase 2 §4、Phase 3 §1、Phase 4 §1、Phase 5 §1、Phase 6 §1 全用）：把同类 5-12 个项目放一张表（stars / 30d commits / contributors / release 距今 / 商业化）—— **几个反直觉信号自动浮现**
6. **fork 后 diverge LOC 替代 stars 评估 fork 项目**（Phase 1 反模式 4 提出）：Roo Code 加了 multi-mode 是真贡献 vs 仅改名重发的 fork
7. **观测信号清单**（Phase 1-6 每期收束都有）：每个开放问题给 2-3 个具体可观测点（不是空泛预测）—— weekly 应继承这个习惯

### 被验证低效或误导的方法

1. **追 SWE-bench Verified leaderboard 排名**：Phase 5 已论证 Goodhart 化 + OpenAI 退出 + 维度狭窄。**追 Pro + Terminal-Bench 双轨更准**
2. **stars 作为项目价值代理指标**：Phase 3 §9 contrarian 1 已论证 Composio 28k stars 虚高（marketing artifact）；Phase 6 §1 Devika 19.5k stars 但 7 月停滞
3. **YC 批次作为 quality gate**：Phase 1 反模式 6 + Phase 4 兑现已论证。Crystal / HumanLayer / Vibe Kanban 都不是 YC 但走完同质化死亡剧本
4. **跟踪 < 500 stars 个人项目**：占 radar 项目约 1/3，跟踪 ROI 极低
5. **追"无 agent X% Verified"narrative**：Phase 5 已论证 Agentless 路线已被 mini-swe-agent 超越，没新意

### Weekly 增量的合理深度

基于 Phase 2-6 的实际产出量（每期约 4500 字 + 5-15 次工具调用 + 3-5 个对照表）：

- **字数**：weekly 增量每期 1500-2500 字足够（不是 4500）。Phase 2-6 的 4500 字是因为要画框架；weekly 是增量更新，不需要重画
- **项目数**：每期重点关注 3-5 个新项目 + 5-8 个 radar 已有项目的状态变化。**不要每期重新过 95 个 radar**
- **工具调用**：5-15 次。GitHub API 直拉元数据是核心；WebFetch / WebSearch 用于核对融资 / 收购 / leaderboard 数字
- **频率**：weekly。月度做一次"过期 archive 清单 + 反模式横切检查"
- **结构建议**：每期固定 4 节——(1) 本周 PRarena 数据 + 大厂 release notes（100-300 字）；(2) 新项目入 radar / 老项目降权（300-500 字）；(3) 对 7 个 archetype 任一的具体观察（500-1000 字）；(4) 对 Phase 7 的 10 条预测的进展更新（300-500 字）

### 一条核心建议

**weekly 增量不是 Phase 2-6 的延续，是 Phase 7 框架的检验**。每期应该问：本周观测到的事，是支持 Phase 7 的 10 条预测，还是反驳？是验证 9 条反模式，还是新增第 10 条？是兑现 7 个 archetype 的 OSS 可行性评级，还是迫使重新评估？

如果 weekly 写完后没有任何一条支持 / 反驳 Phase 7 的论断，那这周的增量就是噪声——应该考虑跳过本周或合并到下周。

---

## 系列收尾

7 期价值一句话总结：**用 7 个 archetype + 4 套分析轴 + 9 条反模式，把 95 个 OSS agent 项目从"看起来都很热闹"切成"哪几个真在长大、哪几个结构性必死、哪几个是 Boris 该每周扫的 10 个"——把噪声压到信号能听见的水平**。

推荐 weekly 增量从 **2026-05-03（下周一）** 开始。第一期 weekly 的核心任务：(a) 检查本周 Phase 7 的 10 条预测有无任一兑现 / 反驳信号，(b) 把 6.1 + 6.2 的 18 个项目按本期定义的扫描节奏跑一遍 GitHub API + leaderboard 状态，(c) 验证 6.4 的 7 该入 / 6 不该入选材规则在本周新闻里是否好用。**第一期 weekly 应控制在 2000 字内 + 8-12 次工具调用**，作为方法论压力测试。
