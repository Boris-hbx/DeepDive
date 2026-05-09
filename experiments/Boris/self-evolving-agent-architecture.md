# Self-Evolving Agent — 架构文档

> Boris · DeepDive Project · 2026-05-03
> 灵感来源：Live-SWE-agent 自进化思路

## 概述

Self-Evolving Agent 是一个能在解决问题过程中动态创建工具、选择工作流、自我对抗审查的 AI Agent。核心循环：**Select → Plan → Act → Reflect → Blue → Evolve**。

## 目录结构

```
experiments/Boris/agent/
├── loop.py              # 主循环：workflow → plan → act → reflect
├── reflect.py           # 反思模块：评估 + 工具生成 + workflow_fit
├── blue_agent.py        # 蓝军模块：对抗审查
├── tool_manager.py      # 工具注册/发现/执行/归档
├── prompts/             # LLM prompt 模板
│   ├── reflect.md       # 反思 prompt
│   ├── create_tool.md   # 工具生成 prompt
│   ├── blue_report.md   # 蓝军报告审查 prompt
│   └── blue_tool.md     # 蓝军工具审查 prompt
├── tools/               # 动态工具库
│   ├── registry.json    # 工具注册表
│   ├── fetch_hn.py      # 种子工具
│   ├── fetch_rss.py     # 种子工具
│   └── ...              # 自动生成的工具
├── workflows/           # 工作流模板
│   ├── deep-insight.yaml
│   └── compare-analysis.yaml
└── benchmark/           # 评估体系
    ├── metrics.py       # 运行指标采集
    ├── report_checker.py # 报告质量检查
    ├── tool_health.py   # 工具健康度分析
    └── metrics.jsonl    # 时间序列数据
```

## 分层架构

```
Layer 5 · USER PROJECT
  DeepDive → experiments/Boris/ → daily-report/ → _site/ (GitHub Pages)

Layer 4 · SELF-EVOLVING AGENT
  AgentLoop | Reflect | BlueAgent | ToolManager | Workflows | Benchmark

Layer 3 · DYNAMIC TOOL LIBRARY
  fetch_hn | fetch_rss | search-web | search-arxiv | filter-by-date | +3 more

Layer 2 · LLM SERVICE
  Claude Opus 4.6 | anthropic SDK | 7 种 LLM 调用模式

Layer 1 · EXTERNAL DATA SOURCES
  Hacker News | RSS Feeds | DuckDuckGo | arXiv | Google News
```

## 核心模块

### AgentLoop (loop.py)

主循环协调器，串联所有模块：

1. **Select** — LLM 从 YAML 模板中选择最匹配的 workflow
2. **Plan** — 在 workflow 框架内生成 JSON 执行计划 `{approach, steps[]}`
3. **Execute** — 逐步执行：有工具 → subprocess 调用，无工具 → LLM 直接执行
4. **Reflect** — 评估执行结果，判断是否需要新工具，评估 workflow 匹配度
5. **Blue (Tool)** — 蓝军审查工具创建决策（approve/block/revise）
6. **Evolve** — 生成工具脚本 → 语法校验 → 写入 tools/ → 注册
7. **Report** — 生成洞察报告 → 蓝军审查报告 → 追加反驳章节 → 采集 metrics

### Reflect (reflect.py)

反思模块，两个核心能力：

- `assess()` — 评估执行结果，输出 JSON：
  - `step_assessment`: 执行评价
  - `need_new_tool`: 是否需要新工具
  - `tool_spec`: 工具规格（如需要）
  - `workflow_fit`: good / poor / mismatch
  - `workflow_note`: workflow 不匹配时的建议
- `generate_tool()` — 根据 tool_spec 生成 Python 脚本，最多 3 次重试

### BlueAgent (blue_agent.py)

蓝军对抗审查模块，两个检查点：

