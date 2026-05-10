# 自演进 Agent 进化方向：Benchmark、Workflow 与蓝军机制

> Boris 头脑风暴报告 — 2026-05-02
>
> 背景：Boris 的自演进 agent 已跑通 Phase 1-3（工具仓库 + 反思循环 + 自动工具生成），累计 8 个工具、13 次反思记录。现在需要设计评估体系和进化方向。

---

## 一、现状诊断

当前 agent 的循环是：**task → plan → execute → reflect → (create tool) → save report**

几个观察：

1. **只迭代 tools，不迭代 workflow**。反思模块（reflect.md）只问"要不要创建/改进工具"，不问"这个流程本身合不合理"
2. **没有质量评估**。agent 不知道自己产出的报告好不好，也不知道新创建的工具比旧的好在哪
3. **没有对抗机制**。所有判断都是 agent 自己做的，没有第三方视角挑战
4. **changelog 是流水账**。记录了"做了什么"，但没有"效果如何"

---

## 二、Benchmark / Metrics 设计

### 2.1 工具维度

| Metric | 定义 | 采集方式 | 目标 |
|--------|------|----------|------|
| 工具复用率 | usage_count > 1 的工具占比 | registry.json | > 60% |
| 工具存活率 | 创建 7 天后仍在使用的工具占比 | registry.json + changelog | > 50% |
| 首次成功率 | 工具创建后首次执行不报错的比例 | changelog（看是否紧跟 fix） | > 80% |
| 工具覆盖度 | 执行步骤中使用工具 vs LLM 直接推理的比例 | loop.py 日志 | 逐步提升 |

### 2.2 报告维度

| Metric | 定义 | 采集方式 | 目标 |
|--------|------|----------|------|
| 结构合规率 | 输出是否符合 daily-report 的 schema（有标题、有来源、有 URL） | 正则校验 | 100% |
| URL 有效率 | 报告中的 URL 能否访问 | HTTP HEAD 检查 | > 90% |
| 信息密度 | 入选条目数 / 扫描条目数 | 报告 stats 行 | 10%-30% |
| 蓝军通过率 | 蓝军挑战后仍站得住脚的观点占比 | 蓝军模块输出 | 跟踪趋势 |

### 2.3 效率维度

| Metric | 定义 | 采集方式 | 目标 |
|--------|------|----------|------|
| Token 消耗 | 单次任务总 token 数 | API response usage | 逐步降低 |
| 迭代轮数 | 完成任务所需的 plan-execute 轮数 | loop.py | 越少越好 |
| 端到端耗时 | 从任务输入到报告输出的时间 | 计时 | 跟踪趋势 |

### 实现建议

在 `agent/` 下新增 `metrics.py`，每次 `loop.py` 跑完后自动采集上述指标，追加到 `agent/metrics.jsonl`（一行一条 JSON）。这样就有了时间序列数据，可以看 agent 是在进步还是退步。

---

## 三、Workflow 迭代

当前只有一个 workflow：`plan → execute → reflect`。建议引入 2-3 个可迭代的 workflow 模板。

### Workflow 1：深度洞察（当前默认）

```
plan → fetch(tools) → filter → summarize(LLM) → reflect
```

适用于：daily brief、主题调研。当前已有，但可以优化的点：
- plan 阶段应该检查历史报告，避免重复覆盖相同主题
- summarize 阶段应该引用原文而非重新生成

### Workflow 2：对比分析

```
plan → fetch(A) → fetch(B) → compare(LLM) → synthesize → reflect
```

适用于：工具对比（Claude Code vs Cursor）、模型对比（GPT-5.5 vs Claude Mythos）、方案对比。这个 workflow 的关键是 compare 步骤要结构化输出（维度 × 选项矩阵）。

### Workflow 3：验证求证

```
claim → search evidence → check contradictions → verdict → reflect
```

适用于：验证某个说法是否成立（"Claude Code 真的会根据竞品关键词拒绝服务吗？"）。这个 workflow 天然需要蓝军思维。

### 如何迭代 workflow

在 `agent/workflows/` 下存放 workflow 模板（JSON 或 YAML），每个模板定义步骤序列和步骤间的数据流。reflect 模块不仅评估"要不要新工具"，还评估"这个 workflow 是否合适"——如果发现当前 workflow 不匹配任务类型，可以建议切换或创建新 workflow。

