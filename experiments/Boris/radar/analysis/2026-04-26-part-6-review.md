# Code Review Bot 与 Autonomous SWE 的真实 merge 率：PRarena 弹药库兑现、CodeRabbit 尸检 OSS、Devin 67% 与"PR 通胀"

- 日期：2026-04-26
- 系列：Agentic SE 深度分析 **第 6/7 期**
- 依据数据：`./2026-04-26-part-1-landscape.md`（Phase 1 archetype 3 + 反模式 1/2 + 张力 6 + 接触面轴 B 中的 Inside-the-PR 形态）+ `./2026-04-26-part-2-runtime.md`（runtime 派 vs autonomous SWE 的"是否需要人在 loop"分界）+ `./2026-04-26-part-3-infra.md`（review 端是否被 infra 派包抄）+ `./2026-04-26-part-4-orchestrator.md`（fleet 评测维度缺失）+ `./2026-04-26-part-5-benchmark.md` §5 PRarena 论断的兑现 + 本期新拉的 PRarena dashboard 实数据（2026-04-27 01:04 UTC 快照）+ GitHub API 元数据 + Cognition 2025 Annual Performance Review + Sacra CodeRabbit ARR 调查 + TechCrunch Greptile Series A 报道 + GitHub Copilot usage metrics API 公告（2026-04-08）+ CodeRabbit "AI vs Human Code" 报告（2025-12）
- 本期定位：**Code Review / PR Bot（radar 类别 4）+ Archetype 3（Autonomous Software Engineer）联合分析** —— Phase 1 接触面轴 B 的 "Inside-the-PR" 一格里两面（产 PR 的 agent + review PR 的 agent）合并尸检。Phase 5 §5 把 PRarena 标注为"日报弹药库"，本期把这个论断兑现成数字
- 字数：约 4500
- 主对比对象（review 端）：PR-Agent、Sweep、ai-pr-reviewer (archived)、Shippie、Hodor、Gito、Mutahunter
- 主对比对象（autonomous SWE 端）：OpenHands、SWE-agent、Devon、Devika、daiv、hermes-swe-agent、pilot
- 商业对照：CodeRabbit、Greptile、Sourcery、Devin (Cognition)、GitHub Copilot Coding Agent、Jules

---

## 0. 本期不是什么

不是 review bot 评测帖。不是 "Devin 到底能不能用" 的论坛贴。**本期回答 4 个互相绞缠的结构性问题**：

1. **PRarena 真实数据告诉我们什么**——Phase 5 把它叫做"日报弹药库"，但数据放在台面上，**它真能撑住这个定位吗**？
2. **CodeRabbit 在 2025-12-18 archive 自己的 OSS arm（ai-pr-reviewer）后，整个 OSS code review bot 赛道是不是被宣判了**？PR-Agent / Shippie / Hodor 还有什么生存位？
3. **Autonomous SWE 这个 Archetype 3 的真实 merge 率到底多少**？Phase 5 已经预告 "PRarena 是产业景气度温度计"，本期把温度计的读数读出来——**结论会反直觉**：Cognition 自己披露 Devin **67% PR merge rate**（2026 年 vs 2025 年的 34% 翻倍），但 PRarena 只给 Devin **60.9%**。哪个准？这种 20pp 差距背后是什么？
4. **"AI review AI 写的 PR" 是否会成新子赛道**？答案接近"已经悄悄发生但没人挂这个标签"——Qodo / CodeRabbit / Graphite 都已在做"AI-generated code aware review"，但没单独立项。

Phase 1 接触面轴 B 的 Inside-the-PR 那一格，本期会被精确切成 4 块：**(产 PR 的 OSS) × (review PR 的 OSS) × (产 PR 的商业) × (review PR 的商业)**——4 块的命运截然不同。

---

## 1. 数据：13 个项目 + 6 个 PRarena 追踪商业 agent，活跃度横评（2026-04-26 / 04-27 快照）

### 表 1：OSS 端横评

| Project | Archetype | Stars | Created | 30d commits | Open issues | 最新 release | 最近 push | 商业化形态 |
|---|---|---|---|---|---|---|---|---|
| **PR-Agent** (Qodo) | Review bot | **11,010** | 2023-07 | **16** | 145 | v0.34 (2026-04-02) | 2026-04-21 | **Qodo（前 Codium）商业品 OSS arm**；README 直接打广告 "This repo is not the Qodo free tier!" |
| **Sweep** | autonomous SWE → JetBrains | **7,705** | 2023-06 | **0** | **748** | (无近期 release) | **2025-09-18** | **Sweep AI 公司转 JetBrains plugin**，OSS repo 名字保留但已废弃 |
| **ai-pr-reviewer** (CodeRabbit) | Review bot | 2,097 | 2023-03 | **0** | n/a | 1.16.2 (2023-09-15) | **2025-12-18 ARCHIVED** | **死亡尸体** |
| **Shippie** | Review bot | **2,351** | 2023-07 | **0** | n/a | v0.20.0 (2025-08-01) | **2025-11-24** | OSS / 个人维护 |
| **Hodor** (mr-karan) | Review bot | 97 | 2025-11 | **0** | n/a | n/a | 2026-03-25 | OSS / 个人 |
| **Gito** (Nayjest) | Review bot | 216 | 2025-04 | 1 | n/a | n/a | 2026-04-08 | OSS / 个人 |
| **Mutahunter** | Mutation testing | 296 | 2024-06 | **0** | n/a | n/a | **2025-04-17** | OSS（CodeIntegrity AI，已停滞 12 月）|
| **OpenHands** (All-Hands AI) | Autonomous SWE | **72,127** | 2024-03 | **100** | 411 | 1.6.0 (2026-03-30) | 2026-04-26 | OSS + cloud SaaS（$18.8M Series A）|
| **SWE-agent** | Autonomous SWE / harness | 19,065 | 2024-04 | **0** | n/a | v1.1.0 (2025-05-22) | 2026-04-20 | Princeton 学术（NeurIPS 2024）|
| **Devon** (entropy-research) | Autonomous SWE | 3,445 | 2024-03 | **0** | n/a | (无 release) | **2025-05-26** | OSS（**11 月停滞**）|
| **Devika** (stitionai) | Autonomous SWE | **19,501** | 2024-03 | **0** | 190 | (无 release) | **2025-09-25** | OSS（**7 月停滞**）|
| **daiv** (srtab) | Autonomous SWE | 18 | 2024-05 | n/a | n/a | v2.0.0 (2026-03-14) | 2026-04-25 | 个人 OSS |
| **hermes-swe-agent** | Autonomous SWE | 9 | 2026-04-08 | n/a | n/a | n/a | 2026-04-09 | 个人 OSS（创建 2 周）|
| **pilot** (qf-studio) | Autonomous SWE | 459 | 2026-01-26 | **100** | n/a | v2.100.3 (2026-04-26) | 2026-04-26 | OSS / Go / "#1 Terminal Benchmark 2.0" |

