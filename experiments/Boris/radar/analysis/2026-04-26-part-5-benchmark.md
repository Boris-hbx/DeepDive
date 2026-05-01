# Benchmark 之争 + Harness 反例：Goodhart 化的 SWE-bench、100 行打脸的 mini agent、被夸大的训练子赛道

- 日期：2026-04-26
- 系列：Agentic SE 深度分析 **第 5/7 期**
- 依据数据：`./2026-04-26-part-1-landscape.md`（Phase 1 Archetype 7 / 张力 6 / 反模式 1 / 开放问题 3 + 4）+ `./2026-04-26-part-2-runtime.md`（Phase 2 runtime vs harness 边界 + Aider 没接 MCP 的"runtime 维护期"判断）+ `./2026-04-26-part-3-infra.md`（Phase 3 子类 D 沙盒赛道结构性短命）+ `./2026-04-26-part-4-orchestrator.md`（Phase 4 orchestrator 派"复制式 parallel" vs "分工式 fleet" 矛盾）+ `../2026-04-26-radar.md` 类别 5 + 类别 8 + 本期新拉的 GitHub API + leaderboard 元数据快照（2026-04-26）+ swebench.com / morphllm 分析文 / labs.scale.com / Princeton HAL leaderboard / tbench.ai / mistral.ai/devstral
- 本期定位：**Archetype 7（Evaluation Substrate）派内对比 + Archetype 2（Agent Harness）反例分析 + 训练/RL 子节** —— Phase 1 张力 6（benchmark-driven 结构性短命）、开放问题 3（80% 后下一个权威 benchmark）、反模式 1（学术 PoC dump）三条主线在本期收束
- 字数：约 4500
- 主对比对象（benchmark）：SWE-bench Verified、SWE-bench Pro、SWE-bench Live、PRarena
- 主对比对象（harness）：mini-swe-agent、SWE-agent、Agentless
- 训练子节：rllm、SWE-Gym、OpenEvolve、Devstral、EvoControl
- 其他评测：Terminal-Bench、SWE-smith、GitTaskBench、AlgoTune、AlphaCodium

---

## 0. 本期不是什么

不是 SWE-bench leaderboard 的最新跑分搬运。不是"哪个 benchmark 最好"的论坛贴。**本期回答三个互相绞缠的结构性问题**：

1. **SWE-bench Verified 已经被刷到 87.6%（Claude Opus 4.7）甚至 93.9%（Claude Mythos Preview，2026-04-22）—— 这个数字还有意义吗，还是已经是 Goodhart 之物**？
2. **mini-swe-agent 100 行 Python + 一个 bash 工具 + 没有 tool-calling 接口能拿 >74% Verified —— 这件事到底说明什么**？是模型吃掉 agent 架构？是 SWE-bench 的设计偏向简单 harness？还是 runtime 派 4+ 个项目的 UX 投入对评测维度毫无贡献？
3. **训练 / RL 子赛道（rllm、SWE-Gym、OpenEvolve、Devstral）是真实存在的 OSS 战场，还是论文人为划出来的 narrative**？

Phase 1 第 3、4 个开放问题 + 张力 6 + 反模式 1 在本期同时被尸检。**结论会 contrarian 到至少 3 处**：(a) SWE-bench Pro 不是"下一个权威"而是 Scale 的产品营销工具，(b) mini-swe-agent 的 74% 不是"agent 架构无意义"而是"benchmark 维度太窄"，(c) 训练 / RL 子赛道在 OSS 视角下基本是论文人为划出的 —— 真训练 SWE 模型的人没出 OSS。

---

## 1. 数据：4 benchmark + 3 harness + 5 训练 + 5 其他评测，共 17 项目活跃度横评（2026-04-26 快照）

| Project | Archetype | Stars | Created | 30d commits | Contributors | 最新 release | 最近活动 | 商业化形态 |
|---|---|---|---|---|---|---|---|---|
| **SWE-bench**（鼻祖 + Verified） | 7 (eval) | **4,793** | 2023-10 | **0** | 30 | 无 release | last push 2026-04-01 | Princeton 学术品 |
| **SWE-bench Pro**（Scale 出品） | 7 (eval) | 364 | 2025-09 | **3** | 10 | 无 release | last push 2026-03-31 | **Scale AI 产品** |
| **SWE-bench Live**（防污染） | 7 (eval) | **2** | 2025-05 | **0** | n/a | 无 release | last push 2025-05-20 | 学术（已停滞）|
| **PRarena**（真实 PR） | 7 (eval) | 299 | 2025-05 | **65** | 7 | v0.1 (2025-06) | last push 2026-04-27（当天）| OSS 个人项目 |
| **mini-swe-agent** | 2 (harness) | **4,054** | 2025-06 | **5** | 30 | v2.2.8 (2026-03-24) | last push 2026-04-20 | Princeton 学术品 |
| **SWE-agent** 本体 | 2 (harness) | **19,065** | 2024-04 | n/a | n/a | n/a | last push 2026-04-20 | Princeton 学术品（NeurIPS 2024）|
| **Agentless** | 2 (harness) | **2,038** | 2024-06 | **0** | n/a | n/a | **last commit 2024-12-22** | UIUC 学术品（**16 个月停滞**）|
| **rllm** | 2/7 (training) | **5,450** | 2025-01 | **41** | 30 | v0.2.1.post1 (2025-12-18) | last push 2026-04-26（当天）| Berkeley Sky Computing Lab |
| **SWE-Gym** | 7 (eval/training) | 671 | 2024-11 | **0** | 5 | 无 release | **last push 2025-07-29** | 学术（ICML 2025 配套，9 月停滞）|
| **OpenEvolve** | 2 (training) | **6,082** | 2025-05 | **0** | 30 | v0.2.27 (2026-03) | last push 2026-03-18 | OSS（algorithmicsuperintelligence org）|
| **EvoControl** | 2 (training) | 118 | 2026-01 | **0** | n/a | n/a | last push 2026-01-25 | QuantaAlpha 学术 |
| **Devstral**（model） | n/a (model) | n/a | 2025-05 (release) | n/a | n/a | Devstral-Small-2505 | active via Mistral | **Mistral × All Hands AI 商业 OSS 模型** |
| **Terminal-Bench** | 7 (eval) | **2,090** | 2025-01 | **0** | 30 | 无 release | last push 2026-01-22 | Laude Institute（学术-基金会混合）|
| **SWE-smith** | 7 (training data) | 631 | 2025-05 | **0** | 20 | n/a | last push 2026-04-20 | Princeton 学术品（NeurIPS 2025 D&B Spotlight）|
| **GitTaskBench** | 7 (eval) | 252 | 2025-08 | n/a | n/a | n/a | last push 2025-09-22 | QuantaAlpha 学术（**7 个月停滞**）|
| **AlgoTune** | 7 (eval) | 95 | 2025-07 | n/a | n/a | n/a | last push 2026-03-12 | NeurIPS 2025 配套 |
| **AlphaCodium** | 2 (harness) | 3,935 | 2024-01 | n/a | n/a | n/a | **last push 2024-11-25** | Codium AI（已转 Qodo 商业品）|
| **SE-Agent**（停滞） | 2 (harness) | 268 | 2025-07 | **0** | 5 | n/a | **last push 2025-09-22** | QuantaAlpha 学术 |
| **AutoCodeRover**（停滞） | 2 (harness) | 3,069 | 2024-04 | n/a | 14 | n/a | **last push 2025-04-24** | NUS 学术品 |
| **Live-SWE-agent**（停滞） | 2 (harness) | 376 | 2025-11 | n/a | n/a | n/a | **last push 2026-01-19** | OpenAutoCoder 学术 |

