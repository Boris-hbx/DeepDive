---
marp: true
theme: default
paginate: true
backgroundColor: #fff
style: |
  section { font-size: 22px; }
  h1 { font-size: 36px; }
  h2 { font-size: 28px; color: #2563eb; }
  h3 { font-size: 22px; }
  table { font-size: 16px; }
  ul, ol { font-size: 20px; }
  p { font-size: 20px; }
---

<!-- _class: lead -->

# 追问：有哪些关键技术，有哪些TOP热点论文，请进一步分析

**技能工程 · AI智能体 · 能力编排 · 大模型 · 提示工程 · 微服务 · 语义检索**

---

## TL;DR

Skill 工程的技术纵深远超"Prompt + Function Calling"的表层认知。其核心技术栈沿三条主线展开：**能力封装与描述**（Tool-use 规范、语义Schema）、**动态编排与规划**（Task Decomposition、Plan-and-Execute）、**评估与可靠性保障**（LLM-as-Judge、形式化验证）。2023-2025 年间，以 Toolformer、HuggingGPT、Gorilla、ToolBench 为代表的论文集群定义了这一领域的学术坐标系，而 ReAct、LATS、AutoGen 等工作则直接塑造了工程实践范式。本报告梳理 6 大关键技术方向与 15+ 篇核心论文，为团队构建 Skill 工程技术雷达提供参考基线。

---

---

## 关键技术方向分析

### 技术方向 1：Tool-use 与 Function Calling — Skill 的接口层基石

Tool-use 是 Skill 工程最底层的技术原语。它解决的核心问题是：**如何让 LLM 理解、选择并正确调用外部工具**。

当前三大技术路线并存：

| 路线 | 代表方案 | 核心机制 | 优劣势 |
|------|---------|---------|--------|
| Prompt-based | ReAct, Toolformer | 通过 In-context Learning 教会模型使用工具 | 灵活但不稳定，依赖 Prompt 质量 |
| Fine-tuning-based | Gorilla, ToolLLaMA | 在工具调用数据上微调模型 | 调用准确率高，但泛化到新工具成本大 |
| Native Function Calling | OpenAI FC, Claude Tool Use | 模型原生支持结构化工具调用 | 工程友好，但受限于厂商实现 |

关键论文：

- **Toolformer (Schick et al., 2023, Meta)** — 开山之作。证明 LLM 可以自主学习何时、如何调用外部工具（计算器、搜索引擎、翻译API等）。

*(...)*

---

### 技术方向 2：Planning & Task Decomposition — Skill 的编排层引擎

当 Agent 面对复杂任务时，需要将其分解为多个 Skill 的有序调用链。这是 Skill 工程中最具挑战性的技术层。

关键论文：

- **ReAct: Synergizing Reasoning and Acting (Yao et al., 2023, Princeton & Google)** — 提出 Reasoning + Acting 交替执行的范式：模型先生成推理轨迹（Thought），再决定行动（Action），观察结果（Observation）后继续推理。ReAct 是当前绝大多数 Agent 框架（LangChain、LlamaIndex）的默认编排模式，本质上定义了 Skill 调用的"思考-执行-观察"循环协议。
- **HuggingGPT (Shen et al., 2023, 浙大 & Microsoft)** — 提出以 LLM 为控制器、以 Hugging Face 模型库为 Skill 池的架构。LLM 负责任务规划、模型选择、执行编排和结果聚合。这篇论文的核心洞察是：**Skill 不仅是 API，AI 模型本身也是 Skill**。这极大拓展了 Skill 工程的能力边界。

*(...)*

---

### 技术方向 3：Multi-Agent Skill 协作 — 从单体到分布式

当系统复杂度超过单个 Agent 的能力边界时，多 Agent 协作成为必然选择。每个 Agent 携带不同的 Skill 集合，通过协议进行协商和任务分配。

关键论文与框架：

- **AutoGen (Wu et al., 2023, Microsoft)** — 提出可定制的多 Agent 对话框架，Agent 之间通过消息传递协作完成任务。其核心设计是 **ConversableAgent** 抽象，每个 Agent 可配置不同的 Skill（代码执行、工具调用、人类反馈）。AutoGen 的工程意义在于证明了 Skill 的组合不仅发生在单 Agent 内部，也发生在 Agent 之间。
- **MetaGPT (Hong et al., 2023)** — 将软件工程中的 SOP（标准作业流程）编码为多 Agent 协作协议。产品经理 Agent、架构师 Agent、工程师 Agent 各自持有领域 Skill，通过结构化文档（PRD、设计文档、代码）进行异步协作。这是 Skill 工程在软件开发领域的直接应用。
- **CrewAI** — 开源框架，强调基于角色（Role）的 Skill 分配和基于任务（Task）的协作编排。其 `@tool` 装饰器和 Agent 的 `tools` 参数直接体现了 Skill 注册与绑定的工程模式。

---

### 技术方向 4：Skill 评估与可靠性 — 非确定性系统的质量保障

Skill 输出的非确定性是工程化的最大障碍。这一方向的技术目标是：**在不牺牲灵活性的前提下，建立可量化的 Skill 质量基线**。

关键论文与工具：

- **Judging LLM-as-a-Judge (Zheng et al., 2023, LMSYS)** — 系统研究了使用 GPT-4 作为评估器的可靠性，发现其与人类评估的一致性超过 80%。这为 Skill 输出的自动化评估提供了理论基础。但论文也指出了位置偏差、冗长偏差等系统性问题，提醒 Skill 评估管线需要校准机制。
- **AgentBench (Liu et al., 2023, 清华)** — 构建了覆盖 8 个环境（操作系统、数据库、知识图谱、Web 等）的 Agent 能力基准。其评估维度直接对应 Skill 的核心质量指标：任务完成率、步骤效率、错误恢复能力。
- **ToolEval (Qin et al., 2023)** — ToolBench 配套的评估框架，提出 Pass Rate 和 Win Rate 两个核心指标。Pass Rate 衡量 Skill 调用链是否成功完成任务，Win Rate 通过 ChatGPT 对比评估衡量解决方案质量。这套评估体系已被多个后续工作采用。

*(...)*

---

### 技术方向 5：Skill 的语义发现与检索 — 规模化的前提

当 Skill 资产库膨胀到数百甚至数千个时，Planner 如何高效、准确地找到合适的 Skill？

关键技术与论文：

- **API-Bank (Li et al., 2023)** — 构建了包含 53 个 API 工具的基准，系统评估了 LLM 在 API 检索、调用和组合三个层面的能力。发现模型在 API 检索阶段的错误是下游调用失败的首要原因——这直接验证了原始报告中"Skill 描述质量是系统可靠性第一瓶颈"的判断。
- **ToolkenGPT (Hao et al., 2024)** — 将每个工具表示为一个特殊 Token（toolken），嵌入模型的词表中。模型在生成过程中可以像生成普通词一样"生成"工具调用。这种方案将 Skill 发现从检索问题转化为生成问题，在大规模工具场景下效率显著优于基于 Embedding 的检索方案。
- **AnyTool (Du et al., 2024)** — 提出层级化 API 检索策略，先定位 API 类别，再在类别内精确匹配。在 ToolBench 的 16,000+ API 上实现了显著的检索精度提升。其分层检索思想对 Skill 资产库的分类治理有直接指导意义。

---

### 技术方向 6：Skill 安全与对齐 — 被低估的关键维度

Skill 的安全性问题正在从学术讨论走向工程实践。当 Agent 被授权调用外部工具时，恶意 Skill 注入、权限越界、数据泄露等风险急剧放大。

关键论文：

- **ToolSword (Ye et al., 2024)** — 系统性地评估了 LLM Agent 在工具使用场景下的安全风险，定义了 6 类攻击场景（恶意工具注入、参数篡改、权限提升等）。测试发现即使是 GPT-4 也在多个场景下存在显著漏洞。这为 Skill 平台的安全审核门禁提供了威胁模型基线。
- **Adversarial Attacks on LLM Tool-use (Zhan et al., 2024)** — 研究了通过对抗性工具描述诱导模型选择恶意工具的攻击方式。发现仅修改工具描述中的几个词就能显著改变模型的工具选择行为。这对 Skill 注册审核流程提出了严格要求。

---

---

## 论文热度与影响力对比矩阵 (1/5)

| 论文 | 年份 | 引用量级 | 技术方向 | 工程落地度 | 推荐优先级 |
|------|------|---------|---------|-----------|-----------|
| ReAct | 2023 | ★★★★★ | 编排 | 已成为行业默认范式 | P0 必读 |
| Toolformer | 2023 | ★★★★★ | Tool-use | 概念奠基，直接落地有限 | P0 必读 |
| Gorilla | 2023 | ★★★★ | Tool-use | APIBench 已成标准评测 | P0 必读 |

---

## 论文热度与影响力对比矩阵 (2/5)

| 论文 | 年份 | 引用量级 | 技术方向 | 工程落地度 | 推荐优先级 |
|------|------|---------|---------|-----------|-----------|
| AutoGen | 2023 | ★★★★ | 多Agent | 微软主推，生态成熟 | P0 必读 |
| DSPy | 2023 | ★★★★ | 评估优化 | Skill 自动化优化的范式突破 | P0 必读 |
| ToolBench | 2023 | ★★★★ | Tool-use + 评估 | 最大规模工具基准 | P1 重点 |

---

## 论文热度与影响力对比矩阵 (3/5)

| 论文 | 年份 | 引用量级 | 技术方向 | 工程落地度 | 推荐优先级 |
|------|------|---------|---------|-----------|-----------|
| HuggingGPT | 2023 | ★★★★ | 编排 | 概念验证，工程化不足 | P1 重点 |
| LATS | 2024 | ★★★ | 编排 | 最强规划算法，计算成本高 | P1 重点 |
| MetaGPT | 2023 | ★★★★ | 多Agent | 软件工程场景直接可用 | P1 重点 |

---

## 论文热度与影响力对比矩阵 (4/5)

| 论文 | 年份 | 引用量级 | 技术方向 | 工程落地度 | 推荐优先级 |
|------|------|---------|---------|-----------|-----------|
| AgentBench | 2023 | ★★★ | 评估 | 最全面的 Agent 评测基准 | P1 重点 |
| LLM-as-Judge | 2023 | ★★★★ | 评估 | 自动化评估的理论基础 | P1 重点 |
| ToolkenGPT | 2024 | ★★★ | 语义发现 | 大规模场景下的突破性方案 | P2 关注 |

---

## 论文热度与影响力对比矩阵 (5/5)

| 论文 | 年份 | 引用量级 | 技术方向 | 工程落地度 | 推荐优先级 |
|------|------|---------|---------|-----------|-----------|
| AnyTool | 2024 | ★★ | 语义发现 | 分层检索思想有实践价值 | P2 关注 |
| ToolSword | 2024 | ★★ | 安全 | 威胁模型定义有参考价值 | P2 关注 |
| API-Bank | 2023 | ★★★ | 语义发现 | 验证了检索是第一瓶颈 | P2 关注 |

---

## 论文热度与影响力对比矩阵

---

---

## 技术演进路线图

```
2023 Q1          2023 Q2-Q3           2024              2025+
─────────────────────────────────────────────────────────────────
Toolformer        ReAct/HuggingGPT     LATS/ToolkenGPT    Skill OS
(模型学会用工具)   (Agent学会规划)       (搜索式规划+       (标准化Skill
                                        规模化发现)         运行时)
                  Gorilla/ToolBench    AnyTool/ToolSword
                  (大规模工具基准)      (治理与安全)        Skill Mesh
                                                          (分布式Skill
                  AutoGen/MetaGPT      DSPy 2.0            服务网格)
                  (多Agent协作)        (自

*(...)*

---

## 可行动建议

### 短期（0-3 个月）：建立技术认知基线

1. 组织团队精读 P0 级论文（ReAct、Toolformer、Gorilla、AutoGen、DSPy），建立 Skill 工程的共同语言
2. 基于 ToolBench/APIBench 搭建内部 Skill 评测管线，量化现有 Skill 的调用准确率和任务完成率
3. 引入 DSPy 框架试点，将 2-3 个高频 Skill 从手工 Prompt 迁移到可编程模块

---

### 中期（3-6 个月）：构建 Skill 工程基础设施

4. 建立 Skill 注册中心，参考 AnyTool 的分层分类思想设计 Skill 元数据 Schema
5. 实现基于 LLM-as-Judge 的 Skill 质量门禁，集成到 CI/CD 管线
6. 参考 ToolSword 的威胁模型，制定 Skill 安全审核清单

---

### 长期（6-12 个月）：迈向 Skill 平台化

7. 探索 LATS 等高级规划算法在关键业务场景的应用，提升复杂任务的 Skill 编排可靠性
8. 建设跨团队 Skill 资产市场，实现 Skill 的发现、复用和交易
9. 关注 ToolkenGPT 等新范式的成熟度，评估将 Skill 内化到模型词表的可行性

---

---

## 来源引用

1. Schick, T. et al. "Toolformer: Language Models Can Teach Themselves to Use Tools." NeurIPS 2023.
2. Patil, S. et al. "Gorilla: Large Language Model Connected with Massive APIs." arXiv:2305.15334, 2023.
3. Qin, Y. et al. "ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs." ICLR 2024.
4. Yao, S. et al. "ReAct: Synergizing Reasoning and Acting in Language Models." ICLR 2023.
5. Shen, Y. et al. "HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in Hugging Face." NeurIPS 2023.
6. Wang, L. et al.

*(...)*