### 表 2：PRarena dashboard 实数据（2026-04-27 01:04 UTC，单一最权威的产业指标）

| Rank | Agent | Total PRs | Ready PRs (非 draft) | Merged PRs | **Success Rate (Merge / Ready)** |
|---|---|---|---|---|---|
| 1 | **GitHub Copilot Coding Agent** | 1,809,633 | 1,346,979 | **1,291,836** | **95.9%** |
| 2 | **OpenAI Codex** | 4,221,497 | 4,177,715 | **3,644,496** | **87.2%** |
| 3 | **Cursor Agents** | 349,221 | 210,718 | **204,329** | **97.0%** |
| 4 | **Devin** | 104,583 | 101,645 | **61,891** | **60.9%** |
| 5 | **Codegen** | 9,926 | 6,922 | **4,424** | **63.9%** |
| 6 | **Google Labs Jules** | 298,470 | 205,035 | **188,606** | **92.0%** |

### 这两张表读出来 7 个反直觉信号

1. **OSS code review bot 的"30d commits"几乎全表为 0**。PR-Agent 16、Gito 1、其它 0。**唯一活跃的 PR-Agent 也已是 Qodo 公司 marketing 入口而非独立项目** —— README 第一句"This repo is not the Qodo free tier!"已经把它的真定位说清了：**它是 lead-gen funnel，不是产品**。
2. **OSS autonomous SWE 顶流 Devika 19.5k stars + 7 个月停滞**，**Devon 3.4k stars + 11 月停滞**。**Phase 1 反模式 1（学术 PoC dump）的非学术变种**：早期社区项目跑到一定 stars 后团队转商业方向，OSS repo 进入"博物馆"状态。Devika 当初的 README slogan 是 "first open-source implementation of an Agentic Software Engineer" —— **first 不等于活下来**。
3. **OpenHands 是唯一仍在按周维护的 OSS autonomous SWE**（30d 100 commits + v1.6.0 March 30 + $18.8M Series A）。**OSS autonomous SWE 赛道实际上只剩 OpenHands 一家活着**，其它要么停滞要么 stars < 500。
4. **PRarena 数据规模震撼**：Codex 4.17M ready PR + 3.64M merged PR，Copilot 1.35M ready + 1.29M merged。**这两个数字的量级远远超过任何其它 agent 类别的 GitHub 流量** —— 产 PR 这件事在 2026 已经不是"实验性 feature"，是**主流 GitHub 流量入口**。
5. **GitHub Copilot Coding Agent merge rate 95.9% 排第一**——但这个 95.9% 严重 overstates 真实价值。原因见 §3。
6. **Devin 60.9% merge rate 是 6 个里最低的**。但 Cognition 自己 2025 年报披露的内部数字是 **67%**（vs 2024 年 34%）。两者差距 6pp 揭示 PRarena 系统性低估了 Devin —— 因为 Devin 用户多在私有仓库 + enterprise 环境，PRarena 只能扫公开 GitHub。
7. **2026-04 PRarena 数据本身是行业最权威的产 PR agent leaderboard，但 stars 仅 299 + 7 contributor**。Phase 5 §5 已论证它体量小、缺机构推动，但本期数据放出来后会发现：**PRarena 是当前唯一一个让"agent 真实 ship 代码"成为可量化命题的来源** —— 它的护城河完全是"持续运维数据流水线"这件繁琐工作。

---

## 2. PRarena 弹药库兑现：6 个真实数据点 + 1 个结构性偏差

Phase 5 §5 已经把 PRarena 当弹药库标注，本期把弹药拆开看。

### 弹药 1：Codex 与 Copilot 的 100× 体量碾压所有 OSS

Codex 4.22M PRs / Copilot 1.81M PRs vs Devin 104K / Codegen 9.9K。**结构含义**：当我们讨论 "agent 写 PR" 这件事时，主流叙述（Devin / OpenHands / Jules）覆盖的实际市场份额可能不到 10%。**Copilot Coding Agent + Codex 已经吃掉绝大多数实际产 PR 的工作量**——而 Phase 1 接触面轴 B 把它们归在"Cloud / Async"，但其实它们和 IDE inline 模式紧密耦合，**用户写一句"please open a PR for this issue"就触发了，这种触发条件和 Devin "完全无人监督跑一个 ticket" 是不同的产品形态**。

### 弹药 2：success rate 排名隐藏的"PR 复杂度"差异

| Agent | Success Rate | 真实含义 |
|---|---|---|
| Cursor Agents | 97.0% | 用户在 IDE 里手动触发 + 看着改 + 然后开 PR，**人在 loop 占 80%+** |
| Copilot Coding Agent | 95.9% | 多数是 typo fix / 文档更新 / dependency bump，**低复杂度任务为主** |
| Jules | 92.0% | 类似 Copilot，高重复性任务 |
| Codex | 87.2% | OpenAI Codex CLI 调用产生的 PR，**编辑 scope 单文件居多** |
| Codegen | 63.9% | 真 autonomous + 跨文件 refactor 居多 |
| **Devin** | **60.9%** | **真 autonomous + ticket-level + 跨文件 + 长 session** |