**检查点 1：工具创建审查** `challenge_tool()`
- 输入：tool_spec + 现有工具列表 + 任务上下文
- 审查维度：功能重叠、复用概率、抽象粒度、命名职责
- 输出：`{verdict, overlap_with, reuse_estimate, reason, suggestion}`
- verdict = block 时跳过工具创建

**检查点 2：报告质量审查** `challenge_report()`
- 输入：报告全文 + 原始任务描述
- 审查角度：隐含假设、反例/边界条件、因果链可靠性、过度外推
- 输出：结构化挑战列表，追加到报告末尾作为蓝军反驳章节

### ToolManager (tool_manager.py)

工具生命周期管理：
- 注册：写入 registry.json
- 发现：扫描 tools/ 目录
- 执行：subprocess 调用，stdin/stdout/exit code
- 归档：旧版 → archive/{name}/v{N}_{date}.py

## Workflow 机制

### 工作流模板 (YAML)

每个 workflow 定义步骤序列和匹配关键词：

**deep-insight** — 多源采集 → 过滤 → 摘要 → 报告
- 匹配：洞察、调研、抓取、报告、brief、insight、research

**compare-analysis** — 采集 A/B → 结构化对比 → 综合结论
- 匹配：对比、比较、compare、vs、区别、差异

### 选择机制

AgentLoop 在 Plan 之前调用 LLM，输入任务描述 + 所有 workflow 的描述和关键词，输出最匹配的 workflow 名称。Plan 阶段在选定 workflow 的框架内生成具体步骤。

## Benchmark 评估体系

### RunMetrics (metrics.py)

每次运行自动采集并追加到 `metrics.jsonl`：
- task, workflow, date
- tokens (input/output)
- steps_executed, tools_used, new_tools
- blue_challenges, blue_blocks
- structure_ok, workflow_fit

### ReportChecker (report_checker.py)

报告结构合规检查：
- 标题格式 (`# Daily Brief — YYYY-MM-DD`)
- 引用块（一句话摘要 + 数据源统计）
- 来源链接（markdown 格式）
- 观察小结章节
- URL 有效性（HTTP HEAD 检查）

### ToolHealth (tool_health.py)

工具健康度分析：
- 复用率 = 被使用工具数 / 总工具数
- 零使用工具列表
- 高频工具 Top N
- 多版本工具追踪

## 7 种 LLM 调用模式

| 模式 | 用途 | max_tokens | prompt 模板 |
|------|------|-----------|-------------|
| Workflow Select | 选择 workflow | 50 | 内联 |
| Plan | 生成执行计划 | 1024 | 内联 |
| Execute (LLM) | 无工具时直接执行 | 4096 | 内联 |
| Reflect | 评估 + 工具需求 | 1024 | reflect.md |
| Generate Tool | 生成 Python 脚本 | 4096 | create_tool.md |
| Blue: Report | 报告蓝军审查 | 2048 | blue_report.md |
| Blue: Tool | 工具蓝军审查 | 1024 | blue_tool.md |

## 关键设计决策

- **独立脚本而非函数库**：进程隔离、语言无关、可独立测试、Unix 哲学
- **JSON registry 而非数据库**：人类可读、git 友好、无额外依赖、O(10) 规模
- **反思和执行分离**：执行关注"做什么"，反思关注"学到什么"，可独立调优
- **蓝军对抗而非自评**：独立 LLM 调用，防止 Agent 自我评估盲区

## 明确不做的事

- 不做工具沙箱/安全隔离
- 不做自动部署到 Web
- 不做 session 级详细日志
- 不做多 Agent 并行编排

## 运行方式

```bash
python -m agent "你的任务描述"
```

## 演进历史

- Phase 1：2 种子工具 (fetch_hn, fetch_rss)
- Phase 2：反思循环上线，自动生成 filter-by-date
- Phase 3：工具链扩展到 8 个，覆盖 HN/RSS/Web/新闻/arXiv/正文/过滤/批量摘要
- Phase 4：引入 Workflow 选择 + Blue Agent 对抗 + Benchmark 评估体系
