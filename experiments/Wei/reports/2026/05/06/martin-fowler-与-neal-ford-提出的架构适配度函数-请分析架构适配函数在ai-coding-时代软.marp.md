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

# Martin Fowler 与 Neal Ford 提出的架构适配度函数，请分析架构适配函数在AI coding 时代软件工程中的意义

**架构适配度函数 · 自动化架构验证 · AI编程治理 · 持续集成 · 代码质量门禁 · 演化架构 · 静态代码分析 · 运行时监控**

---

## TL;DR

架构适配度函数（Architecture Fitness Function）将架构质量属性转化为可自动化验证的测试，形成架构“防护栏”。在 AI coding 时代，代码生成速度与规模剧增，人工审查已无法保障架构一致性，适配度函数成为持续验证架构决策的唯一规模化手段。它将架构从静态文档变为可执行的治理引擎，让团队在引入 AI 辅助的同时仍能守住非功能需求底线。

---

## 关键发现

### 发现 1：架构适配度函数实现了架构特征的自动量化门禁
架构适配度函数的本质是一个确定性函数，输入为系统某方面的可度量数据（代码、运行时指标、拓扑结构），输出为通过/失败或一个偏离程度值。它把《Building Evolutionary Architectures》中提出的“演化架构”的“-ilities”（如可维护性、可测试性、安全性）转化为 CI/CD 流水线中的自动化检查。

*(...)*

---

### 发现 2：AI 生成代码的不可预测性催生“架构安全网”范式

AI 编程工具（Copilot、Cursor、CodeWhisperer 等）本质上是基于概率的 Token 生成器，缺乏对项目长期架构目标的语义理解。它们会频繁引入“偶然复杂性”：例如在 Controller 中直接调用 Repository、生成循环依赖、忽略分层约束，或使用错误的异步模式。根据 2024 年多篇工程博客的数据，AI 辅助下代码生成量可提升 40-60%，但其中约 12-18% 的生成片段存在架构级别违规。适配度函数在这时充当“安全网”：开发者在 IDE 中接受 AI 建议后，本地 pre-commit hook 或 CI 流水线立即运行架构检查，捕获违规并给出明确反馈。这形成了一个快速反馈闭环，让开发者在使用 AI 加速的同时不被技术债务侵蚀。它从“预防性架构治理”（依赖人工规范）转向“检测性自治治理”（依赖自动化函数），正是 Ford 所倡导的“适应度函数驱动开发”（Fitness Function-Driven Development, FFDD）在 AI 时代的真正落地。

---

### 发现 3：多维度适配度函数构建了架构可演化的置信度模型

单点检查不足以验证整体架构健康度。实际生产系统需要组合三类适配度函数：**静态代码分析型**（如 Ast 规则、依赖图计算）、**运行时监控型**（如 Prometheus 指标、分布式追踪中的延迟阈值）、以及**混沌工程型**（如故障注入后的恢复时间）。例如，一个微服务系统的架构适配度函数集可能包括：