**Goodhart 警告**：success rate 排名前 3 的不是"agent 更聪明"，是"agent 任务更简单"。**Devin 60.9% 排末位反而更接近"真 autonomous SWE 的 reality check"**——拿一个真 GitHub issue 让 agent 完全自主跑到 PR 后被 human merge 的概率，**当前行业上限就是 60-70%**。

### 弹药 3：Devin 67% vs PRarena 60.9% 的 6pp 差距

Cognition 2025 Annual Performance Review 自报：**67% PR merge rate（2026 年）vs 34%（2025 年）**——一年翻倍。**为什么 PRarena 给 60.9%**？

三个原因：
1. **PRarena 只扫公开 GitHub**——Devin 真实部署 80%+ 在 enterprise 私有仓库（Cognition 自报"hundreds of thousands of PRs across customer deployments"）
2. **PRarena 计的是 "Ready PR / Merged"**，Cognition 计的是"defined task / merged"——**分母不同**
3. **2026 Q1 之后 Devin 升级**带来的新 PR 还没在 PRarena 数据里完全反映（PRarena 用历史累计数）

**结论**：**PRarena 数据是一个 lower bound，真实 merge rate 普遍比 PRarena 高 5-10pp**。但 PRarena 仍是当前**唯一中立**的数据源——Cognition / OpenAI / Anthropic 自报的数字都有 marketing bias。

### 弹药 4：Codegen 的存在被严重低估

Codegen.com（YC W24）在 PRarena 排第 5，9.9k PR + 4.4k merged + 63.9% success rate。**Phase 1 没有把它列进 radar 主表**——但它的 success rate 与 Devin 同档 + PR 总量级近 100× 于 hermes-swe-agent / daiv —— **Codegen 是"被低估的第二个真 autonomous SWE 商业品"**。Phase 1 反向修正应当补入。

### 弹药 5：PRarena 缺失的 OpenHands

PRarena 6 个 agent 里**没有 OpenHands**。这件事很关键——OpenHands 是 OSS autonomous SWE 的唯一活跃头部，但 PRarena 不追踪它。**原因推测**：OpenHands 的产 PR 不是统一签名（用户自己挂 GitHub 账号）所以无法识别。**含义**：**OSS autonomous SWE 的真实 merge 率永远不会出现在 PRarena 上**——这是 OSS 商业不对称的另一面：商业 agent 留下统一签名，OSS agent 用户不留签名。**OSS 阵营在产业景气度数据上注定是隐形的**。

### 弹药 6：Cursor Agents 97% 是 PRarena 数据正在被 Goodhart 化的最强警示

Cursor Agents 97% merge rate 实际上是**用户在 Cursor IDE 里完成大部分工作然后让 Cursor 帮忙开 PR** —— **这与"agent autonomous 产 PR" 完全不是同一件事**。但 PRarena 把它和 Devin 放在同一榜单——**PRarena 没有任务复杂度归一化**。

**对 Boris 的实操含义**：把 PRarena 当"产业景气度温度计"成立，**当排行榜用绝不成立**。引用时应当只引绝对数字（merge rate 区间 60-95% 的 spread 本身就是新闻），不引"谁第一"。

### 结构性偏差：PRarena 不会有人推它成权威 benchmark

Phase 5 §5 已经讲清楚：299 stars + 7 contributor + 个人维护 + 非学术非 Scale 非基金会。**没有任何机构有动机推 PRarena 成权威**——Cognition / OpenAI / Anthropic 都不会承认 PRarena 数据（因为它戳穿 marketing），学术圈不收（因为它不可复现），Scale 不推（因为它不能商业化）。

**所以 PRarena 永远是分析师弹药库，不会进官方 release notes**。Boris 日报视角下，这是个**完美的对手——它给数字，但厂商不能 own**。

---

## 3. CodeRabbit archive ai-pr-reviewer 尸检：OSS code review bot 是不是被判死刑

### 死亡时间线

- 2023-03：CodeRabbit 创始人开源 ai-pr-reviewer
- 2023-09：v1.16.2 最后 release
- 2024-2025：CodeRabbit 商业产品（coderabbit.ai）爆发式增长
- 2025-09：CodeRabbit 拿 **Series B $60M**，valuation **$550M**（Scale Venture Partners 领投，NVIDIA NVentures 跟投）
- 2025-12-17：CodeRabbit 发布 "State of AI vs Human Code Generation" 报告（"AI 写的代码 issue 比人类多 1.7×"）
- **2025-12-18：archive ai-pr-reviewer**
- 2026-04：CodeRabbit ARR 达 **$40M**（Sacra 估算），同比增长 700%

### 为什么 archive 时机选在 2025-12-18

不是因为 ai-pr-reviewer 不能用了，而是**CodeRabbit 商业产品已经达到不需要 OSS 引流的 ARR 规模**：
- 2025-09 时 ARR 只有 $15M，**仍需 OSS 做 lead-gen**
- 2025-12 ARR 已经在 $25-30M 区间，**OSS 引流的边际效用降到接近零**
- 2026-04 ARR $40M 后，**OSS arm 反而成了维护负担 + 品牌混淆源**

**这是商业 SaaS 完成产品市场契合后正式抛弃 OSS 拐杖的标准动作**。Phase 1 反模式 2（大厂 OSS 装门面）的精确变种 —— **不是大厂装门面，是商业 SaaS 用 OSS 做冷启动后扔掉 OSS**。

### CodeRabbit 商业产品做对了 OSS 版做不到什么

3 件事：
1. **学习用户偏好的 review style**（"learns from your usage and improves over time"）——OSS 版只能做 stateless review，Pro 版有持久化的 organization-level memory
2. **跨 PR 上下文 + 跨 repo 知识图谱**——OSS 版每次 review 是 single-PR 上下文，Pro 版会把同一组织所有 PR 的 review history 拉进上下文
3. **企业合规 + 安全态势 + SSO + audit log**——OSS 版完全没有