**这张表读出来 6 个反直觉信号**：

1. **SWE-bench 本体 30d 0 commits**。**这件事极其反直觉** —— 全行业都在围绕 SWE-bench 跑分，SWE-bench 自己的 repo 一个月没动。Princeton 团队的注意力已经转到 mini-swe-agent + SWE-smith 上，**SWE-bench 本体进入维护期**。这呼应 Phase 2 对 Aider 的判断（"产品退化为 alias 维护"）—— 评测领域的等价命题是"benchmark 退化为 leaderboard 托管"。
2. **SWE-bench Live 30d 0 commits + last push 2025-05-20** —— **整整 11 个月没动**。这个所谓"每月加新 issue 防污染"的项目本身已经停滞。**Phase 1 开放问题 3 的候选答案"SWE-bench Live"在数据上可以划掉**。
3. **PRarena 30d 65 commits + last push 当天**。**全表唯一一个仍在按周维护的 benchmark 项目** —— 它不是论文配套，是 aavetis 个人维护的 dashboard。但 7 个 contributor + 299 stars 体量极小，**护城河完全是"持续追踪 6 个 agent 的 PR 数据" 这件繁琐工作**。
4. **mini-swe-agent 4k stars > Agentless 2k stars + Live-SWE-agent 376 stars 之和**，且 mini-swe-agent 是唯一仍有 release 节奏的 harness（v2.2.8, 30 天前）。**Phase 1 的"benchmark-driven 项目结构性短命"在本期被精确定位** —— 死的不是所有 harness，死的是"为某个 paper 临时做的 harness"。**mini-swe-agent 因为是 Princeton 团队的长期 SDK 而活下来**。
5. **训练子赛道 5 个项目里 4 个已经停滞或半停滞**。SWE-Gym（9 月没动）、EvoControl（3 月没动）、SWE-smith 没 release、OpenEvolve 30d 0 commits。**唯一活跃的 rllm 是 general RL 框架，不是 SWE-specific 训练**。这强烈支持本期判断：训练子赛道的 OSS 形态是论文 narrative，不是真战场。
6. **"已停滞 harness" 的列表精准吻合 Phase 1 反模式 1（学术 PoC dump）的预测**：Agentless（16 月）、AutoCodeRover（12 月）、AlphaCodium（17 月）、SE-Agent（7 月）、Live-SWE-agent（3 月）、GitTaskBench（7 月）。**6 个停滞项目里 5 个是单论文 paper 配套**。

---

## 2. SWE-bench Verified 80%+ 之后路在何方：Goodhart 化已经发生

### 当前 SOTA 状态（2026-04-26）

按 swebench.com leaderboard + 第三方追踪交叉核对：

| Rank | Model | Score | 提交时间 | 备注 |
|---|---|---|---|---|
| 1 | **Claude Mythos Preview** | **93.9%** | 2026-04-22 | Anthropic 内部 preview，未发布 |
| 2 | **Claude Opus 4.7** | **87.6%** | 2026-04-16 | Anthropic 公开 API |
| 3 | GPT-5.3-Codex | 85.0% | 2026-Q1 | OpenAI |
| 4 | Claude Opus 4.5 | ~83% | 2026-Q1 | Anthropic |
| 5 | Gemini 3 Pro | ~78% | 2026-Q1 | Google |

**关键结构性变化（2026-Q1 起）**：
- **OpenAI 已停止在 release notes 里报 Verified 分数**，转推 SWE-bench Pro
- Anthropic 仍报 Verified，但同时报 Pro / Terminal-Bench / SWE-bench Live
- Google 报 Verified + 自家内部 benchmark
- **morphllm.com 2026 调查：所有 frontier model 都能"verbatim 复现"Verified 部分 task 的 gold patch 或 problem statement**

### 80% 之后的语义崩塌

**80% 这个数字本身已经失去 SE 工程意义**：
- 161/500 instances 只需要改 1-2 行（morphllm 数据）—— 这部分对当今 frontier model 来说是 trivial fix
- 而剩下 339 instances 里 59.4% 的"hardest unsolved" 有 flawed test cases —— 即"agent 答对了但 grader 判错"
- 真实工程意义的难度区间（10+ 行跨文件 refactor）只占 Verified 不到 30%

这就是 **Goodhart 化的精确定义** —— 当 Verified 还是 SOTA proxy 时，"刷 Verified"等于"提升 SE 能力"；当 train data 已经包含 Verified 题目本身、测试用例本身有缺陷、agent 团队学会 over-fit 题库后，**"刷 Verified" 不再等于"提升 SE 能力"，只等于"刷分"**。

**OpenAI 退出 Verified 是这个 Goodhart 化最硬的实锤**。商业巨头不会主动放弃一个对自己有利的 metric —— 除非这个 metric 已经不能区分自己和对手（即 metric 已死）。

### 下一代权威候选的命门