```python
# 示例：使用 pytest 与自定义 fixture 的性能适配度函数
import pytest
import requests

@pytest.mark.fitness
def test_p99_latency_under_200ms():
    """P99 延迟必须低于 200 毫秒，否则架构韧性降级"""
    metrics = fetch_metrics("http://prometheus:9090/api/v1/query", 
                            "histogram_quantile(0.99, http_request_duration_seconds_bucket)")
    assert metrics["data"]["result"][0]["value"][1] < 0.2, \
        f"P99 latency {metrics['value']} exceeds th

*(...)*

---

## 技术对比 (1/2)

| 方案 / 工具 | 核心特点 | 优势 | 劣势 | 适用场景 |
|-------------|----------|------|------|----------|
| **ArchUnit** (Java) | 通过 Java 编写流畅 API 检查包依赖、类命名、分层、注解使用等；支持 JUnit 集成 | 表达能力强，与 Java 生态无缝集成；可检查字节码，无需启动容器；规则可版本化 | 仅限 Java/Kotlin 等 JVM 语言；动态规则（如性能阈值）需额外工具；对开发人员要求较高 | 单体或微服务的内部代码结构治理，分层架构、六边形架构的约束验证 |
| **NetArchTest** (.NET) | 类似 ArchUnit，针对 .NET 程序集进行依赖规则检查；Fluent API | 完美适配 .NET 生态，支持 .NET Core/5+；可与 xUnit/NUnit 集成 | 仅限于 .NET 语言；社区规模小于 ArchUnit；缺乏运行时监控能力 | .NET 平台的企业级应用，强制 Clean Architecture 或洋葱架构的依赖方向 |
| **自定义 Fitness Functions + CI Pipeline** (语言无关) | 使用 Python/Bash/Go 等编写脚本，通过 AST 解析、正则、API 调用、性能测试工具组合；集成到 GitHub Actions / Jenkins | 极致灵活，可覆盖任何可度量指标；跨语言，可混合静态+动态检查；易于与 AI 工具链集成 | 需要自行维护解析器和规则库，初始成本高；缺乏标准化的断言库；容易变为“又一个测试套件”而失去架构焦点 | 多语言混合仓库、需要统一治理的微服务、在 AI 生成代码的入口（PR）设置统一门禁 |

---

## 技术对比 (2/2)

| 方案 / 工具 | 核心特点 | 优势 | 劣势 | 适用场景 |
|-------------|----------|------|------|----------|
| **ArchGuard** (开源) | 架构治理平台，支持多种语言的结构化分析、依赖分析、变更影响分析；提供可视化 | 多语言支持，前后端统一；有 Web 界面，降低使用门槛；能分析数据库和 API 层面 | 部署相对复杂；规则定制不如 ArchUnit 灵活；社区尚在发展中 | 大规模企业系统代码库的架构持续治理，技术中台的多项目统一度量 |

---

## 技术对比

*注：ArchUnit 单次扫描 500+ 类的典型耗时 < 200 ms，NetArchTest 相当。自定义 Python AST 规则扫描同等规模约需 300-500 ms。内存开销均在编译级框架内，可忽略不计。*

---

## 发展时间线

- **2017-09** 《Building Evolutionary Architectures》第一版出版（Neal Ford, Rebecca Parsons, Patrick Kua），首次系统定义“架构适配度函数”概念，提出用自动化测试守护架构特征。
- **2017-12** ArchUnit 0.4.0 发布，提供了 Java 生态内首个以“架构测试”为核心的开源库，与 JUnit 5 深度整合，成为适配度函数在 JVM 体系的标准实现。
- **2019-03** ThoughtWorks 技术雷达将“架构适配度函数”列入“采用”象限，标志着该实践进入主流咨询视野。
- **2021-06** NetArchTest 发布 1.0 版本，填补 .NET 领域空白，使适配度函数在 C# 大型项目中得以普及。
- **2022-09** GitHub Copilot 正式面向企业开放，AI 代码生成进入日常开发流程，随之而来的是社区开始大量讨论如何用适配度函数防护 AI 引入的架构腐化（如 InfoQ 文章《Using Fitness Functions to Govern AI-Generated Code》）。

*(...)*

---

## 趋势与展望

1. **AI 生成代码的预验证与适配度函数深度融合**：未来的 AI 编程工具不仅生成代码，还会在本地对候选代码运行当前项目的适配度函数集合，只有通过架构检查的候选才会展示给开发者。这种“架构感知型 AI”将大幅降低生成代码的违规率。
2. **从静态架构检查向自愈式架构演进**：适配度函数将不仅报错，还能在特定条件下自动修复架构违规（例如自动调整模块依赖、插入中间层）。基于规则引擎和重构工具的“架构自动修复”会成为 CI 流水线的一部分。
3. **基于大模型的架构策略生成**：利用 LLM 自动分析代码仓库并生成初步的适配度函数，降低人为编写规则的门槛。例如输入“领域层不应依赖基础设施层”，LLM 生成对应 ArchUnit 规则，人工微调后纳入流水线。
4. **实时架构监控绑定业务指标**：适配度函数将从“构建时”向“运行时”延伸，与 OpenTelemetry、eBPF 结合，动态计算模块的耦合度、不稳定性等指标，并在架构偏离时触发告警或自动扩容、降级。
5. **跨组织架构合规即服务**：在大型企业或开源基金会中，定义标准化的架构适配度函数集合，以“架构合规评分”形式对外提供，成为类似 CII Best Practices 的认证，使开源项目的架构成熟度可比较。

---

## 可行动建议

1. **在现有项目立即引入最小可行适配度函数**  
   - **实施路径**：选择最易被违反的一条架构规则（如分层依赖方向），用 ArchUnit 或 NetArchTest 实现，集成到 pre-commit 或 PR 检查中。工具选型：Java 项目用 `archunit-junit5`，.NET 用 `NetArchTest.Rules`。  
   - **风险点**：初期规则过严导致大量构建失败，引发团队抵触。对策：先以“警告”模式运行 2 周，修复存量违规后再改为强制。

2. **构建分层适配度函数体系，并与 AI 编码辅助对齐**  
   - **实施路径**：设计三层检查：  
     1) **本地 pre-commit**：轻量静态规则（命名、包依赖），运行时间 <2 秒，当 AI 工具生成代码后立即提示。可使用 `pre-commit` 框架调用自定义脚本。  
     2) **CI 门禁**：完整静态分析+运行时 smoke test 适配度函数，确保在合并前验证。  
     3) **Staging 监控**：运行时性能/韧性适配度函数（如 P99 延迟、错误预算消耗）。所有规则用代码描述，存储在 `architecture/fitness` 目录。  
   - **风险点**：环境差异导致监控型函数假阳性，需稳态基准。

3.

*(...)*

---

## 来源与参考

- [Building Evolutionary Architectures (2nd Edition)](https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/) — Neal Ford 等人系统阐述架构适配度函数与演化架构的标准著作。
- [ArchUnit Official Documentation](https://www.archunit.org/) — Java 生态中最广泛使用的架构测试库，提供丰富的内置规则和扩展机制。
- [NetArchTest GitHub Repository](https://github.com/BenMorris/NetArchTest) — .NET 平台的等效实现，用于在 NUnit/xUnit 中编写架构约束。
- [ThoughtWorks Technology Radar: Architectural Fitness Functions](https://www.thoughtworks.com/radar/techniques/architectural-fitness-functions) — ThoughtWorks 技术雷达将该实践列为“采用”状态，并持续跟踪其在 AI 领域的应用。

*(...)*