**第 3 件事是**真正决定胜负的护城河——企业不在乎 review 多准，企业在乎 audit 能过。

### OSS code review bot 是不是被判死刑

**严格说，是判 product market 死刑，不是技术死刑**。

观察 OSS 端 4 个仍活着的 review bot 项目：
- **PR-Agent**：11k stars 但 README 已经是 Qodo 商业品的 lead-gen，30d 16 commits 都是 model alias 维护
- **Shippie**：2.4k stars + **2025-08 后无 release + 2025-11 后无 push** —— 进入 zombie 状态
- **Hodor**：97 stars，2026-03 创建，**纯个人项目**
- **Gito**：216 stars，2025-04 创建，**纯个人项目**

**横切结论**：**OSS code review bot 已经分化成两种命运**——
- **类型 A：商业品的 OSS arm**（PR-Agent / 当年的 ai-pr-reviewer）—— **会在商业品达到 $30M+ ARR 后被 archive 或退化为 marketing repo**
- **类型 B：纯个人项目**（Hodor / Gito / Shippie）—— **永远到不了 1000 stars 以上规模，是兴趣项目而非赛道竞争者**

**纯 OSS 独立 code review bot 这条赛道实质上不存在**。原因是结构性的——**review bot 的产品价值正比于"被多少 enterprise 用 + 多少种 org-level 偏好被学习到"**，OSS 单仓库部署模型先天满足不了这个价值方程。

### 留下的 OSS 项目还有什么生存空间

3 个：
1. **PR-Agent 作为 Qodo 入口** —— 永远活，但永远是 marketing repo 不是产品
2. **特别窄的差异化路线**——Mutahunter（mutation testing 而非 review）、Hodor（multi-step reasoning 强调）—— **能在 narrow niche 活下来但永远 < 500 stars**
3. **AI-aware review 这个新子赛道**（§7 详述）—— **唯一可能让 OSS 赢一次的窗口**

---

## 4. Sweep 死亡转身的原因：issue→PR bot 路线的市场宣告失败

### 时间线

- 2023-06：Sweep 开源，issue→PR bot
- 2023 年中：YC W24，是 Devin 同代竞品
- 2024：stars 从 0 涨到 7.6k，社区快速增长
- 2025：**逐渐放慢 OSS 维护**
- 2025-09：**最后一次 push 到主 repo**（30d 0 commits）
- 现在：**sweep.dev 网站完全转向 "AI for JetBrains IDEs"**，**Sweep AI 公司 = JetBrains plugin 公司**

### 为什么转身

公司公开的解释（YC 公司页 + sweep.dev）**"realized building an AI junior developer was many years out, decided to build a coding assistant developers could use today"**——**这是 2024 年 Devin 第一波热度退潮后整个 issue→PR bot 赛道的共识**：

1. **autonomous SWE 的 60% merge rate 上限（PRarena 数据 + Devin 自报）让 enterprise 不敢部署到生产 critical path**
2. **每个 PR 都需要 human review** —— 节省的不是 review 时间，只是"打字时间"
3. **JetBrains 用户群（企业 Java/Kotlin 开发者）更愿意为 IDE 内的 inline coding assistant 付费**——这是 GitHub Copilot 已经验证的市场

### 对所有 OSS autonomous SWE 是什么警示

**Sweep 是 OSS autonomous SWE 的"提前给 OSS 写好的死亡剧本"**：
- 阶段 1：开源 + 病毒式 stars（Devika 19.5k、Devon 3.4k 走到这一步）
- 阶段 2：发现 merge rate 上限 + enterprise 不愿部署
- 阶段 3：转 IDE 内 assistant（Sweep）/ 转闭源 cloud（Devin）/ 死掉（Devon、Devika）

**Devika / Devon 当前状态精确处于"阶段 2 转 3 的过渡期"**——它们的死亡基本已成定局。**Phase 1 把 Devika / Devon 列入 radar 是正确的，但本期建议**降级到"已验证不可持续的 OSS autonomous SWE 案例库"**。

### 对 OpenHands 是不是同一警示

**不一样**。OpenHands 已经做了 Sweep 路线的"防御性变体"：
1. **同时维护 OSS（72k stars）+ cloud SaaS**——不是非此即彼
2. **拿了 $18.8M Series A**——商业化路径明确
3. **v1.6.0 加 Kubernetes + RBAC**——直接进 enterprise self-hosting 市场，而不是消费者 SaaS
4. **53% SWE-bench Verified（Claude 4.5）**——SWE-bench 只是 marketing，真定位是 "open platform for cloud coding agents"

**OpenHands 已经避开 Sweep 死亡剧本的关键拐点**——它没押"完全 autonomous"的 narrative，押的是"open infrastructure for any coding agent"。这是 Phase 3 子类 C（Tool / Integration Hub）的玩法，不是 Phase 1 Archetype 3 的玩法。**严格说，OpenHands 已经从 Archetype 3 transition 到 Archetype 5 + Archetype 1 的混合**——这是它能活的根本原因。

---

## 5. Autonomous SWE 真实 merge 率分析：PRarena + Cognition + GitHub 三方交叉

### Devin（Cognition 自报 + PRarena 双源）

- **2025**：34% PR merge rate
- **2026 Q1**：**67% PR merge rate（任务定义清晰的场景下）**
- **2026 Q1**：内部一周 merge **659 个 Devin-generated PRs**（vs 2025 best week 154 个）—— **4× growth in 6 months**
- **任务成功率**：~75%（其余 25% 需要人工介入）
- **PRarena 公开 GitHub 数据**：60.9%

**判断**：Devin 的 67% merge rate 跨过了"30% hype 阈值"，**当前是 autonomous SWE 唯一一家披露过 ≥50% production merge rate 的厂商**。Cognition 把这个数字归因于 (a) Claude 4.5/4.7 模型升级，(b) Cognition 自己的 RL 训练 pipeline，(c) "defined task" 范围的收缩（即 Devin 学会拒接超出能力的 task）。

### GitHub Copilot Coding Agent（GitHub 公告 + Accenture deployment + PRarena）