| 候选 | 卖点 | 命门 |
|---|---|---|
| **SWE-bench Pro** | 1865 task + 41 actively maintained repo + 每 task ≥10 行 + 多文件 + 跨语言（Python/Go/TS/JS）| **是 Scale AI 产品**。Scale 既是 evaluation 提供方又是数据标注 SaaS —— 经典裁判员 + 运动员结构。**46% Pro 当前 SOTA = Claude Mythos Preview 77.8%、Opus 4.7 64.3%、GPT-5.5 58.6%** ——已经在被刷 |
| **SWE-bench Live** | "每月加 50 新 issue" 防污染 | **本身已停滞**：30d 0 commits + 11 个月没 push。**Phase 1 开放问题 3 的候选答案直接划掉** |
| **Terminal-Bench** | 终端 sandbox 评测 + Laude Institute 基金会路线 | **Anthropic 自报 Claude Opus 4.7 = 69.4%**，但 ForgeCode + Claude Opus 4.6 已 81.8% —— **harness/scaffolding 主导而非模型主导**，又是新一轮 Goodhart 起点 |
| **PRarena** | 6 个真实 agent（Copilot/Codex/Cursor/Devin/Codegen/Jules）真实 GitHub PR 数据 + 每天更新 | **stars 仅 299 + 7 个 contributor**，**非学术、非 Scale、非基金会** —— 没有任何机构推它成"权威"的动机 |

**"被官方 release notes 引用次数最多" 的观测点结果（2026-04 横评）**：
- **Anthropic Claude Opus 4.7 release notes**：报 Verified + Pro + Terminal-Bench
- **OpenAI GPT-5.3 release notes**：只报 Pro，**不报 Verified**
- **Google Gemini 3 Pro release notes**：报 Verified + 自家 internal
- **Mistral Devstral release notes**：只报 Verified

**结论**：未来 6-12 月下一个权威 benchmark 不是 PR Arena 也不是 Live，是 **SWE-bench Pro + Terminal-Bench 双轨**。前者是 Scale 推动 + OpenAI 站台的"难度型权威"，后者是 Laude Institute 推动 + Anthropic 站台的"形态型权威"。**两个都会被 Goodhart 化，但比单 Verified 周期长 12-18 个月**。

### Contrarian：SWE-bench Pro 是 Scale 的 marketing 工具

把 Scale 的 SWE-bench Pro 当成"下一代独立权威"是个误读。理由：

1. **Scale AI 主业是数据标注 SaaS** —— 他们 2024-2026 业务下行（与 OpenAI 模型 self-improvement 形成竞争），急需找一个新位置定义自己。SWE-bench Pro 是 Scale 重新定义为"evaluation infrastructure provider"的关键产品
2. **Pro 的 dataset 是 Scale 内部标注团队产出的**，不像 Verified 是开源 + OpenAI annotator 联合验证。**dataset 的"权威性" = dataset 提供方的中立性**，Scale 在这点上结构性弱
3. **OpenAI 推 Pro 不是因为 Pro 更好，是因为 Verified 已经对 OpenAI 不利（Anthropic 87.6% 领先 OpenAI 85.0%）**。商业巨头切换 metric 永远是为利益不是为学术正确

**真正中立的下一代 benchmark 不会出现** —— 一旦某个 benchmark 成为权威，它就会被三种力量同时拉扯：(a) 模型厂商压它服务自家 narrative，(b) 提供方商业化它，(c) agent 团队 over-fit 它。**Goodhart's law 在 agentic SE 评测里没有解药，只有"换新 metric 重启 Goodhart 周期"这一条路**。

---

## 3. mini-swe-agent 100 行拿 74% 到底说明什么：3 个层次

这是本期最核心的反例，也是 Phase 1-4 反复绕回的命题。Phase 2 已经给过一个粗判断（"runtime 那些 UX 投入对 benchmark 性能没增量贡献"），本期要把这件事深拆 3 个层次。

### 层次 (a)：Runtime UX 投入对 benchmark 性能确实无增量贡献

证据链：
- Aider（44k stars + 3 年成熟产品 + git-aware + auto-commit + repo map）跑 Verified 历史最高 ~75-78%
- Cline（61k stars + Plan/Act 双模式 + MCP + IDE 集成）没有公开 Verified 跑分
- mini-swe-agent（100 行 Python + bash 一个工具 + 没有 tool-calling）**>74% Verified**
- Claude Opus 4.7 + mini-swe-agent ≈ 87.6% Verified
- Princeton HAL Mini leaderboard: Claude Sonnet 4.5 High + mini-swe-agent = 72%（50 题子集）

**严格说**：Runtime UX 投入对 benchmark 性能"无增量贡献"是个**事实陈述**，不是判断。但这个事实只在 SWE-bench Verified 这个**单一题型**下成立。

### 层次 (b)：模型能力已经吃掉 agent 架构差异

mini-swe-agent README 自己写得最清楚 —— "Does not have any tools other than bash—it doesn't even need to use the tool-calling interface" + "Has a completely linear history—every step of the agent just appends to the messages"。**这是把 agent 退化到 1980 年代 shell session 的水平** —— 一个 bash subprocess + linear chat history。

这件事在 2024 年是不可能的（GPT-4 早期连 tool use 都不稳）。在 2026-04 是可能的，因为：
- Claude Opus 4.7 / GPT-5.3-Codex / Gemini 3 Pro 都能在零 scaffolding 下做 multi-turn 工具调用
- Prompt caching / 1M context 让"linear history" 不再是 token 灾难
- agentic loop 已经是模型训练目标（Anthropic 在 4.x 系列明确为 agent 用例 RL）

**这是 Phase 1 张力 3（vendor-locked vs agnostic）的另一面**：vendor-locked 派（Codex CLI / Gemini CLI / Claude Code）背后的押注是"模型代差永远存在"，**mini-swe-agent 74% 是这个押注的 SE 评测端实锤** —— 模型是绝对主角，agent 框架是配角。

### 层次 (c)：SWE-bench Verified 设计上奖励简单 harness（最 contrarian）

这是本期最核心的反直觉论断。

**SWE-bench Verified 的 task 形态是什么**：每个 task 是一个 GitHub issue + 一个 reference patch + 一组 test cases。agent 跑完，patch 应用到 repo，跑 test，pass 就得分。

**这个形态隐含的偏向**：
1. **Single-issue + single-PR 形态** —— 不评估"多个 ticket 同时跑"的 fleet 能力（这是 Phase 4 orchestrator 派的真痛点）
2. **没有人在 loop** —— 不评估 plan/act 双模式、不评估 user override、不评估"我修了一半但需要确认"
3. **没有持久化 / 跨 session 上下文** —— 每个 task 是一次性
4. **没有真实 cost 维度**（Pareto 边界只在 mini leaderboard 出现）—— 75% + $1k vs 70% + $50 在排行榜上前者赢
5. **没有真实代码 review 维度** —— grader 是 test pass，不评估 code style / maintainability / 是否符合项目惯例

