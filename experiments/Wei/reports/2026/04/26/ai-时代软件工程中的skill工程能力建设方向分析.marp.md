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

# AI 时代软件工程中的skill工程能力建设方向分析

**技能工程 · AI智能体 · 能力编排 · 大模型 · 提示工程 · 微服务 · 语义检索**

---

## TL;DR

Skill 工程正在从"提示词拼接"走向"模块化能力编排"，成为 AI Agent 时代软件工程的核心基础设施层。掌握 Skill 的定义、组合、评估与治理能力，将决定团队能否从"调用大模型"跃迁到"构建可靠 AI 原生系统"。当前行业处于 Skill 工程的标准化前夜，率先建立内部 Skill 资产体系的团队将获得显著的工程效率复利。

---

## 关键发现

### 发现 1：Skill 工程是 AI Agent 架构的"微服务化"拐点

在传统软件工程中，微服务将单体应用拆解为可独立部署的服务单元；在 AI 原生架构中，Skill 扮演着完全类似的角色——它是 Agent 可调用的最小能力原子。一个 Skill 通常包含四个要素：**意图声明（Intent Schema）**、**输入输出契约（I/O Contract）**、**执行逻辑（Runtime Logic）** 和 **上下文依赖描述（Context Dependency）**。

以 Microsoft Semantic Kernel 为例，一个 Skill 由多个 Function 组成，每个 Function 通过 `@kernel_function` 装饰器声明其语义描述、参数类型和返回值。Agent 的 Planner 根据用户意图，从 Skill 注册表中检索并编排合适的 Function 链。这与 Kubernetes 中 Service Mesh 的服务发现机制高度同构。

*(...)*

---

### 发现 2：Skill 的生命周期管理正在成为新的工程学科

Skill 不是写完就丢的 Prompt 片段，它需要完整的生命周期管理：**设计 → 实现 → 测试 → 注册 → 版本控制 → 监控 → 退役**。这与传统 API 生命周期管理几乎一一对应，但增加了 AI 特有的复杂性。

**测试层面**：Skill 的输出具有非确定性，传统的断言式测试（`assertEqual`）不再适用。业界正在探索三类测试范式——基于 LLM-as-Judge 的语义评估（如 DeepEval、Ragas）、基于统计分布的漂移检测、以及基于人类偏好的 RLHF 式评估。OpenAI 的 Evals 框架和 Anthropic 的 Model Eval 工具链代表了这一方向。

**版本控制层面**：Skill 的变更不仅包括代码逻辑变更，还包括 Prompt 模板变更、依赖模型版本变更、上下文窗口策略变更。PromptFlow、LangSmith 等平台开始提供 Skill 级别的版本追踪和 A/B 测试能力，但尚未形成行业统一标准。

**治理层面**：当多个团队共建 Skill 资产库时，命名冲突、能力重叠、权限控制等问题浮现。部分先行企业已开始设立"Skill 平台团队"，类似于传统的 API 平台团队，负责 Skill 的审核、分类和质量门禁。

---

### 发现 3：从 Prompt Engineering 到 Skill Engineering 的范式跃迁已经发生

Prompt Engineering 关注的是"如何让单次 LLM 调用产出更好的结果"，而 Skill Engineering 关注的是"如何将 AI 能力封装为可组合、可复用、可治理的工程资产"。这是一个从手工作坊到工业化生产的质变。

具体体现在三个维度的升级：

- **从单点调用到编排链路**：Skill Engineering 要求开发者思考 Skill 之间的依赖关系、数据流转、错误传播和回退策略。LangGraph 的状态机模型、CrewAI 的角色协作模型都是编排层的实践。
- **从自然语言到形式化契约**：OpenAI 的 Function Calling JSON Schema、Anthropic 的 Tool Use 规范、Google 的 Vertex AI Extensions 规范，都在推动 Skill 接口的形式化。这使得 Skill 可以被静态分析、自动化测试和类型检查。
- **从个人经验到组织资产**：优秀的 Prompt 往往存在于个人笔记中，而 Skill 通过标准化封装进入组织的能力资产库，可被发现、复用和持续优化。

---

## 技术对比 (1/2)

| 维度 | Microsoft Semantic Kernel | LangChain / LangGraph | OpenAI Function Calling + Assistants API | Anthropic Tool Use (MCP) | Google Vertex AI Extensions |
|------|--------------------------|----------------------|----------------------------------------|--------------------------|---------------------------|
| **核心特点** | 企业级 Skill 编排框架，强类型 Skill 定义，内置 Planner | 社区驱动的 Agent 工具链，Chain/Graph 双模型，生态最丰富 | 原生 Function Calling 能力，Assistants API 提供有状态 Agent | Model Context Protocol 开放标准，强调工具互操作性 | 云原生 Extensions 体系，与 Google Cloud 深度集成 |
| **Skill 定义方式** | `@kernel_function` 装饰器 + 语义描述 | `@tool` 装饰器 / Tool 类 / StructuredTool | JSON Schema 定义函数签名 | JSON Schema + MCP Server 协议 | OpenAPI Spec 扩展 |
| **编排能力** | 内置 Handlebars/Stepwise Planner | LangGraph 状态机，支持循环、条件、人机交互 | Assistants API 内置 Run Loop | 依赖外部编排层 | Vertex AI Agent Builder 可视化编排 |

---

## 技术对比 (2/2)