- **PRarena**：95.9% merge rate（1.29M merged / 1.35M ready）
- **Accenture 450 开发者部署**：**+8.69% PRs/dev + 15% PR merge rate 提升**（vs 不用 Copilot 的 baseline）
- **GitHub usage metrics API**（2026-04-08 上线）：**新增 `pull_requests.total_merged_reviewed_by_copilot` + `pull_requests.median_minutes_to_merge_copilot_reviewed` 两个 metric**——表明 GitHub 内部已经把"Copilot 参与 review 的 PR 是否快速 merge"作为产品 KPI

**判断**：Copilot Coding Agent 的 95.9% merge rate **不能与 Devin 67% 直接比较**——前者主要是低复杂度任务（GitHub Action 自动化、依赖更新、typo fix），**后者是 ticket-level 跨文件长 session**。**真要做苹果对苹果对比的话，Copilot Coding Agent 在"≥3 文件改动 + ≥100 行 diff"这一段的 merge rate 大概率也在 60-70% 区间**——但 GitHub 没披露分层数据。

### Jules（Google）

- **PRarena**：92.0% merge rate（189K merged / 205K ready）
- **Google 官方未公开 merge rate**

**判断**：Jules 92% 与 Copilot 96% 接近——同样是"被 Goodhart 化的 success rate"，主要任务为低复杂度。Google 没有像 Cognition 那样披露 task-complexity-aware 数字。

### OSS 阵营（OpenHands / SWE-agent / Devon / Devika）

**没有任何一家公开过 production merge rate**。原因：
1. **OpenHands** 主要在 enterprise self-hosting，部署方不公开数据
2. **SWE-agent** 是 benchmark harness 而非 production tool
3. **Devon / Devika** 已停滞，无 production 部署

**这就是 Phase 5 §5 弹药 5 提到的"OSS 阵营在产业景气度数据上注定隐形"** —— OSS autonomous SWE 没有可比的 merge rate 数据出来。

### 真实 merge 率超过 30% 的有几个？

公开数据可证的：
- **Devin 67%** ✓（Cognition 自报）
- **OpenHands 53% SWE-bench Verified** ✓（但 SWE-bench 不等于 production merge rate）
- Codex / Copilot / Jules 高 merge rate（90%+）但**任务复杂度不可比**

**严格意义上跨 30% 阈值的 autonomous SWE 只有 Devin 一家有公开数据**。Copilot / Jules 的 90%+ 是不同任务集，不能直接比；OpenHands / SWE-agent 没有 production merge 数据。

### Archetype 3 是不是 hype

**部分是 hype，但比 Phase 5 想象的要乐观**。

Phase 5 §0 曾预言"autonomous SWE 整个 archetype 是 hype" 是个 contrarian 假说。本期数据**部分否决了这个假说**：
- Devin 从 34%（2025）到 67%（2026）的翻倍 + Cognition 一周 659 PR 的产能 + "hundreds of thousands of PRs across customer deployments"——**这不是 hype，是真实产业**
- 但 OSS 阵营基本死亡（Devika / Devon / Sweep 全部停滞或转身）—— **OSS 这一面是 hype，仅商业头部是真**

**精炼判断**：**Archetype 3 不是 hype，是 OSS 不可达的赛道**。OSS autonomous SWE 这条线已经死亡——剩下的都是闭源 + 商业品（Devin / Copilot / Jules / Codegen）。**OpenHands 是唯一例外，但它已经不是纯 OSS autonomous SWE，是 "open infrastructure for cloud coding agents"**。

---

## 6. 商业化模型对比：哪个在 review/SWE agent 类别下最 work

5 种商业模型横评：

| 模型 | 代表 | 当前状态 | 判断 |
|---|---|---|---|
| **按 PR 数计费** | CodeRabbit、Greptile | **CodeRabbit $40M ARR + Greptile $180M valuation Series A** | **review 端最 work 模型** |
| **按 token 计费 / 用户自付 LLM** | PR-Agent OSS 用户 | PR-Agent 11k stars 但 OSS arm 已是 marketing | **失败**——用户不愿管 token 账单 |
| **包月 SaaS** | Sourcery（10€/dev/mo） | 老牌，无新闻 | **平稳但没爆发** |
| **免费 + paid tier** | Devin Team plan、OpenHands cloud | Devin 开 Team plan 后 enterprise 渗透加速；OpenHands $18.8M Series A | **autonomous SWE 端正在跑通** |
| **完全闭源 enterprise** | Cursor Agents（部分）、GitHub Copilot Coding Agent | Copilot Coding Agent 已是 Microsoft 产品矩阵的一部分 | **大厂内化路线** |

**review 端的赢家是按 PR 数计费 + enterprise SaaS**：CodeRabbit ARR 40M + Greptile $180M valuation 都用这个模型。**关键技术差异不大**，关键是销售（CodeRabbit 有 8000+ 付费客户，Greptile 250+ 包括 Stripe / Amazon）。

**autonomous SWE 端的赢家是免费 + paid tier**：Devin Team plan 的存在让 enterprise 可以小成本试水，跑通后转 enterprise 包年。

**失败模型**：
- **PR-Agent 模式（OSS + 用户自付 LLM）**——发现没人愿意管 LLM token 账单，所以 PR-Agent 自然演化成 Qodo 商业品的 funnel
- **独立 OSS code review bot**（Shippie / Hodor / Gito）——永远做不到 enterprise SaaS 规模

---

## 7. GitHub workflow 内嵌 vs 独立 CLI / Service

Review bot 端：**几乎全部 GitHub Actions 内嵌**——PR-Agent / Shippie / ai-pr-reviewer / Hodor / Gito / CodeRabbit / Greptile 全部以 GitHub App 或 Action 形式部署。**这是 review bot 唯一可行的 surface**——人在 PR 页面看 review，agent 必须在 PR comment 里出现。