**这 5 个缺失维度恰好是 Aider / Cline / Crush / Claude Code / Goose 在做的事**：
- Aider 投入 git-aware 是为 (3) 持久化
- Cline 的 plan/act 双模式是为 (2) 人在 loop
- Goose 的 desktop daemon 是为 (3) + (5) 长期项目持续协作
- Composio agent-orchestrator 的 auto merge resolution 是为 (1) fleet
- Sem/Weave entity-level diff 是为 (5) 跨 agent 审查

**因此 mini-swe-agent 拿 74% 不是"runtime UX 没用"** —— **是"runtime UX 服务的维度根本不在 SWE-bench Verified 评测里"**。这是个 benchmark 设计的边界问题，不是 runtime 价值的判断。

### 这件事对 Aider/Cline/Crush 是不是判死刑

**不是判死刑，是判定位错位**。

如果 Aider/Cline/Crush 团队把"提升 SWE-bench Verified 分数"当 KPI，他们做的 90% 工作（git-aware、plan/act、TUI 美化、IDE 集成、MCP）都没价值。**但他们的真 KPI 是"开发者愿意用"** —— 这件事 SWE-bench 衡量不了。

**Phase 1 张力 6（benchmark-driven vs product-driven）在本期得到精确印证**：
- **benchmark-driven 团队**该做 mini-swe-agent 这种 100 行 + bash + 跑分
- **product-driven 团队**该做 Aider/Cline/Crush 这种重 UX
- **二者完全不该用同一套 metric 评价**

**对 Boris 的实操含义**：看到"某 runtime 拿 X% Verified" 这种新闻，**值不值得入日报取决于这个 runtime 是 benchmark-driven 还是 product-driven**：
- benchmark-driven（mini-swe-agent / SWE-agent / Devstral 报跑分）—— 入"模型能力追踪" 而非"产品演进追踪"
- product-driven（Aider / Cline 报跑分）—— 大概率是公关稿，**直接 skip**

---

## 4. Agentless 反对"agent" 这件事：为什么没主导

### Agentless 的核心论点

UIUC 团队（Chunqiu Steven Xia + Lingming Zhang 等）在 2024 年的论点直击当时 narrative：**"Agent 这个词过度承诺了"**。他们提出**三阶段**：

1. **Localization**：层级化定位 —— file → class/function → fine-grained edit location
2. **Repair**：在 edit location 上 sample 多个 candidate patches（diff 格式）
3. **Patch Validation**：跑 regression tests + agent 自己生成 reproduction test，按 test 结果 re-rank patches

**关键哲学**：**没有 agent loop，没有 plan/act，没有 multi-turn 工具调用** —— 整个流程是 LLM 调用 N 次的固定 pipeline。2024-12 拿 Verified **50.8%（Claude 3.5 Sonnet）**，当时是 SOTA。

### 这对 Archetype 1 (Runtime) + Archetype 3 (Autonomous SWE) 的挑战

**Agentless 的 narrative 本质是**：**"我们用 fixed pipeline + 强 LLM = agent 该有的一切结果，且更可解释"**。如果对了，整个 Archetype 1 的 plan/act/tool/observe loop 是工程过度设计 —— 直接 LLM-as-pipeline 即可。

但 Agentless **没有继续主导** —— 最后 commit 2024-12-22，**16 个月停滞**。原因：

1. **50.8% 这个数字在 2026-04 已经被 mini-swe-agent + Claude 4.7 远远抛开（>74%）**。即"无 agent + 强 LLM"被"最简 agent + 更强 LLM"超越，Agentless 的 narrative 失效
2. **Agentless 的 fixed pipeline 不能像 agent 那样灵活适应新模型** —— 每个 LLM 升级都需要重新调 pipeline 提示词；而 mini-swe-agent 的"linear history + bash" 范式天然 model-agnostic
3. **Agentless 是 paper 配套 OSS** —— Phase 1 反模式 1 的标准死法。论文一发，KPI 完成，团队自然散。这与 mini-swe-agent 是 Princeton SWE-agent SDK 的一部分（**有持续维护激励**）形成精确对比

### Agentless 的尸检意义

Agentless 的 16 月停滞 + mini-swe-agent 的 30d 5 commits + v2.2.8 release 的对比，**精准印证 Phase 1 反模式 1 + Phase 2 对"runtime 维护期"判断的 harness 等价命题**：

- **Harness 不死于"被打败"，死于"原创 narrative 被透支"**
- **能活的 harness 都不是 paper 配套，而是某个团队的长期 SDK**（mini-swe-agent 之于 Princeton SWE-agent，类似 Aider 之于 Aider-AI）

---

## 5. PRarena vs SWE-bench：产品级 vs 题库式评测

### PRarena 在追什么

WebFetch + repo 数据：
- **6 个 agent**：Copilot、Codex、Cursor、Devin、Codegen、Jules
- **3 个 metric**：Ready PRs（非 draft）、Merged PRs、Success Rate（merge / ready）
- **数据来源**：GitHub API 全网扫描，按 agent 用户名 / 提交者识别
- **更新频率**：30d 65 commits + last push 当天 —— 实质上是**每天自动跑数据流水线**
- **dashboard**：prarena.ai + repo 内静态 chart

### 题库式 vs 产品级评测的本质区别

| 维度 | SWE-bench 类（题库式） | PRarena 类（产品级） |
|---|---|---|
| **样本** | 固定 N 个题目（Verified 500 / Pro 1865）| 全网真实 PR 流量 |
| **判分** | test pass / 自动化 | merge / human review 通过 |
| **评估对象** | 模型 + harness | agent 端到端产品 |
| **频率** | 季度/半年发布快照 | 每天更新 |
| **可 game 性** | over-fit 题库 + flawed test grade | 刷 PR 数量 + 选简单 PR |

**两套范式针对的是完全不同的问题**：
- 题库式回答"模型 SE 能力上限"
- 产品级回答"agent 在真实分布上的表现"

### 哪个更接近衡量 agent 真实价值

**严格说，都不准**。

题库式的失真在 §2 已经说清楚（Goodhart + 维度狭窄）。**产品级的失真也很严重**：

1. **PR 是被 agent 提交的 ≠ PR 是 agent 自主产出的**。Copilot 用户写一行 + Copilot 补一行 = "Copilot PR"？这个边界不清晰
2. **Merge ≠ 高质量**。低风险小 PR（typo fix / 文档更新）merge 率高，复杂 refactor PR merge 率低 —— **agent 学会"专挑容易 merge 的 PR 做"会刷高 success rate**
3. **PR 数量有强信号偏置**：Copilot 的体量是 Devin 的 100×（用户基数差异），**Copilot merged PR 多 ≠ Copilot 更强**

