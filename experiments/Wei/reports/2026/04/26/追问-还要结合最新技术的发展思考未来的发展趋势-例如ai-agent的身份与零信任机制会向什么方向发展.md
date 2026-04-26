# AI Agent 时代的零信任演进：非人类身份、自适应信任与架构未来

## TL;DR

零信任架构正面临其诞生以来最深刻的范式挑战：安全主体正从"人类用户 + 已知服务"扩展到"自主决策的 AI Agent + 动态工具链"。传统零信任模型假设身份是相对静态、行为可预测的，但 AI Agent 具有自主性（Autonomy）、委托性（Delegation）和行为不确定性（Non-determinism）三大特征，这从根本上冲击了现有的身份建模、权限管理和持续验证机制。2025 年的核心趋势是：零信任正从"以人为中心的身份验证"演进为"以意图为中心的信任评估"，AI 既是零信任需要保护的新型主体，也是增强零信任决策能力的关键技术手段。这一双向融合将在未来 2-3 年重塑企业安全架构的基本形态。

---

## 关键发现

### 发现 1：AI Agent 引入了"第三类身份"——现有非人类身份（NHI）框架不足以覆盖

当前零信任体系中的身份分为两类：人类身份（Human Identity，通过 IdP 管理）和传统非人类身份（Non-Human Identity，如 Service Account、API Key、Bot Token）。AI Agent 的出现打破了这一二分法，它既不是被动执行指令的服务账户，也不是完全自主的人类用户，而是一种具有"受限自主性"的新型实体。

具体而言，AI Agent 身份的独特挑战体现在三个层面：

**委托链（Delegation Chain）的信任传递问题。** 当用户指示一个 AI Agent 完成任务时，Agent 可能调用多个外部工具、API 甚至其他 Agent（Multi-Agent Orchestration）。每一跳都涉及权限的委托传递。传统 OAuth 2.0 的 `on_behalf_of` 流程假设委托链是短且确定的，但 AI Agent 的工具调用链可能是动态生成的、运行时才确定的。例如，一个数据分析 Agent 可能在运行时决定调用 SQL 查询工具、文件系统访问工具和第三方 API，这些调用路径在设计时无法完全预见。

**行为不确定性导致的策略建模困难。** 传统服务的行为模式是确定性的——一个微服务的 API 调用模式可以被精确建模并写入 AuthorizationPolicy。但 AI Agent 的行为受 Prompt、上下文窗口和模型推理的影响，同一个 Agent 在不同输入下可能产生完全不同的资源访问模式。这使得基于静态规则的 Policy Engine 难以有效覆盖。

**身份生命周期的模糊性。** 一个 AI Agent 可能是短暂的（一次对话中临时创建）、长期运行的（后台自动化任务），或者介于两者之间（周期性触发的工作流）。其身份的创建、轮转、吊销机制需要比传统 Service Account 更灵活的生命周期管理。

业界的早期应对方案正在成形。Anthropic 在 2025 年提出的 Model Context Protocol（MCP）为 Agent 与外部工具的交互定义了标准化接口，其中隐含了身份与权限的传递语义。OpenAI 的 Function Calling 机制虽然解决了工具调用的格式问题，但尚未内建权限边界。SPIFFE（Secure Production Identity Framework For Everyone）社区正在讨论将 SPIFFE ID 扩展到 AI Agent 场景，为每个 Agent 实例签发短生命周期的 SVID（SPIFFE Verifiable Identity Document），使其可以被纳入现有的 Service Mesh 零信任体系。

> **关键判断：** 未来 12-18 个月内，主流云厂商和身份平台（Azure Entra ID、Okta、Auth0）将推出专门的 "AI Agent Identity" 身份类型，支持细粒度的委托权限声明和运行时行为约束。这将成为零信任架构的第三根身份支柱。

---

### 发现 2：从"静态最小权限"到"动态意图感知权限"——AI 驱动的自适应访问控制