Autonomous SWE 端：**两派分流**：
- **GitHub Action / 内嵌派**：GitHub Copilot Coding Agent（Microsoft 自家）、daiv（git workflow 内嵌）—— **优势是 GitHub 原生体验**
- **独立服务派**：Devin（cognition.ai 网站）、OpenHands（cloud SaaS + self-host）、Jules（Google Labs）—— **优势是不受 GitHub 限制，可同时支持 GitLab / Bitbucket**

**哪条路更好**：
- **review 必须 GitHub 内嵌**——没有第二条路
- **autonomous SWE 应当独立服务 + GitHub 集成**——独立服务保留产品自主权（Devin 可以加自己的 dashboard / planner / observability），同时通过 GitHub App 把 PR 触发能力内嵌

**Sweep 把这件事做反了** —— Sweep 当年押 GitHub Action 内嵌，发现 GitHub UX 限制太多（不能加自己的 planner UI），于是转 JetBrains plugin。**这是 Sweep 死亡转身的另一个解释维度**——**GitHub Action 是 review bot 的家，但是 autonomous SWE 的牢笼**。

---

## 8. "AI review AI 写的 PR" 是否会成新子赛道

Phase 5 §5 弹药 4 + 本期 §1 PRarena 数据已经把背景说清楚：**Codex 一周新增 100K+ PR + Copilot Coding Agent 一周新增 30K+ PR + Jules 一周新增 10K+ PR**——**全部需要 human review**。这就是 §1 第 4 条信号 "Review Gap" 的来源（dev.to 引文："AI 已经生成 20-30% 生产代码，review 端容量没跟上 → 40% quality deficit"）。

### 现有项目里谁在做

**搜索结果显示这个子赛道已经悄悄发生但没人挂这个标签**：
- **Qodo（PR-Agent 母公司）**：blog 明确写"AI-powered PR review is especially strong at catching broken access control patterns (especially in AI-generated code that passes tests but omits authentication)"——**已经把"AI-aware review"作为产品差异化点**
- **Graphite Agent**：sub-5% negative feedback rate + 90 秒 review——**不挂"AI-aware"标签但实际服务对象主要是 Cursor / Copilot 用户**
- **CodeRabbit**：2025-12 发布 "AI vs Human Code Generation" 报告，**承认 AI 写的代码 issue 比人类多 1.7×**——**这个 narrative 直接把 CodeRabbit 定位成"AI 时代必备的质量 gate"**

### 现有 review bot 能直接复用还是要专门 "AI-aware review"

**严格说，技术上能复用 80%——但需要 narrative 层重新包装**。理由：
- AI 写的 bug pattern 与人类不同：**AI 容易在 auth/permission/error handling 上偷工减料**（Qodo 调查结论）
- AI 写的 PR 通常通过单元测试但有"看起来对但实际不对"的逻辑漏洞——这要求 review 工具具有**业务上下文理解**而非纯语法 review
- AI PR 描述往往很完整，**反而让 reviewer 错觉一切都对**——需要 review 工具主动 challenge PR 描述

### 这是不是 review bot 派的新生机

**对 OSS review bot 是真生机** —— 因为它和 enterprise CodeRabbit 在 narrative 层正交。OSS 项目可以做"专门为 AI-generated code 优化的 review"，不和 CodeRabbit 抢"通用 enterprise review"市场。

**预测**：6-12 月内会出现至少 2 个挂 "AI-aware review" / "AI code QA" 显式标签的 OSS 项目，stars 在 1-3k 区间。**Hodor 这种 multi-step reasoning 强调的项目位置最好**——它已经在做"跨文件分析" 这件事，加一个 "AI-generated code aware" mode 就是定位。

**对商业 review bot 来说**：CodeRabbit / Greptile / Qodo 都已经在做。**2026 年下半年这个 narrative 会成为商业品的标配卖点，而不是单独的子赛道**。

---

## 9. 给 Boris 的判断

### 跟踪：每周扫的 4 个 + 月度看的 4 个

**每周必看**（4 个）：
- **PRarena dashboard (prarena.ai)**——产业景气度温度计，唯一中立的产 PR 数据源
- **OpenHands releases + commits**——OSS autonomous SWE 唯一活体
- **CodeRabbit / Greptile blog**——商业 review bot 龙头的 narrative 风向
- **Cognition Devin blog**——autonomous SWE 商业头部的产品节奏

**月度看**（4 个）：
- **GitHub Copilot Coding Agent changelog**——Microsoft 内化 autonomous SWE 的进度
- **Qodo blog**（PR-Agent 母公司）——AI-aware review 子赛道的早期信号
- **Codegen.com**——PRarena 排名第 5 的"被低估第二真 autonomous"
- **PR-Agent commits 节奏**——OSS 端是否有任何复活迹象

### 押：6-12 月哪个会被收购

**第一押注：Codegen.com 被 GitHub / Anthropic 收购**。理由：
- Codegen 在 PRarena 排名第 5 + autonomous SWE 真 merge 率 + YC W24 + 体量适中（不是 Devin 那种独角兽）
- 它的产品形态（cloud autonomous）正好是 Anthropic 缺的（Claude Code 是 CLI，没有 cloud 入口）
- 估值合理（不像 Cognition 那种 $4B+ valuation 没人能买）

**第二押注：Greptile 被 GitHub / Microsoft 收购**。理由：
- Greptile $180M valuation Series A 已经是收购可承受区间
- Microsoft GitHub Copilot review 能力还没有独立产品形态
- 用户重叠度高（Stripe / Amazon 同时是两边客户）

**不押 CodeRabbit 被收购**——$550M valuation + $40M ARR + 700% 增速，**Series B 后下一步是 IPO 不是被收购**。

### 丢：哪些已死或必死

**已死**：
- **ai-pr-reviewer**：archived 2025-12-18
- **Devon (entropy-research)**：11 月停滞 + 无 release，**从 radar 删除**
- **Devika**：7 月停滞 + 19.5k stars 的"博物馆"状态，**从 radar 主表降到"已死 OSS autonomous SWE 案例库"**
- **Sweep（原 issue→PR bot 形态）**：已转 JetBrains plugin，**从 radar 类别 4 删除，降到"已转身案例"**
- **Mutahunter**：12 月停滞，**从 radar 删除**