**Goodhart 在 PRarena 上更隐蔽但同样存在**：
- 一旦 PR 数量成 metric，agent 厂商有动机 (a) 鼓励用户多用，(b) 自动 split PR 让计数变高，(c) 优先做容易 merge 的任务

### 我的判断

**PRarena 是当前最有意思的 benchmark 创新，但没人把它当权威**。理由：
- stars 仅 299 + 7 contributor + 个人维护 —— 没有机构靠它做估值或 narrative
- Copilot / Cursor / Devin 这些被追踪的厂商**不会承认 PRarena 的数据**（因为 PRarena 显示出的真实 merge 率远低于他们 marketing 数字）
- 学术圈不收 PRarena 数据 —— 因为它不是 reproducible benchmark，是 dashboard

**PRarena 的真实价值是给独立分析师做"打脸厂商 marketing" 的弹药库**。Boris 的日报视角下，**PRarena 数据值得每月引用一次** —— 但不要当成 leaderboard，当成"agent 产业景气度温度计"。

---

## 6. 训练 / RL 子节：是真赛道还是论文 narrative

Phase 1 把训练 / RL 并入本期。约 1000 字深拆。

### rllm（5,450 stars）—— **唯一真活跃的训练框架**

- **来源**：Berkeley Sky Computing Lab + Laude Institute / AWS / Hyperbolic / Fireworks / Modal 等基金支持
- **定位**：通用 RL for LLMs framework，**不是 SWE-specific**
- **代表成果**：DeepCoder（14B = O3-mini level）+ DeepSWE + DeepScaleR（1.5B 数学 > O1-Preview）
- **活跃度**：30d 41 commits + 30 contributor + last push 当天 —— **是训练子赛道唯一健康项目**

**判断**：rllm 是"通用 RL infra"，**SWE 是它的一个 verticals 不是它的全部**。把 rllm 算作 agentic SE 训练子赛道的一员是 narrative 拉伸 —— 它的核心受众是做 RL 训练的人，不是做 SWE agent 的人。**Boris 视角下应当看作 LLM 训练 infra 而非 agentic SE 项目**。

### SWE-Gym（671 stars）—— **典型 paper 配套尸体**

- **来源**：ICML 2025 paper "Training Software Engineering Agents and Verifiers with SWE-Gym"
- **定位**：SWE agent 训练环境
- **活跃度**：30d 0 commits + last push 2025-07-29 + **9 个月停滞** + 5 contributor
- **真有人用吗**：repo issues 显示几乎没有外部使用反馈，**完全是论文配套**

**判断**：Phase 1 反模式 1 的精确兑现。论文发完，团队转战。**从 radar 主表降到"参考"**。

### OpenEvolve（6,082 stars）—— **AlphaEvolve OSS 实现，但定位与 SWE 关系弱**

- **来源**：algorithmicsuperintelligence org
- **定位**：evolutionary search + LLM = 自动算法发现/优化（GPU kernel、circle packing、competitive programming）
- **活跃度**：30d 0 commits + 30 contributor + v0.2.27 (2026-03) —— **release 节奏在但月度无 commit 略可疑**

**关键判断**：OpenEvolve 不是评测、不是训练，**是 evolutionary code search**。它和 agentic SE 的交集很弱 —— 它做的是"LLM + 遗传算法找最优解"，不是"agent 修 GitHub issue"。**Phase 1 把它归 Archetype 7 (Evaluation Substrate) 是错的**，应归 Archetype 5 (Infra) 或新增"Search/Optimization" 类别。

### Devstral（model）—— **训练 SWE 模型本身的最强 OSS 案例**

- **来源**：Mistral AI × All Hands AI 合作
- **关键事实**：从 Mistral Small 3.1 (24B) finetune + RL；**OpenHands scaffold 下 46.8% Verified**
- **重要细节**：在 OpenHands harness 下评测 = harness 给力还是模型给力？**答：模型给力**。OpenHands 不是性能优化的 harness，比 mini-swe-agent 重；mini-swe-agent + Claude 4.7 拿 87.6%，**Devstral + OpenHands 46.8% 主要受限于模型 24B 体量**
- **意义**：Devstral 是当前**唯一可用的 OSS SWE-specific 模型**（不是通用 LLM）。证明"小模型 + 专门 RL → 中等 SWE 表现" 路径成立

**判断**：Devstral 的存在是 Phase 1 开放问题 4（开源 code LLM 能否撬动闭源垄断）的**部分回答** —— 答案是"24B 模型 + RL 能到 46.8%"，离 Anthropic 87.6% 还差 40pp。**6-12 月内开源能否追到 70% Verified 仍是开放问题**。

### EvoControl（118 stars）—— **可忽略的论文项目**

QuantaAlpha 出品，30d 0 commits + last push 3 月前。Phase 1 反模式 1 标准案例。**不进 radar**。

### 训练 / RL 子赛道的整体判断

**真实存在但严重夸大**：

1. **真在训练 SWE 模型的人没出 OSS** —— Anthropic / OpenAI / Google 的 RL 训练 pipeline 全部闭源。Mistral × All Hands 是 OSS model 但训练代码 / 数据未开源
2. **OSS 训练框架（rllm）是通用的，不是 SWE-specific**
3. **SWE-specific 训练环境（SWE-Gym / SWE-smith）都是论文配套，活跃度全部低**

**对 Boris 的实操含义**：训练 / RL 在 OSS 视角下不构成独立日报追踪赛道。**rllm 当 LLM 训练新闻看，Devstral 当 OSS model 新闻看，其他全部季度回看**。**Phase 1 的"不建议单独做训练/RL 一期"判断在本期数据下完全坐实**。

---

## 7. Benchmark 派的"结构性短命" —— 5 项目尸检

Phase 1 反模式 1 提出"benchmark-driven 项目结构性短命"。本期做 5 个尸检验证。

### 尸体 1：Live-SWE-agent（OpenAutoCoder, 79.2% Verified）

- **last commit 2026-01-19**（3 月停滞）
- **README 自称 "first runtime self-evolving SWE agent"** —— "runtime self-evolving" 是个噱头词
- **同 OpenAutoCoder org 旗下 Agentless 已停滞 16 月** —— 团队整体进入论文转战模式
- **376 stars + 0 release** —— 没有 enterprise channel 支撑