反思 prompt 扩展为：

```json
{
  "step_assessment": "...",
  "need_new_tool": false,
  "tool_spec": null,
  "workflow_assessment": "当前 workflow 是否匹配任务？",
  "suggest_workflow_change": false,
  "workflow_suggestion": "建议的 workflow 调整"
}
```

---

## 四、蓝军机制（Blue Agent）

这是最有意思的部分。蓝军不是简单的"找茬"，而是一个结构化的质量保障机制。

### 4.1 蓝军介入点

蓝军可以在三个阶段介入：

**A. 报告蓝军（已有雏形）**
- 时机：报告生成后、发布前
- 职责：挑战报告中的观点、检查逻辑链、指出过度外推
- 当前 daily-report skill 已有蓝军反驳章节，但自演进 agent 还没有

**B. 工具蓝军（新增）**
- 时机：reflect 决定创建新工具后、实际创建前
- 职责：质疑"真的需要这个工具吗？"
  - 是否和现有工具功能重叠？
  - 这个需求是一次性的还是真的会复用？
  - 工具的抽象粒度对不对？（太粗 = 不灵活，太细 = 碎片化）
- 价值：防止工具膨胀。当前 8 个工具里，`fetch-url-text` 使用次数为 0，`search-web-news` 和 `search-web` 功能高度重叠

**C. 计划蓝军（新增）**
- 时机：plan 生成后、execute 前
- 职责：质疑执行计划
  - 步骤是否遗漏了关键环节？
  - 数据源是否有偏？（只看 HN = 社区偏见）
  - 是否有更高效的路径？

### 4.2 实现方案

最简方案：在 `loop.py` 的关键节点插入一次额外的 LLM 调用，用不同的 system prompt（蓝军视角）。

```python
# 在 reflect 之后、create_tool 之前
if reflection["need_new_tool"]:
    blue_verdict = self.blue_agent.challenge_tool(
        tool_spec=reflection["tool_spec"],
        existing_tools=self.tm.list_tools(),
        task=task,
    )
    if not blue_verdict["approved"]:
        print(f"  [Blue] blocked: {blue_verdict['reason']}")
        # 不创建工具，记录蓝军否决
```

蓝军 prompt 的核心原则：
1. **必须引用具体事实**，不能空泛质疑
2. **必须给出替代方案**，不能只说"不行"
3. **有否决权但不滥用**——只在有实质理由时否决

### 4.3 蓝军输出格式

```json
{
  "target": "tool_creation | report_claim | plan_step",
  "original": "被挑战的具体内容",
  "challenge": "质疑理由（2-4 句）",
  "evidence": "支撑质疑的事实",
  "alternative": "替代方案",
  "verdict": "approve | block | revise",
  "confidence": 0.8
}
```

### 4.4 蓝军的自我约束

蓝军也需要被约束，否则会变成"什么都反对"的阻碍者：
- 蓝军否决率超过 50% 时，自动降低蓝军的否决权重
- 蓝军的否决必须附带替代方案，否则视为无效
- 跟踪"蓝军否决后的实际结果"——如果蓝军否决的工具后来被手动创建了，说明蓝军判断有误

---

## 五、综合演进路线图

### Phase 4（建议下一步）

1. **加 metrics.py**：自动采集工具复用率、报告结构合规率、token 消耗
2. **加报告蓝军**：在 _save_report 之后插入蓝军审查，输出追加到报告末尾
3. **扩展 reflect.md**：增加 workflow 评估维度

### Phase 5

4. **加工具蓝军**：在 _create_tool 之前插入蓝军审查
5. **加 workflow 模板**：实现对比分析和验证求证两个新 workflow
6. **metrics dashboard**：用 metrics.jsonl 生成简单的趋势图（可以是 HTML）

### Phase 6

7. **蓝军自进化**：蓝军的 prompt 也可以被反思和改进
8. **跨任务学习**：agent 能从历史任务的 metrics 中发现模式（"用 search-web 比 search-web-news 效果好"）
9. **工具淘汰机制**：usage_count 长期为 0 的工具自动标记为 deprecated

---

## 六、一句话总结

当前 agent 会"造工具"但不知道"造得好不好"。引入 metrics 让它有方向感，引入 workflow 让它有结构感，引入蓝军让它有自我纠错能力。三者结合，才是真正的自进化。