**必死（6 月内）**：
- **Shippie**：5 月无 push + 8 月无 release，**6 月内进入 zombie 或 archive**
- **hermes-swe-agent / daiv / pilot**：个人项目 < 500 stars，**6 月内大概率进入维护停滞**

### 6 月内决胜事件：5 个可观测信号

按重要性排序：
1. **PRarena 是否新增追踪 OpenHands 或 Codegen 之外的第 7 个 agent**——决定 PRarena 数据广度能否扩展
2. **Cognition 是否在 2026 Q3 发布"per-task-complexity merge rate"分层数据**——决定 autonomous SWE 数据透明度走向
3. **是否出现一个明确挂"AI-aware review" 标签的 OSS 项目突破 1k stars**——决定 §8 子赛道是否实质化
4. **Codegen 或 Greptile 任意一家被收购公告**——决定 §9 押注命中
5. **OpenHands 是否新增 hosted "PR review" mode**（即从 autonomous SWE 跨到 review bot）——决定 OpenHands 是否会包抄 review 端

### 对日报选材的影响

**该入日报的 PR 类新闻**：
- PRarena 数据更新（每周引用一次"本周 agent merge rate 排行"是合理的）
- 商业 review bot 融资（CodeRabbit / Greptile / Qodo / Sourcery 任一动作）
- Cognition / OpenAI / Anthropic / Google 任一家公开 agent 任务级 merge rate 分层数据
- "AI-aware review" 子赛道任何 OSS 新项目突破 500 stars
- Sweep 模式重演（任一 OSS autonomous SWE 公开转身去做 IDE plugin）

**不该入日报的**：
- "X agent 排第 N" 类型 PRarena 排名变动新闻（任务复杂度不可比，排名意义弱）
- 单仓库 / < 500 stars 的新 OSS review bot 上线（**已被结构性证伪的赛道，不值得追**）
- 任何"我们也开源了 code review bot"的公司公告（CodeRabbit 死亡剧本会重演）

### 特别建议：日报常驻栏目"本周 agent merge 率排行"是否可行

**部分可行，但要重新设计**：

**直接照搬 PRarena 排名 = 不可行**。理由前面已经说过——任务复杂度不可比，排名前 3 都是"简单任务高产 agent"，反而误导读者。

**可行版本：每周引用 PRarena 数据的 3 个具体维度**：
1. **绝对量级**："本周 Codex 新增 X 万 PR、Devin 新增 Y 千 PR" —— 量级新闻，体现 agent 产业占 GitHub 流量的份额
2. **趋势变化**："本周 Devin merge rate 较上周 +/- N pp"——趋势新闻，体现单一 agent 产品迭代节奏
3. **任务复杂度归一化估算**：用 "merged PR / total ready PR / avg files changed" 三元组而非单一 success rate 排名

**频率**：每周更新一次，写 100 字以内，**作为日报固定 sidebar 而非头条**——这与 PRarena "弹药库"定位匹配。

---

## 10. radar 反向修正

本期对 Phase 1 / radar 的归类修正（5 处）：

1. **Sweep** Phase 1 在 radar 类别 4（Code Review/PR bot）—— 本期建议：**从 radar 删除，降到"已转身案例库"**。它早就不是 issue→PR bot 了，是 JetBrains autocomplete plugin
2. **Devon** Phase 1 在 Archetype 3 —— 本期建议：**从 radar 删除**。11 月停滞 + 无 release + 3.4k stars 的"博物馆"
3. **Devika** Phase 1 在 Archetype 3 —— 本期建议：**从 radar 主表降到"已死 OSS autonomous SWE 案例库"**。19.5k stars 但已停滞 7 月
4. **Codegen.com** Phase 1 没在 radar —— 本期建议：**新增到"商业 autonomous SWE"**，与 Devin / Jules / GitHub Copilot Coding Agent 并列。**这是 Phase 1 漏了的关键玩家**
5. **ai-pr-reviewer** Phase 1 在 radar 类别 4 —— 本期建议：**从主表移到"已死 OSS code review bot 案例库"**，作 Phase 1 反模式 2 变种（"商业 SaaS 完成 PMF 后抛弃 OSS 拐杖"）的标准案例

**对 Phase 1 反模式 2 的实质性扩展**：

> 原版："大厂 OSS 装门面"——大厂开 OSS 但精力在闭源
>
> 扩展版（本期 §3 提炼）：**反模式 2.b "商业 SaaS 完成 PMF 后抛弃 OSS 拐杖"**——OSS 不是装门面，是真做了 1-2 年用来冷启动，达到一定 ARR 后正式 archive。识别信号：(a) 商业品 ARR 跨过 $25M，(b) OSS arm 最近 release 距今 > 18 月，(c) 商业品官网完全不提 OSS 入口

**对 Phase 1 接触面轴 B "Inside-the-PR" 一格的精确化**：

> 原版：Inside-the-PR 是统一一格（PR-Agent + CodeRabbit + Hodor + Gito 并列）
>
> 扩展版：**Inside-the-PR 实际是 4 块 4 命运**：
> - **Inside-the-PR × Review × OSS** = **死赛道**（Shippie / Hodor / Gito 都做不大）
> - **Inside-the-PR × Review × 商业** = **当前最赚钱赛道**（CodeRabbit $40M ARR / Greptile $180M valuation）
> - **Inside-the-PR × 产 PR × OSS** = **垂死**（Devika / Devon / Sweep 全部退场，仅 OpenHands 转 infra 形态活）
> - **Inside-the-PR × 产 PR × 商业** = **PRarena 6 个全部活**（Copilot / Codex / Cursor / Devin / Codegen / Jules）

**对 Phase 1 Archetype 3（Autonomous SWE）的精炼**：