### 尸体 2：SE-Agent（QuantaAlpha, 80% Verified）

- **last commit 2025-09-22**（**7 月停滞**）
- **README 一句话直接引用 paper**："self-evolution framework for LLM Code agents" + "SOTA performance"
- **5 contributor + 268 stars** —— 同实验室项目典型规模
- **同 org 旗下 GitTaskBench / RepoMaster / EvoControl 也都是 paper 配套** —— QuantaAlpha 是个"paper repo 制造机构"

### 尸体 3：Agentless（OpenAutoCoder, 50.8% Verified）

- **last commit 2024-12-22**（**16 月停滞**）
- **2024 年 SOTA → 2026 年的 baseline → 现在直接被甩开**
- **paper.bib 在 repo 顶层** —— Phase 1 反模式 1 的精确识别信号

### 尸体 4：AutoCodeRover（NUS, 46.2% Verified）

- **last commit 2025-04-24**（**12 月停滞**）
- **NUS 学术 spin-off** —— autocoderover.dev 商业产品已基本不更新
- **3,069 stars 是历史峰值** —— 2024 年红极一时

### 尸体 5：Confucius Code Agent（facebookresearch/cca-swebench）

- Meta 论文配套，**radar 数据显示 last commit 几乎不存在**
- **Meta 大厂背书但完全没人用** —— Phase 1 反模式 2（大厂 OSS 装门面）的精确标本

### 命题验证：项目以 benchmark 排名为 KPI 是不是注定 1 年内死

**5 个项目尸检的横切结果**：
| 项目 | 是否纯 benchmark KPI | 是否 1 年内停滞 |
|---|---|---|
| Live-SWE-agent | 是 | 是（3 月） |
| SE-Agent | 是 | 是（7 月） |
| Agentless | 是 | 是（16 月） |
| AutoCodeRover | 是 | 是（12 月） |
| Confucius Code Agent | 是 | 是（几乎一开始就停） |

**全部命中**。但这个命题需要精确化：

- **真正死的不是"benchmark KPI" 本身，是"单 paper benchmark KPI"** —— 团队的产出单位是 paper 而非产品
- **mini-swe-agent + SWE-agent 也以 benchmark 为重要 KPI 但活下来** —— 因为它们是 Princeton SWE-bench 团队的长期 SDK，**有跨 paper 的复用激励**
- **Devstral 也以 benchmark 为重要 KPI 但活下来** —— 因为 Mistral 把它当商业 OSS 模型不当 paper 配套

**精确版命题**：**"单 paper benchmark KPI 项目"结构性 1 年内死**。"长期 SDK / 商业 model" 性质的 benchmark-driven 项目可活。

**对 Phase 1 反模式 1 的精炼**：识别信号需要细化 —— 不是"出现 paper.bib"就死，是"项目存在唯一目的是出 1 篇 paper 时"才死。

---

## 8. Goodhart's Law 在 agentic SE 评测里的具体表现

整个本期内容已经多次回到这条主线。本节集中收束。

### SWE-bench Verified 已被 Goodhart 化的 5 个证据

1. **OpenAI 退出 Verified** —— 商业巨头不会主动放弃对自己有利的 metric
2. **frontier model 能 verbatim 复现 gold patch**（morphllm 调查）—— 训练数据已包含 Verified 题目
3. **59.4% hardest unsolved 有 flawed test cases** —— grader 本身有 bug
4. **161/500 task 只需要改 1-2 行** —— 难度区间不够
5. **agent 团队 over-fit 到 Verified 题库结构**（如 issue 描述格式偏好）—— 产生迁移性差距

### Live 的"每月加新 issue"为什么没解决

理论上 Live 的设计应该让 Goodhart 化变慢 —— 每月 50 新题目，agent 没法 over-fit。**实际为什么没用**：

- **本身 30d 0 commits + 11 月停滞** —— 维护方都没维护，"每月加新题目"承诺没兑现
- **frontier model 训练 cycle 已经压到月度** —— Anthropic / OpenAI 月度更新模型，Live 加新题目的速度赶不上模型在新题目上 train 的速度
- **Live 的 task pool 仍然是 GitHub issue 形态** —— 形态级偏向（§3 层次 c）依然在

### 真正下一代评测应该长什么样

Phase 4 已经预告"评测维度需要从 single-issue 转向 fleet"。本期补全这个 picture：

**6 个未来评测维度**：
1. **多 ticket 同时跑下的 throughput + correctness**（fleet 评测）
2. **跨 session 长任务的连续性**（持久化评测）
3. **真实 PR review 通过率**（产品级评测，PRarena 是早期形态）
4. **cost-aware Pareto**（mini leaderboard 在做）
5. **多 agent 协作下的 conflict resolution**（Composio agent-orchestrator 该做的事）
6. **真实开发者满意度采样**（用户体验评测，目前没人在做）

**预测**：未来 12 月会出现 1-2 个尝试覆盖 (1)+(3)+(5) 的新 benchmark。**最可能的发起方是 Anthropic 或 Composio**（不是 Scale，不是 Princeton）。**这是 Phase 7 synthesis 时需要重新评估的开放问题**。

---

## 9. 数据：8 项目活跃度横评（精炼版）

| Project | Stars | 30d commits | Contributors | 最近 release | 创建日期 | 商业化形态 | 最近 leaderboard 更新 |
|---|---|---|---|---|---|---|---|
| **SWE-bench**（鼻祖）| 4,793 | **0** | 30 | 无 | 2023-10 | Princeton 学术 | 持续（swebench.com）|
| **SWE-bench Pro** | 364 | 3 | 10 | 无 | 2025-09 | **Scale AI 产品** | 持续（labs.scale.com）|
| **SWE-bench Live** | 2 | **0** | n/a | 无 | 2025-05 | 学术（停滞）| **静态**（"error loading data"）|
| **PRarena** | 299 | **65** | 7 | v0.1 (2025-06) | 2025-05 | OSS 个人 | 持续（prarena.ai 每天更新）|
| **mini-swe-agent** | 4,054 | 5 | 30 | v2.2.8 (2026-03-24) | 2025-06 | Princeton SDK | n/a（被引用而非本身报）|
| **SWE-agent** 本体 | 19,065 | n/a | n/a | 持续 | 2024-04 | Princeton 学术 | n/a |
| **Agentless** | 2,038 | **0** | n/a | 无 | 2024-06 | UIUC 学术（**16 月停滞**）| 50.8% (2024-12) |
| **rllm** | 5,450 | **41** | 30 | v0.2.1.post1 (2025-12) | 2025-01 | Berkeley | n/a |
| **Terminal-Bench** | 2,090 | **0** | 30 | 无 | 2025-01 | Laude Institute | 持续（tbench.ai）|
| **OpenEvolve** | 6,082 | **0** | 30 | v0.2.27 (2026-03) | 2025-05 | OSS | n/a |
| **SWE-Gym** | 671 | **0** | 5 | 无 | 2024-11 | 学术（**9 月停滞**）| n/a |
| **SWE-smith** | 631 | **0** | 20 | 无 | 2025-05 | Princeton | n/a |