零信任的核心原则之一是最小权限（Least Privilege），但在 AI Agent 场景下，"最小"的定义变得动态化。一个 Agent 在执行"帮我分析上季度销售数据"时需要只读访问数据库，但执行"帮我修复生产环境的配置错误"时需要写权限。权限需求由意图（Intent）驱动，而意图在运行时才明确。

这催生了"意图感知的自适应访问控制"（Intent-Aware Adaptive Access Control）这一新范式，其技术路径包括：

**Just-In-Time（JIT）权限提升与自动回收。** Agent 在执行特定任务时动态申请所需权限，任务完成后权限自动回收。HashiCorp Vault 的 Dynamic Secrets 机制已经为此提供了基础设施层支持——为每次 Agent 调用生成临时凭证，TTL 与任务预期时长绑定。2025 年的新趋势是将 JIT 与 AI 的 ReAct（Reasoning + Acting）循环集成：Agent 在每个 Action 步骤前向 Policy Engine 申请该步骤所需的最小权限集。

**基于 LLM 的策略推理引擎。** 传统 Policy Engine（如 OPA/Rego）依赖人工编写的声明式策略。新一代方案开始引入 LLM 作为策略推理的辅助层——不是让 LLM 直接做访问决策（这存在幻觉风险），而是让 LLM 将自然语言描述的安全意图翻译为形式化策略，并在策略冲突时提供解释性建议。Google 的 Chronicle Security Operations 和 Microsoft Security Copilot 已经在这个方向上做出了早期实践。

**持续行为验证的升级：从异常检测到意图偏离检测。** 传统 UEBA（User and Entity Behavior Analytics）检测的是"行为是否偏离历史基线"。对 AI Agent 而言，更有意义的检测维度是"行为是否偏离声明的意图"。例如，一个被授权"分析销售数据"的 Agent 如果开始访问 HR 数据库，即使其行为模式在统计上不算异常（因为 Agent 行为本身就多变），也应该被标记为意图偏离。这需要将 Agent 的初始 Prompt/Task Description 作为信任评估的上下文输入。

---

### 发现 3：AI 增强零信任决策——从规则驱动到风险量化驱动

AI 不仅是零信任需要管理的新型主体，也是增强零信任自身能力的关键技术。当前零信任落地的一个核心痛点是：策略爆炸（Policy Explosion）。随着微分段粒度的细化和身份类型的增加，手动维护策略规则变得不可持续。AI/ML 在以下三个方向上正在改变这一局面：

**自动化策略生成与优化。** 通过分析历史访问日志和网络流量，ML 模型可以自动推荐微分段策略和访问控制规则。Illumio 和 Zscaler 已经在其产品中集成了基于流量分析的策略推荐功能。更前沿的方向是使用 Graph Neural Network（GNN）对服务间调用关系建模，自动识别异常通信路径并生成阻断策略。

**实时风险评分（Risk Scoring）的精细化。** 零信任的持续验证依赖对每次访问请求的风险评估。传统方法使用规则引擎（如"来自新设备 + 异常地理位置 = 高风险"），但这种方法的覆盖面和精度有限。2024-2025 年的趋势是引入 Transformer-based 的序列模型，将用户/Agent 的访问行为建模为时间序列，实时计算每次请求的风险概率。CrowdStrike 的 Charlotte AI 和 Palo Alto Networks 的 Cortex XSIAM 是这一方向的代表性产品。

**安全运营的 Copilot 化。** 零信任架构的运营复杂度极高——策略调试、误报处理、事件响应都需要大量专业人力。AI Copilot 正在降低这一门槛：安全分析师可以用自然语言查询"过去 24 小时内哪些 Agent 的权限使用超出了其声明的任务范围"，由 AI 将其翻译为 SIEM 查询并汇总结果。Microsoft Security Copilot、Google Gemini in Security Operations 是当前的领先实践。

---

### 发现 4：Multi-Agent 系统的零信任治理——新的架构挑战

