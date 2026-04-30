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

# AI 时代软件工程中的skill工程能力建设方向分析-DS

**Skill工程化 · 多Agent协作 · 有状态编排 · 质量评估 · 工具调用 · RAG · 大模型应用**

---

## TL;DR

- AI 时代的软件工程正从“代码组件”的封装与复用转向“认知技能（Skill）”的工程化管理，一个 Skill 是推理、工具调用、记忆与知识检索的标准封装单元。
- Skill 编排与可组合性已成为核心工程挑战，以 DAG、状态机为代表的有状态多 Agent 协作模式正在取代单次 function calling，带来全新的架构复杂度。
- Skill 的评估、测试与持续交付体系严重滞后，缺乏类似传统 CI/CD 的自动化质量门禁，成为工程化落地中最薄弱的环节。

---

## 关键发现

### 发现 1：Skill 正从隐形逻辑转变为显性工程资产
传统软件工程将可复用单元定义为函数、类、服务，其接口由参数和返回值约束，内部逻辑完全由开发者编码。而在 AI 时代，大量业务逻辑并非由确定性代码实现，而是由大模型根据自然语言指令、检索增强生成（RAG）、工具调用（function calling）等动态组合完成。为此，“Skill” 作为一个新的工程抽象应运而生。一个 Skill 封装了完整的认知任务单元：包括系统 prompt（角色与约束）、工具列表（API 或数据源）、检索配置（向量库索引）、few-shot 示例乃至输出格式规范。例如，微软的 Semantic Kernel 将 Skill 定义为具有语义描述的可执行函数集合，并允许通过规划器（Planner）动态编排；OpenAI 的 GPTs 则将指令、知识文件、内置能力（代码解释器、联网等）打包为可发布的 Skill 单元。这种转变意味着 Skill 不再是藏在 prompt 里的隐形知识，而成为需要版本控制、自动化测试、依赖管理的一等公民工程资产，对软件团队的治理能力提出了全新要求。

---

### 发现 2：Skill 编排从线性链跃迁到有状态多 Agent 协奏

早期的 LLM 应用常采用线性 Chain：检索增强 → 生成答案 → 调用工具。进入 2024 年，Skill 编排迅速走向复杂的有状态图与多 Agent 协作。LangGraph 引入了可中断、可恢复的检查点机制，允许 Skill 图根据条件循环、分支，甚至暂停等待人工审批，跨越长时间运行的工作流。在数据科学场景中，典型的多 Skill 协作可以是：一个“数据分析师 Skill”生成 SQL 查询 → “代码审查 Skill”校验注入风险 → “调度 Skill”选择执行引擎并回写结果 → “可视化 Skill”输出图表。这些 Skills 之间通过共享状态和消息总线协同，状态管理（如共享黑板、向量记忆）成为基础设施。Autogen、CrewAI 等框架进一步引入了 Agent 角色分配、会话边界治理和子任务委托机制，将 Skill 编排提升为组织级别的“数字团队”设计问题，而非仅仅是 prompt chaining。

---

### 发现 3：Skill 评估与质量保障体系缺失，形成工程化最大短板

当业务核心逻辑沉淀为一组 Skills，其质量保障却远未达到传统软件的成熟度。目前社区的主要手段仍以人工抽检和离线基准为主，缺乏标准化的回归测试框架。Tool calling 的准确性、RAG 的召回率、幻觉控制、输出格式合规性等质量属性很难通过单次人工评估覆盖。虽然 promptfoo 等工具开始支持对 LLM 输出做单元测试级别的断言（如包含特定键、JSON 格式合法、毒性检测），但尚未集成到 CI/CD 流水线中形成事故阻断能力。更根本的困难在于 Skills 的非确定性：同样的输入可能产生不同但均合理的输出，传统断言失效，需要模型辅助评估（如 LLM-as-a-Judge）并辅以人工抽样。此外，Skill 版本管理、灰度发布、运行时监控（如 token 消耗、延迟分布、工具失败率）等可观测性能力也严重匮乏。在金融、医疗等强监管领域，这一缺失直接阻碍了 AI Skill 从实验走向生产。

---

## 技术对比 (1/2)

| 方案/框架 | 核心特点 | 优势 | 劣势 | 适用场景 |
|-----------|----------|------|------|-----------|
| **LangChain / LangGraph** | Python/JS 生态的 Skill 构建与编排框架；LangGraph 专为有状态多 Actor 图设计，支持检查点、分支和人工介入。 | 社区活跃、工具链丰富（文档加载、向量库、工具集成）；高度可控的图执行；可定制记忆/状态。 | 抽象层过多导致调试困难；版本迭代快，API 不稳定；对于简单任务显得过重。 | 需要精细编排的复杂 Agent 工作流，如多步骤数据分析、代码生成审查流水线。 |
| **OpenAI GPTs / Assistants API** | 低代码/无代码方式封装 Skill：指令、知识库、工具（Code Interpreter, File Search, Function Calling），托管执行。 | 构建门槛极低，快速原型；内置知识检索与代码执行，免运维；与 ChatGPT 生态打通，分发便利。 | 编排能力有限（单 Agent 线性为主）；黑盒运行，状态控制弱；供应商锁定，成本不可控。 | 面向业务人员或轻量自动化场景，如客服知识库、文档问答、内部工具助手。 |
| **Microsoft Semantic Kernel** | 企业级 AI Skill SDK（C#, Python, Java），以插件（Plugin）形式组织 Skill，包含 Planner 和连接器，深度集成 Azure 与 M365。 | 与微软生态（Teams, Copilot, Graph）无缝对接；强调安全与合规；支持多语言；长流程编排能力。 | 学习曲线陡峭；社区规模小于 LangChain；功能迭代偏保守；主要绑定 Azure 服务。 | 大型企业的内部智能体建设，需 Active Directory 鉴权、合规化数据访问和复杂业务流程自动化。 |