**两个最反直觉信号**：
1. **leaderboard 持续在更新 ≠ benchmark repo 在维护**。SWE-bench / Terminal-Bench / SWE-bench Pro 三个 leaderboard 持续接受新 submission，但 repo 都 30d 0 commits —— **leaderboard 本质是被 model 厂商推动更新的，benchmark 团队只做 hosting**
2. **PRarena 的 30d 65 commits 是全表第二高**，**但 stars 倒数第二** —— 工程节奏与 stars 严重背离，是个"被低估但活跃"项目

---

## 10. 给 Boris 的判断

### 跟踪：每周扫的 4 个 + 月度看的 3 个

**每周扫**：
- **swebench.com leaderboard**（追 model 厂商新 submission）
- **labs.scale.com SWE-bench Pro leaderboard**（追下一代权威候选）
- **PRarena dashboard (prarena.ai)**（追真实 PR 数据，作"产业景气度温度计"）
- **mini-swe-agent release**（追 Princeton 团队对最简 harness 的迭代）

**月度看**：
- **Terminal-Bench leaderboard (tbench.ai)**（追第二个候选权威）
- **rllm release**（追 RL 训练赛道）
- **Devstral 后续 Mistral 更新**（追开源 SWE 模型代差）

### 押：6-12 月哪个会成新权威 benchmark

**第一押注：SWE-bench Pro**。理由：
- Scale 全力推动 + OpenAI 站台
- Verified 已被 Goodhart 化，市场需要替代品
- Pro 当前 SOTA 只 77.8%（Mythos）/ 64.3%（Opus 4.7）—— 还有 12-18 月刷分窗口
- **风险**：Pro 也会在 18 月内被 Goodhart 化，但至少能撑过 2026 全年

**第二押注：Terminal-Bench**。理由：
- Laude Institute 基金会路线（不像 Scale 那样裁判员 + 运动员）
- 形态创新（终端 sandbox）足够正交于 SWE-bench
- harness/scaffolding 成为 differentiator —— 这点对喜欢"调 harness" 的研究圈有吸引力

**不押 PRarena**。它的真实价值在第 5 节已经讲清楚 —— 是分析弹药库，不是权威 benchmark。

**不押 Live**。已停滞，不可能重启。

### 丢：哪些 benchmark 已成历史包袱

- **SWE-bench Verified**：仍跟踪 leaderboard 但**不再当 SOTA proxy**。看到"X 模型拿 Y% Verified" 时降一档信任度
- **SWE-bench Live**：**从 radar 删除**，已死
- **GitTaskBench / AlgoTune / SWE-AGILE / SE-Agent / Confucius**：全部从 radar 主表降到"已停滞参考"
- **Agentless / AutoCodeRover / Live-SWE-agent / AlphaCodium**：全部从 radar 类别 5/8 移到"已停滞 harness 案例库"

### 6 月内决胜事件：5 个可观测信号

按重要性排序：
1. **Anthropic 是否在 Claude 5.x release notes 里同时报 Verified + Pro + Terminal-Bench** —— 决定下一代权威是 1 个还是 3 个并存
2. **OpenAI 是否在 GPT-5.4+ release notes 里恢复报 Verified** —— 决定 Verified 是真死还是 OpenAI 战术性 boycott
3. **PRarena 是否被任何一家媒体（Latent Space / The Information / a16z）正式引用** —— 决定产品级评测是否进入主流话语
4. **mini-swe-agent 是否突破 5k stars** —— 决定"100 行打脸 runtime 派"narrative 是否持续
5. **是否出现 1 个新 OSS SWE 模型在 Verified 拿到 ≥70%** —— Phase 1 开放问题 4 的直接回答（当前 Devstral 46.8%，差 23pp）

### 对日报选材的影响

**该入日报的 benchmark 新闻**：
- 模型厂商发布新 model + 同时报 ≥3 个 benchmark 分数（说明评测多元化在发生）
- benchmark 本身重大设计更新（Pro 新增 task / Terminal-Bench 新增形态）
- 真实产业数据（PRarena 周报、a16z 调查、第三方评测）
- 反 Goodhart 案例（某 benchmark 设计被发现污染、某模型被发现 over-fit）

**不该入日报的 benchmark 新闻**：
- "X 模型拿 Y% SWE-bench Verified" —— **这是 SWE-bench 跑分新闻搬运工模式，价值已耗尽**
- 单 paper benchmark 项目的 release（除非是 Princeton / Berkeley / Laude / Scale 出品）
- "无 agent 拿到 N% Verified" 类型的 narrative —— Agentless 模式已被 mini-swe-agent 超越，没新意

---

## 11. radar 反向修正

本期对 Phase 1 / radar 的归类修正（5 处）：

1. **OpenEvolve** Phase 1 隐含归 Archetype 7 (Evaluation Substrate)。本期建议：**移到 Archetype 5 (Infra) 或新增 "Search/Optimization" 子类** —— 它做的是 evolutionary code search，不是评测也不是 SWE agent
2. **rllm** Phase 1 算 Archetype 7 训练赛道。本期建议：**降级到"通用 LLM 训练 infra"，不进 agentic SE 主表** —— 它是 general RL framework，SWE 只是它的一个 verticals
3. **Live-SWE-agent / SE-Agent / Agentless / AutoCodeRover / AlphaCodium / Confucius / GitTaskBench / EvoControl** 全部从 radar 类别 5/8 主表移到 **"已停滞 harness 案例库"** 子分类，作 Phase 1 反模式 1 的标本而非候选项目
4. **PRarena** Phase 1 隐含在 Archetype 7。本期建议：**升级标注 + 加入"日报弹药库"** —— 它不是权威 benchmark 但是产品级评测的最佳数据源
5. **Devstral**（model）Phase 1 没在 radar。本期建议：**新增到"开源 SWE-specific 模型"分类**，与 Qwen Code / Kimi-CLI 并列，作 Phase 1 开放问题 4 的追踪对象