2025 年最值得关注的趋势之一是 Multi-Agent 系统（多个 AI Agent 协作完成复杂任务）的兴起。这对零信任架构提出了全新的治理挑战：

**Agent-to-Agent 通信的信任建立。** 当 Agent A 调用 Agent B 完成子任务时，B 如何验证 A 的身份和权限？如何确保 A 传递给 B 的上下文没有被篡改（Prompt Injection 防护）？这本质上是服务间 mTLS + 请求签名在 Agent 层的映射，但增加了"语义完整性"的新维度——不仅要验证请求的来源，还要验证请求的语义意图是否合法。

**权限的传递性约束（Transitive Permission Constraints）。** 如果用户授予 Agent A "读取财务报表"的权限，Agent A 委托 Agent B 执行具体查询，Agent B 是否自动继承该权限？如果 Agent B 又调用了 Agent C 呢？无约束的权限传递会导致"权限膨胀"（Privilege Escalation），这与零信任的最小权限原则直接冲突。解决方案的方向是引入"权限衰减"（Permission Attenuation）机制——每一跳委托都必须缩小（而非扩大）权限范围，类似于 Macaroons token 的 caveat 机制。

**可观测性与审计。** Multi-Agent 系统的调用链可能极其复杂，传统的分布式追踪（如 OpenTelemetry）需要扩展以支持 Agent 级别的 Trace，记录每个 Agent 的决策推理过程、工具调用和权限使用情况。这对事后审计和合规（如 SOC 2、GDPR 中的自动化决策解释权）至关重要。

---

## 技术对比：AI Agent 身份管理方案的演进路径

| 维度 | 传统 Service Account | OAuth 2.0 + Token Exchange | SPIFFE/SPIRE 扩展方案 | MCP + Agent Identity（新兴） |
|------|---------------------|---------------------------|----------------------|----------------------------|
| 身份粒度 | 服务级别（粗粒度） | 用户委托级别 | 工作负载实例级别 | Agent 实例 + 任务级别（细粒度） |
| 权限模型 | 静态 RBAC | Scope-based，半动态 | ABAC，基于身份属性 | 意图感知，动态 JIT |
| 委托链支持 | 不支持 | `on_behalf_of`，有限深度 | 联邦信任域，可扩展 | 原生多跳委托，权限衰减 |
| 行为验证 | 无 | Token 过期检查 | 证书轮转 + 身份验证 | 持续意图偏离检测 |
| 生命周期管理 | 手动创建/吊销 | Token TTL | 自动轮转 SVID | 任务绑定生命周期，自动回收 |
| 适用场景 | 传统微服务 | Web/Mobile 应用 | 云原生服务间通信 | AI Agent + Multi-Agent 系统 |
| 成熟度 | 成熟 | 成熟 | 生产可用 | 早期探索（2025-2026） |

---

## 未来 2-3 年演进路线判断

```
2025 H1-H2                    2026                         2027+
─────────────────────────────────────────────────────────────────────
[AI Agent 身份标准化]         [Multi-Agent 信任框架]        [自治安全架构]
                              
• SPIFFE Agent ID 扩展        • Agent-to-Agent mTLS        • 自愈式策略引擎
• MCP 安全规范 v1             • 权限衰减协议标准化          • 意图驱动的自动化治理
• 主流 IdP 支持 Agent 类型    • Agent 行为审计标准          • 人类仅做例外审批
                              
[AI 增强 ZT 决策]             [策略自动化]                  [认知安全]
                              
• LLM 辅助策略生成            • 自动化策略优化闭环          • 预测性信任评估
• 实时风险评分 ML 模型        • GNN 驱动的微分段            • 上下文感知的自适应架构
• Security Copilot 普及       • 策略即代码 + AI Review      • 安全意图编程
```

---

## 可行动建议

### 短期（0-6 个月）：建立 AI Agent 身份治理基础