---

## 技术对比 (2/2)

| 方案/框架 | 核心特点 | 优势 | 劣势 | 适用场景 |
|-----------|----------|------|------|-----------|
| **Anthropic Tool Use / MCP** | 底层 tool use API + 标准化的 Model Context Protocol (MCP) 用于工具/资源/提示的发现与集成，不提供高层编排。 | 协议开源、标准化，鼓励第三方 Skill 服务器可插拔；模型本身 tool calling 精度高、安全取向。 | 目前仅 Claude 原生支持；编排需自行实现或借助其他框架；协议尚在早期，生态待丰富。 | 需要安全、可审计的工具调用，尤其是代码执行和高敏感数据操作；构建跨模型 Skill 生态系统。 |

---

## 发展时间线

- **2022-11** OpenAI 发布 ChatGPT，引爆大模型应用浪潮，用户开始通过精心构造的 system prompt 实现隐含“技能”。
- **2023-03** OpenAI 发布 Chat Completions API 与初版 function calling，使模型能够结构化调用外部工具，第一次将工具使用从 prompt 黑客变成工程特性。
- **2023-06** LangChain 快速崛起，提出了 Chain、Agent、Tool 的抽象，开源社区开始大规模尝试 Skill 化封装，同时 AutoGPT 等自主 Agent 项目爆发。
- **2023-11** OpenAI 推出 GPTs 与 Assistants API，内置 Code Interpreter、知识库检索和 function calling 的完整托管 Skill 单元，标志着 Skill 商业化的起点。
- **2024-01** 约 2024 年初，LangGraph 发布，引入有状态多 Actor 模型和检查点机制，使 Skill 编排从无状态链跨入可暂停、可恢复的复杂流程。
- **2024-05** Anthropic 正式推出 Tool Use 功能与配套的提示指南，凭借优异的指令遵循和拒绝风险能力，为高安全场景的 Skill 工程提供新选项。

*(...)*

---

## 趋势与展望

1. **Skill 接口标准化与互操作市场形成**  
   MCP 等开放协议的出现，以及 OpenAI、Google、Anthropic 各自 function calling 格式的逐渐收敛，正在推动一个可插拔 Skill 生态。未来 1-2 年，类似“Skill Store”的市场可能出现，开发者可以发布、复用、买卖经过评测的 Skill，大幅降低智能体开发门槛。

2. **从 Prompt as Code 到 Skill as Code 的全生命周期管理**  
   随着 Skills 成为核心业务资产，其版本管理、依赖锁定、CI/CD 流程会被强制要求。Skill 工程将融合 Infrastructure as Code 理念，出现专属的 Skill 注册中心、Skill Lint 工具、自动化回归测试套件和蓝绿部署机制，尤其是针对 RAG 索引更新和工具 schema 变更。

3. **确定性推理与 Skill 执行混合编排**  
   纯 LLM 驱动的 Skill 存在不确定性和高延迟。趋势是将传统确定性代码（如 SQL 执行、数值计算、规则引擎）与 AI Skill 混合编排在同一工作流中，以符号规则保证关键逻辑的可靠性和性能。这将催生同时支持符号计算和神经计算的新一代编排引擎。

4.

*(...)*

---

## 可行动建议

1. **建立团队 Skill 注册中心与版本策略**  
   立即启动内部 Skill 清单，明确 Skill 的 owner、工具依赖、权限声明和评估基准。采用仓库管理 Skill 定义（如 YAML/JSON 描述文件 + prompt 模板），纳入 Git 版本控制，禁止直接在生产修改 system prompt，实现 Skill 的可审计、可回滚。

2. **建设 Skill 自动化测试流水线**  
   对关键 Skill 编写基于断言 + LLM-as-a-Judge 的回归测试。使用 promptfoo 或自建测试框架，验证工具选择正确率、输出格式合规性、幻觉拒绝率和 PII 泄露控制。将测试集成到 CI 流水线，设置硬性质量门禁，尤其在进行 RAG 语料更新或 prompt 微调后必须跑全量测试。

3. **引入有状态编排能力，为复杂流程做准备**  
   尽早从无状态 Chain 向有状态图编排演进。选择 LangGraph 或类似框架，实现检查点恢复、分支与人工介入。对于数据科学场景，重点设计共享上下文状态（如中间表缓存、变量传递）和错误处理策略（如重试、降级为静态回答），确保长周期工作流的高鲁棒性。

4.

*(...)*

---

## 来源与参考

- [OpenAI Assistants API 文档](https://platform.openai.com/docs/assistants/overview) — 官方 Assistants API 功能说明，涵盖工具、文件检索和代码解释器。
- [LangGraph 概念与检查点指南](https://langchain-ai.github.io/langgraph/concepts/low_level/) — LangGraph 的有状态图、检查点与 Actor 模型详解。
- [Microsoft Semantic Kernel 文档](https://learn.microsoft.com/en-us/semantic-kernel/overview/) — 企业级 AI Skill SDK，插件化 Skill 与 Planner 编排说明。
- [Anthropic MCP 协议仓库](https://github.com/anthropics/anthropic-tools/tree/main/mcp) — 标准化 Model Context Protocol，用于工具/资源发现与安全调用。

*(...)*