**对 Phase 1 张力 6 的实质性扩展**：
> 原版："benchmark-driven 项目结构性短命"
> 扩展版：**"单 paper benchmark KPI 项目"结构性 1 年内死**；**"长期 SDK / 商业 model" 性质的 benchmark-driven 项目可活**（mini-swe-agent / Devstral 反例）。识别信号细化为"项目存在唯一目的是出 1 篇 paper"而非"出现 paper.bib"

**对 Phase 1 开放问题 3 的精确回答**：
> 原版："SWE-bench Verified 80% 后下一个权威 benchmark 是什么"
> 答案版：**SWE-bench Pro + Terminal-Bench 双轨**（不是单一新权威）。**SWE-bench Live 已死，PRarena 是分析弹药库不是权威**。Goodhart 周期 12-18 月

**对 Phase 1 开放问题 4 的部分回答**：
> 原版："开源 code LLM 能否撬动闭源垄断"
> 答案版：**Devstral 46.8% Verified（24B + RL）证明可行性**，但离闭源（Anthropic 87.6%）差 40pp。**6 月内出现开源 ≥70% Verified 实现的概率<30%**

---

## 12. Contrarian：Goodhart 不是病，是生态健康的副作用

主流叙述把 SWE-bench 被 Goodhart 化讲成"benchmark 失败"。**实际上，Goodhart 化是一个 benchmark 完成历史使命的标志**。

理由：
- **2023-2024 阶段**：SWE-bench 第一次让"agent 修真实 GitHub issue" 成为可量化命题。这个阶段，**SWE-bench 越被刷越说明 agent 能力在真提升**
- **2024-2025 阶段**：Verified 的诞生（500 task 人工筛选）让"避免脏题"成为标准实践。**这个阶段 SWE-bench Verified 持续作为模型代差的 proxy**
- **2025-2026 阶段**：模型刷到 80%+ → over-fit → Goodhart 化 → OpenAI 退出 → Pro / Terminal-Bench 崛起

**这不是 SWE-bench 失败，是 SWE-bench 完成了它该做的事（推动 agent 能力到 80%+ 这个曾经不可想象的水平）然后退场**。

类比：FLOPS 在 2010 年代是 GPU 性能 proxy，到 2020 年代被 transformer-flop / sparse-flop 等更精细 metric 取代 —— 没人说 FLOPS "失败"，它就是被新场景升级了。

**对 Boris 的实操含义**：当 Phase 7 synthesis 写"benchmark 之争 12 月回看" 时，**应当把视角从"哪个 benchmark 是赢家"转向"agent 能力跨过 80% Verified 后，evaluation 该评估什么新维度"** —— §8 末尾的 6 个未来评测维度就是这个新视角的起点。

---

## 13. 本期收束

17 个项目分 4 类、5 死、12 活：

1. **Benchmark 4 个**：SWE-bench（鼻祖维护期）+ Pro（Scale 推下一代候选）+ Live（已死）+ PRarena（弹药库）
2. **Harness 3 个**：mini-swe-agent（活长期 SDK）+ SWE-agent 本体（活）+ Agentless（已死，反 agent narrative 失败）
3. **训练 / RL 5 个**：rllm（活但通用）+ SWE-Gym / SWE-smith / OpenEvolve / EvoControl / Devstral（4 个停滞或半停滞 + Devstral 是 model 不是 OSS repo）
4. **其他评测 5 个**：Terminal-Bench（活，第二候选权威）+ AlphaCodium / GitTaskBench / AlgoTune / SE-Agent（全部停滞或半停滞）

**Phase 1 张力 6 + 反模式 1 + 开放问题 3 + 4 在本期同时收束**：
- 张力 6 精确化为"单 paper benchmark KPI 项目 1 年内死"
- 反模式 1 在 5 项目尸检中全部命中
- 开放问题 3 答案：SWE-bench Pro + Terminal-Bench 双轨而非单一新权威
- 开放问题 4 答案：Devstral 证明开源 SWE 模型路径可行，但代差仍 40pp

**核心反例 mini-swe-agent 拿 74% 的 3 层解读**：
- 层次 (a) Runtime UX 投入对 Verified 性能确实无增量 —— 事实陈述
- 层次 (b) 模型能力吃掉 agent 架构差异 —— 在 Verified 形态下成立
- 层次 (c) Verified 设计本身偏向简单 harness（缺失 fleet / 持久化 / cost / 协作 / review 5 个维度）—— **这才是 mini-swe-agent 反例的真正含义**：runtime 派的 UX 投入服务的是 SWE-bench 不评估的维度

**Goodhart's Law 在 agentic SE 评测里没有解药** —— 只有"换新 metric 重启 Goodhart 周期"。SWE-bench Pro / Terminal-Bench 是这一轮新 metric，**18 个月内会再次进入 Goodhart 化**。**真正的解药不在评测端，在让"评测"这件事的话语权从 model 厂商手里移到独立第三方** —— PRarena 是早期尝试，但 stars 299 + 7 contributor 的体量做不大。**这是 12 月内真正悬而未决的问题**。

12 月内会被回答的开放问题（接 Phase 1 + Phase 2 + Phase 3 + Phase 4）：
- **OpenAI 是否恢复报 Verified** —— 决定 Verified 是真死还是战术 boycott
- **Anthropic 是否同时报 Verified + Pro + Terminal-Bench** —— 决定下一代权威格局
- **是否出现首个 ≥70% Verified 的 OSS 模型** —— 决定开源代差能否收敛
- **PRarena 是否被任一主流媒体引用为产业指标** —— 决定产品级评测话语权能否上升
- **是否出现新 benchmark 评估 fleet / 持久化 / 协作维度** —— 决定 §8 第 (1)+(2)+(5) 维度能否被覆盖

---

## Phase 6 前瞻

下期（第 6 期）转入 **Code Review / PR Bot + Autonomous SWE 的 merge 率分析** —— 把本期 PRarena 数据深拆，对比 PR-Agent / CodeRabbit / Hodor 这些 review 端工具与 Devin / OpenHands / Jules 这些 autonomous SWE 端的真实 merged PR 数量、success rate、PR 复杂度分布，回答"哪类 agent 在生产环境真的 ship 代码"。本期 §5 已埋下伏笔 —— PRarena 是 Phase 6 的核心数据源，"产品级评测 vs 题库式评测"的对比会在 Phase 6 完整展开。
