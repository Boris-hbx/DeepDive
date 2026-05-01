# Talk Report — "Full Walkthrough: Workflow for AI Coding from Planning to Production"

> Matt Pocock @ AI Engineer 大会 · 2026-04-24 · 96 min hands-on workshop
>
> 观看：[YouTube](https://youtu.be/-QFHIoCo-Ko)（49K views · 1.8K likes）

## TL;DR

姊妹 keynote 的 **fleshing out**——把 thesis 落到具体工作流：从模糊需求 → grill session → PRD → 切成可并行 GitHub issues → AFK agents 跑 implement+review → 人工最终 review。比 keynote 多出来的实操层贡献：smart zone vs dumb zone 概念、Ralph Wiggum 单循环模式、push vs pull 指令分工、Matt 自写的 Sand Castle 并行 agent 编排框架。

## 演讲背景

- 同一场大会、姊妹场（详见 `2026-04-26-talk-fundamentals.md`）
- Matt 自陈："workshop 是 keynote 的具体化——我相信 software engineering fundamentals 在和 AI 协作时同样有效，今天会用代码证明它"

## 核心实操概念

### 1. Smart zone vs dumb zone

来自 **Dex Hy / Human Layer**。LLM 在大约 **100K tokens** 之后开始退化，无论 context window 标的是 200K 还是 1M——原因是 attention relationships 跟 token 数二次增长。任务必须切到能装在 smart zone 内。

> "1M 上下文不会让你不进 dumb zone。"

### 2. Ralph Wiggum loop

不写 multi-phase plan（phase 1/2/3/4），只写 PRD 描述 destination，让 AI 在循环里 *"make small change closer to goal"*——phase n 而非有限 phase。配合下面的并行架构能跑出 hands-off / AFK 效果。

### 3. Push vs Pull 指令模式

| 模式 | 形态 | 谁取 | 谁用 |
|---|---|---|---|
| **Push** | 写在 `CLAUDE.md` | LLM 永远看到 | 适合 reviewer agent（强制带上 coding standards） |
| **Pull** | 放进 skills | LLM 按需取 | 适合 implementer agent（避免 context 爆掉） |

这套区分让 implementer 保持 context 干净、reviewer 始终带着标准。

### 4. Sand Castle —— Matt 自写的 TS 并行 agent 框架

```
planner (扫 backlog, 选 N 个并行任务)
   ↓
implementer × N (Sonnet) ── 各跑在 docker + git worktree
   ↓
reviewer × N (Opus, 因 review 需要 smarts)
   ↓
merger (解决合并冲突)
```

Matt 不掩饰这是他自己的 lib，演示中已在跑实际 project。**模型分配**：implementer 用 Sonnet（量大、快、便宜），reviewer 用 Opus（要看出问题需要 smarts）。

### 5. 完整 flow

```
grill session（建 shared mental model）
    ↓
PRD（不过度优化——"PRD 只是方向 hint，真正功夫花在 QA"）
    ↓
切成可并行 GitHub issues（含 blocking 关系）
    ↓
AFK agents 跑 implement + review（Sand Castle 编排）
    ↓
QA 阶段生成更多 issue 进 canon board（边跑边补）
    ↓
人工最终 review
```

## 金句

- *"the rate of feedback is your speed limit"*
- *"PRD 只是方向 hint，真正功夫花在 QA"*
- *"AI 自己生成的 codebase 形态正好是 AI 自己最难导航的形态"*
- 闭幕：*"head to Amazon and just buy a ton of those old books"*

## 与本周 daily brief 的关系

和姊妹 keynote 一起，构成本周"实战派"对 vendor 主线（GPT-5.5 / Anthropic stumble / Copilot 收紧，详见 `2026-04-26.md`）的工程派回应。Sand Castle 这种**自写编排框架**的做法，恰好回应了 §03 GitHub Copilot 收紧把开发者推向"自托管 / 自编排"工具链的趋势。

## 蓝军视角分析

**原文观点**：smart zone @ ~100K + Ralph loop + push/pull 区分 + Sand Castle 编排 = 可复用的 agentic SE workflow。

**蓝军视角分析**：workshop 信息密度高但有几处需要警惕。其一，**"smart zone @ ~100K tokens" 是经验观察**，没给 benchmark；Anthropic 同周公布的 1M context Opus 4.7 恰好在攻击这个边界，结论的时效性可能短于 6 个月。其二，**Sand Castle 是 N 个相似工具中的一个**（Aider、官方 codex CLI、各家 agent harness），Matt 在大会演示自写 lib 自带"绑定 ecosystem"动机——观众容易把它当 canonical，其实只是一组配置选择。其三，**Sonnet implement + Opus review 是 2× 成本决定**，演讲没给 ROI 数据；同模型双角色、或纯 Opus 单跑可能差距没那么大。其四，**"PRD 不要过度优化、价值在 QA"** 听起来反直觉但合理，可没给"何时算够"的判定条件——欠 spec 让 agent 走得很宽，怎么平衡仍是手艺活。

## 观看链接

[Full Walkthrough: Workflow for AI Coding from Planning to Production — Matt Pocock · YouTube](https://youtu.be/-QFHIoCo-Ko)