1. **盘点现有非人类身份（NHI）资产。** 在现有零信任架构中，梳理所有 Service Account、API Key、Bot Token 的使用情况，建立 NHI 资产清单。这是未来扩展到 AI Agent 身份管理的基础。推荐工具：Astrix Security、Oasis Security（专注 NHI 治理的新兴厂商）。

2. **为 AI Agent 引入短生命周期凭证。** 立即停止为 AI Agent 使用长期有效的 API Key。改用 HashiCorp Vault Dynamic Secrets 或云厂商的临时凭证服务（AWS STS、GCP Workload Identity Federation），将凭证 TTL 与任务时长绑定。

3. **在 AI Agent 调用链中实施基本的权限边界。** 对于已经在使用 AI Agent（如 Copilot、自定义 LLM 应用）的场景，确保 Agent 的工具调用受到显式的权限白名单约束，而非依赖 Agent 自身的"判断"。

### 中期（6-18 个月）：构建意图感知的访问控制层

4. **试点 JIT 权限模型。** 选择一个非关键业务的 AI Agent 场景，实施 Just-In-Time 权限申请与自动回收机制。评估 HashiCorp Boundary 或 CyberArk Conjur 作为 JIT 基础设施。

5. **将 Agent 行为纳入 UEBA 监控。** 扩展现有 SIEM/UEBA 平台的监控范围，将 AI Agent 的 API 调用模式、数据访问模式纳入行为基线建模。重点关注意图偏离检测——Agent 的实际行为是否超出其声明的任务范围。

6. **评估 SPIFFE/SPIRE 在 Agent 场景的适用性。** 如果已经在使用 Service Mesh（Istio/Linkerd），评估将 SPIFFE ID 扩展到 AI Agent 工作负载的可行性，为 Agent 间通信建立 mTLS 信任基础。

### 长期（18-36 个月）：迈向自适应零信任架构

7. **建设 AI 驱动的策略自动化平台。** 投资建设或采购能够自动分析访问模式、推荐策略优化、检测策略冲突的平台。目标是将策略维护从"人工编写"转向"AI 推荐 + 人工审批"。

8. **参与 Agent 身份标准化进程。** 关注并参与 IETF、OpenID Foundation、CNCF 等组织在 AI Agent 身份标准化方面的工作，确保企业的技术选型与行业标准方向一致。

---

## 来源引用

1. NIST SP 800-207, "Zero Trust Architecture", 2020 — 零信任架构的权威参考框架，其中对非人类实体（Non-Person Entity）的身份管理已有初步讨论。
2. SPIFFE/SPIRE 项目文档 (spiffe.io) — 云原生工作负载身份标准，社区正在讨论 AI Agent 场景的扩展。
3. Anthropic, "Model Context Protocol (MCP) Specification", 2025 — 定义了 AI Agent 与外部工具交互的标准化协议，隐含身份与权限传递语义。
4. Google, "BeyondCorp Enterprise: Zero Trust for the AI Era", 2024 — Google 对零信任架构在 AI 工作负载场景下的扩展思考。
5. Gartner, "Predicts 2025: AI Will Reshape Identity and Access Management", 2024 — 预测到 2026 年，50% 的企业将需要专门的 AI Agent 身份治理策略。
6. CrowdStrike, "Charlotte AI: AI-Native Threat Detection", 2024 — AI 增强安全运营的代表性实践。
7. OWASP, "Top 10 for LLM Applications", 2025 — 涵盖 Prompt Injection、权限提升等 AI 应用安全风险，与 Agent 零信任直接相关。
8. Microsoft, "Security Copilot: AI-Powered Security Operations", 2024-2025 — AI Copilot 在安全运营中的落地实践。
9. Astrix Security / Oasis Security — 专注非人类身份（NHI）治理的新兴安全厂商，2024-2025 年获得显著市场关注。
10. Neil MacDonald & Charlie Winckless, Gartner, "Innovation Insight for Zero Trust in AI Agent Architectures", 2025 — 分析 AI Agent 对零信任架构的影响与应对策略。