| 维度 | Microsoft Semantic Kernel | LangChain / LangGraph | OpenAI Function Calling + Assistants API | Anthropic Tool Use (MCP) | Google Vertex AI Extensions |
|------|--------------------------|----------------------|----------------------------------------|--------------------------|---------------------------|
| **优势** | C#/.NET 生态一等支持；企业级安全与合规；与 Azure 深度集成 | 生态最大，工具集最丰富；Python 优先；社区活跃迭代快 | 模型原生支持，延迟最低；无需额外框架依赖 | 开放协议，厂商中立；支持本地/远程 Skill 统一接入 | 与 BigQuery/Cloud Storage 等 GCP 服务无缝集成 |
| **劣势** | Python 支持相对滞后；社区规模较小；学习曲线陡 | 抽象层过多导致调试困难；版本间 Breaking Change 频繁 | 绑定 OpenAI 生态；编排能力有限；有状态管理较弱 | 生态尚在早期；工具链不够成熟 | 绑定 GCP；开源社区参与度低 |
| **适用场景** | .NET 企业级 Agent 系统；Azure 技术栈团队 | 快速原型验证；多模型切换需求；Python 技术栈 | 轻量级 Tool Use 场景；OpenAI 模型为主的应用 | 需要跨平台 Skill 互操作；构建开放 Skill 生态 | GCP 原生企业；需要与 Google 数据服务联动 |

---

## 发展时间线

- **2022-11** OpenAI 发布 ChatGPT，Prompt Engineering 概念爆发，开发者开始系统性地研究如何构造有效提示词，为 Skill 工程奠定认知基础。
- **2023-03** LangChain 发布 Agents 模块和 Tools 抽象，首次在开源社区中将"工具调用"标准化为 Agent 的核心能力单元，Skill 的工程化封装开始萌芽。
- **2023-06** OpenAI 发布 Function Calling 能力，模型原生支持结构化工具调用，JSON Schema 成为 Skill 接口定义的事实标准，标志着 Skill 从"Prompt Hack"走向"形式化契约"。
- **2023-07** Microsoft 开源 Semantic Kernel 1.0，明确提出 Skill/Plugin 概念体系，将 Skill 的注册、发现、编排作为框架一等公民，企业级 Skill 工程实践开始落地。
- **2023-11** OpenAI 发布 Assistants API 和 GPTs 平台，用户可通过配置方式创建具备特定 Skill 集合的 Agent，Skill 的"低代码化"组装成为可能。

*(...)*

---

## 趋势与展望

**1. MCP 协议将推动 Skill 互操作标准的统一**
当前各框架的 Skill 定义格式互不兼容，MCP 的出现类似于 REST 之于 Web API 的意义。预计未来 12-18 个月内，主流 Agent 框架将普遍支持 MCP 作为 Skill 的互操作层，Skill 的"Write Once, Run Anywhere"将逐步实现。

**2. Skill 评估体系将从"人工抽检"走向"自动化持续评估"**
随着 LLM-as-Judge 技术的成熟和评估基准（如 BFCL、ToolBench）的完善，Skill 的质量评估将嵌入 CI/CD 流水线。每次 Skill 变更都将自动触发语义正确性、安全性和性能回归测试，形成类似于代码覆盖率的"Skill 可靠性评分"。

**3. Skill 的粒度将出现"两极分化"**
一方面，原子级 Skill（如"查询天气""发送邮件"）将高度标准化并沉淀为基础设施；另一方面，领域级 Skill（如"执行财务审计流程""生成合规报告"）将承载越来越多的业务逻辑，成为企业核心竞争力。中间层的通用 Skill 将面临被模型内化（通过 Fine-tuning）或被平台吸收的压力。

**4.

*(...)*

---

## 可行动建议

**1. 建立内部 Skill 资产目录，从"散落的 Prompt"到"可管理的 Skill 库"**
立即盘点团队中已有的 AI 调用模式（Prompt 模板、Tool 定义、API 封装），按统一的 Schema（建议参考 MCP 或 OpenAI Function Calling 格式）重新封装为标准化 Skill。使用内部 Registry（可基于 Git Repo + 元数据索引）进行集中管理。第一步不求完美，先做到"可发现、可复用"。

**2. 在 CI/CD 中引入 Skill 质量门禁**
为每个 Skill 编写评估用例集（Eval Dataset），包含典型输入、期望输出和边界条件。集成 DeepEval 或 promptfoo 等评估框架，在 Skill 变更时自动运行评估并设置通过阈值。重点关注三个指标：意图匹配准确率、输出格式合规率、异常处理覆盖率。

**3. 培养"Skill Engineer"角色，投资团队能力转型**
Skill 工程横跨 Prompt 设计、API 设计、测试工程和平台工程，需要复合型人才。建议从现有的后端工程师或平台工程师中选拔，通过内部培训（重点学习 Semantic Kernel / LangGraph 框架、MCP 协议、Eval 方法论）培养专职 Skill Engineer。

*(...)*

---

## 来源与参考

- [Semantic Kernel Documentation](https://learn.microsoft.com/en-us/semantic-kernel/overview/) — Microsoft 官方 Skill/Plugin 架构设计文档，Skill 工程的企业级参考实现
- [LangChain Tools Documentation](https://python.langchain.com/docs/modules/tools/) — LangChain 工具定义与使用指南，社区最广泛采用的 Skill 封装方式
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling) — OpenAI 官方 Function Calling 文档，Skill 接口形式化的事实标准
- [Model Context Protocol Specification](https://modelcontextprotocol.io/) — Anthropic 主导的 MCP 开放协议规范，Skill 互操作性的关键标准
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph

*(...)*