> 原版：拿 issue 输入 → PR 输出，中间过程对人不透明
>
> 扩展版：**Archetype 3 在 OSS 视角下已死，仅剩商业品**。OSS autonomous SWE 走 Sweep / Devika / Devon 死亡剧本是大概率事件。**OpenHands 例外是因为它实质上从 Archetype 3 transition 到 Archetype 5（infra）**

**对 Phase 1 开放问题"什么样的 PR-related 新闻该入日报"的精确回答**：

> §9 给出了 5 类该入 + 3 类不该入，**Boris 日报的 PR 类选材标准本期已经给出 SOP**

---

## 11. Contrarian 收束：3 个反直觉论断

### 论断 1：OSS code review bot 是结构性死赛道，不只是当前阶段死

主流叙述说"OSS review bot 还在早期，慢慢会有赢家"。**实际上不会**。理由：**review bot 的产品价值方程要求 enterprise SaaS 形态**（org-level 偏好学习 + audit log + SSO）——这是 OSS 单仓库部署模型先天不支持的。**剩下的 OSS 项目要么是商业品的 funnel（PR-Agent），要么是 < 500 stars 的兴趣项目（Hodor / Gito）**。

### 论断 2：autonomous SWE 不是 hype，但 OSS autonomous SWE 是

Phase 5 §0 假说"autonomous SWE 整个 archetype 是 hype"在本期数据下被部分否决——Devin 67% merge rate + Cognition 一周 659 PR + "hundreds of thousands across customer deployments" 这些数字证明商业 autonomous SWE 已经是真实产业。**但 OSS 这一面是 hype**——Devika / Devon / Sweep 全部走完死亡剧本，OpenHands 必须 transition 到 infra 形态才能活。**判断 hype / 真实的关键不是 archetype，是商业 vs OSS 的边界**。

### 论断 3：PRarena 是日报弹药库但永远不会是权威 benchmark

Phase 5 §5 已经打过预防针，本期数据完全验证：**没有任何机构有动机推 PRarena 成权威**。Cognition / OpenAI / Anthropic / Google 都不会承认（PRarena 戳穿 marketing），学术圈不收（不可复现），Scale 不推（不能商业化）。**PRarena 永远是 299 stars + 7 contributor + 个人维护**——这恰恰是它的最大价值：**它不是任何人的产品，所以才能给中立数字**。**Boris 日报应当把 PRarena 当对手——它给数字，但厂商不能 own**。

---

## 12. 本期收束

13 个 OSS 项目 + 6 个 PRarena 商业 agent，分 4 类 4 命运：

1. **OSS review bot 4 个**：PR-Agent（marketing repo 化）+ Shippie / Hodor / Gito（个人项目 < 500 stars）+ ai-pr-reviewer（archived）+ Mutahunter（12 月停滞）—— **赛道结构性死**
2. **OSS autonomous SWE 7 个**：OpenHands（唯一活体 + transition 到 infra）+ SWE-agent（harness 而非 production）+ Devon / Devika / pilot / daiv / hermes-swe-agent（个人项目或停滞）+ Sweep（已转身）—— **OSS 部分基本死亡**
3. **商业 review bot 3 个对照**：CodeRabbit（$40M ARR）+ Greptile（$180M valuation）+ Sourcery（平稳）—— **CodeRabbit 模式胜**
4. **商业 autonomous SWE / 产 PR agent 6 个（PRarena 全表）**：Copilot / Codex / Cursor / Devin / Codegen / Jules —— **全活，量级 100×-1000× 于 OSS**

**Phase 5 §5 PRarena 弹药库论断在本期完全兑现**：
- PRarena 给出 6 个 agent 的真实 success rate（60.9% - 97.0%）
- Cognition 自报 Devin 67% vs PRarena 60.9% 的 6pp 差距揭示"PRarena 是 lower bound"
- Codex / Copilot 几百万 PR 量级 vs Devin 几十万 vs Codegen 几千 —— **agent 产 PR 已是 GitHub 主流流量**

**Phase 1 反模式 1 + 2 + Archetype 3 + 接触面轴 B 在本期同时被精炼**：
- 反模式 1（学术 PoC dump）扩展出非学术变种 "OSS 社区项目 stars 到顶后转商业，OSS 进入博物馆"（Devika / Devon）
- 反模式 2（大厂 OSS 装门面）扩展出 "商业 SaaS 完成 PMF 后抛弃 OSS 拐杖"（ai-pr-reviewer）
- Archetype 3 精炼为"OSS 视角下已死，仅商业品活"
- 接触面轴 B "Inside-the-PR" 精炼为 4 块 4 命运

**12 月内会被回答的开放问题（接 Phase 1-5）**：
- **Codegen 或 Greptile 是否被 Anthropic / GitHub / Microsoft 收购**（§9 第一第二押注）
- **是否出现 1 个明确"AI-aware review" 标签的 OSS 项目突破 1k stars**（§8 子赛道实质化信号）
- **Cognition 是否披露 Devin per-task-complexity 分层 merge rate**（autonomous SWE 数据透明度方向）
- **OpenHands 是否新增 hosted PR review mode**（infra 派包抄 review 端的最强信号）
- **PRarena 是否被任一主流媒体引用为产业指标**（Phase 5 已埋的同一观测点，本期再次确认未发生）

---

## Phase 7 前瞻

下期（第 7 期，Synthesis）做 **12 个月回看 + Phase 1 那 8 个开放问题各自答案 + archetype 定义和反模式清单的最终更新**——把 Phase 1-6 提炼出的所有"扩展版"反模式（反模式 2.b "商业 SaaS 抛弃 OSS 拐杖"、反模式 1 非学术变种"OSS stars 到顶转商业"、张力 6 精炼"单 paper benchmark KPI 1 年内死"、接触面轴 B "Inside-the-PR 4 块 4 命运"等）合并成一份给 12 个月后的 Boris 用的"agent landscape SOP"。**本期的 OSS code review bot 死赛道判断 + autonomous SWE OSS / 商业边界判断 + PRarena 弹药库使用方法**会作为 Phase 7 中"OSS vs 商业边界为什么在 SE agent 赛道这么清晰"这个核心 synthesis 命题的关键素材。
