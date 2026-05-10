# Spec: 深度研究（Deep Research）— 三层任务分解 + 逐级确认

- 状态：设计中（v3）
- 作者：Wei
- 日期：2026-05-07（初版 v1），2026-05-07（修订 v2），2026-05-10（修订 v3）
- 关联：001-insight-agent.md、002-interactive-insight.md

## 目标

将深度研究从"单层线性搜索"重构为**三层任务分解 + 逐级确认 + 结构化输出**的协作式研究流程：

1. **Brainstorm**：对话式明确分析任务清单，允许调用搜索辅助，用户确认后进入分解
2. **任务分解**：L1（顶层任务）→ L2（子任务）→ L3（子子任务），最多 3 层
3. **逐级确认**：每一层分解完成后展示给用户，用户可逐项确认或一键"全部自动"
4. **逐任务执行**：按任务树顺序对每个叶子任务搜索→分析→产出结构化摘要
5. **结构化输出**：按任务树层级输出最终报告

## 用户故事

- 作为团队成员，我输入课题后进入 Brainstorm 对话，系统通过搜索辅助帮我逐步明确分析范围，最终产出一份我已确认的分析任务清单。
- 作为团队成员，系统将确认的任务清单分解为三层树状结构（L1→L2→L3），每一层展示给我确认：我可以逐项修改后确认，也可以一键"全部自动"跳过后续确认。
- 作为团队成员，系统按任务树顺序执行每个叶子任务：自动搜索相关内容 → LLM 分析 → 产出结构化摘要，在右侧实时展示。
- 作为团队成员，我可以在每个 L1 任务完成后查看中间结果，选择继续或调整方向。
- 作为团队成员，最终报告按任务树层级结构化呈现，每个任务节点都有对应的分析内容。

## 验收条件

### Brainstorm 阶段

- [ ] 深度研究模式下，Brainstorm 以"明确分析任务"为目标（而非泛泛分析课题）
- [ ] Brainstorm 每次 LLM 调用前执行轻量搜索（3 条，5s 超时），搜索结果注入 prompt 辅助范围明确
- [ ] Brainstorm 持续对话直到用户发送确认类指令（"确认"/"开始分解"/"没问题"）或点击"确认任务"按钮
- [ ] Brainstorm 结束时，LLM 输出已确认的**分析任务清单**（结构化 JSON），包含每个任务的标题和一句话描述
- [ ] 分析任务清单展示给用户，用户可编辑后确认

### 任务分解阶段（Plan）

- [ ] L1 分解：将确认的任务清单拆解为 3-5 个顶层任务，每个带标题和描述
- [ ] L1 展示给用户，每个任务旁有"确认"/"编辑"按钮，顶部有"全部确认，自动分解后续"开关
- [ ] 用户确认 L1 后，对每个 L1 任务拆解 L2 子任务（每个 L1 拆 2-4 个 L2）
- [ ] L2 确认机制同上——逐项确认或一键"全部自动"
- [ ] L3 分解同理（每个 L2 拆 2-3 个 L3），用户可选择在此停止（深度够用）或继续分解
- [ ] 分解完成后生成完整任务树，存储到 session

### 执行阶段

- [ ] 按任务树深度优先顺序执行每个叶子任务
- [ ] 每个叶子任务执行：搜索（1-2 个 query × 5 条结果）→ LLM 分析 → 产出 `{summary, keyFindings, sources}`
- [ ] 每个 L1 任务的所有子任务执行完后，LLM 对该 L1 做小结
- [ ] 执行过程通过 SSE 实时推送：当前任务、搜索结果、分析结果

### 综合输出阶段

- [ ] 按任务树层级生成结构化报告：一级标题=L1 任务，二级标题=L2 子任务，三级标题=L3 子子任务
- [ ] 每个叶子节点包含：关键发现、支撑来源
- [ ] 报告末尾包含"研究覆盖范围"章节，列出任务树全貌和每个任务的搜索覆盖情况
- [ ] 报告生成完成后支持对话修改

### 确认模式

- [ ] 默认：每一步分解后展示结果，等待用户确认
- [ ] 用户可随时切换为"全部自动"模式，跳过后续所有确认
- [ ] "全部自动"可在 L1/L2/L3 任一层级开启
- [ ] 前端展示当前确认模式状态（手动/自动）

## 不做什么

- **不做无限层级分解**：硬上限 3 层
- **不做 per-task 无限迭代**：每个叶子任务硬上限 2 轮 Reflect（与 v2 的全局 Reflect 不同——确认前置到分解阶段，per-task Reflect 只做微调补搜）
- **不做代码执行 / 沙箱工具调用**
- **不做多 Agent 编排**：单 LLM 实例完成全部阶段
- **不做研究历史回放**：中间产物存 session 内存，不落盘
- **不改变现有 Chat 模式**：深度研究是新增模式，默认关闭
- **不新增 npm 依赖**
- **不删除现有 v2 deepResearchPipeline**：v3 作为新函数 `deepResearchV3Pipeline` 实现，v2 保留不变，通过前端开关灰度

## 设计要点 / 约束

### 流程（v3）

```
用户勾选"深度研究" + 输入课题
    ↓
┌─ [Brainstorm] 对话式明确分析范围 ──────────────────────┐
│  - 每次对话注入轻量搜索结果（3 条，5s 超时）              │
│  - 目标：产出"分析任务清单"（结构化 JSON）               │
│  - 用户发送"确认"/"开始分解"触发结束                      │
│  - 展示任务清单给用户编辑确认                            │
└─────────────────────────────────────────────────────────┘
    ↓ 用户确认
┌─ [Plan L1] 拆解顶层任务（3-5 个）────────────────────────┐
│  - 展示 L1 任务列表                                      │
│  - 用户：逐项确认 / 编辑 / "全部自动"                     │
└─────────────────────────────────────────────────────────┘
    ↓ 用户确认（或自动）
┌─ [Plan L2] 每个 L1 拆解子任务（2-4 个/L1）───────────────┐
│  - 展示完整 L1→L2 树                                     │
│  - 用户：逐项确认 / 编辑 / "全部自动"                     │
└─────────────────────────────────────────────────────────┘
    ↓ 用户确认（或自动）
┌─ [Plan L3] 每个 L2 拆解子子任务（2-3 个/L2）─────────────┐
│  - 展示完整 L1→L2→L3 树                                  │
│  - 用户：逐项确认 / 编辑 / "全部自动" / "到此为止"        │
└─────────────────────────────────────────────────────────┘
    ↓ 用户确认
┌─ [Execute] 深度优先遍历任务树 ──────────────────────────┐
│  对每个叶子任务 执行 mini Reflect 循环（最多 2 轮）:      │
│    Round 1: 搜索(1-2 query × 5) → LLM 分析               │
│           → Reflect 评估缺口 → 生成补搜 query             │
│    Round 2: 补搜 → LLM 分析 → 合并结果                   │
│    产出: {summary, keyFindings, sources, rounds}         │
│  每个 L1 的所有子任务完成后 → LLM L1 小结                │
│  推送 SSE: task_start / task_search / task_analyze       │
│           / task_reflect / task_done / l1_summary        │
└─────────────────────────────────────────────────────────┘
    ↓
[Synthesize] 按任务树层级输出结构化报告 → Done → 对话修改
```

### 核心数据结构

```typescript
// 分析任务（Brainstorm 产出，用户确认后进入分解）
interface AnalysisTask {
  id: string;          // "t1", "t2", ...
  title: string;       // 任务标题
  description: string; // 一句话描述
}

// 任务树节点
interface TaskNode {
  id: string;              // "t1", "t1-1", "t1-1-1" ...
  title: string;
  description: string;
  level: 1 | 2 | 3;
  parentId: string | null;
  children: TaskNode[];
  // 执行时填充
  searchQueries?: string[];     // 初始搜索 query
  // 多轮 Reflect 结果
  researchRounds?: {
    round: number;
    searchResults: SearchItem[];
    analysis: string;           // 本轮分析
    gaps?: { reason: string; nextSearchQuery: string }[];
    sufficient: boolean;
  }[];
  // 最终产出
  summary?: string;             // 综合所有轮次的最终摘要
  keyFindings?: string[];       // 关键发现
  sources?: { title: string; url: string; relevance: string }[];
}

// 确认模式
type ConfirmMode = 'manual' | 'auto';

// Session 扩展
interface DeepResearchV3Session {
  mode: 'deep-v3';
  confirmMode: ConfirmMode;         // 当前确认模式
  analysisTasks: AnalysisTask[];    // Brainstorm 产出
  taskTree: TaskNode[];             // 完整任务树
  currentExecPath: string[];        // 当前执行路径（ID 列表）
  executeResults: Map<string, TaskNode>; // 执行结果
}
```

### SSE 事件类型（v3 新增/变更）

| 事件 | 数据 | 说明 |
|---|---|---|
| `brainstorm_tasklist` | `{ tasks: AnalysisTask[] }` | Brainstorm 产出任务清单 |
| `plan_l1` | `{ nodes: TaskNode[] }` | L1 分解完成，等待确认 |
| `plan_l2` | `{ tree: TaskNode[] }` | L2 分解完成，等待确认 |
| `plan_l3` | `{ tree: TaskNode[] }` | L3 分解完成，等待确认 |
| `task_start` | `{ nodeId, title, level, path }` | 开始执行某个任务 |
| `task_search` | `{ nodeId, round, results: SearchItem[] }` | 任务某轮搜索结果 |
| `task_analysis` | `{ nodeId, round, analysis }` | 任务某轮分析完成 |
| `task_reflect` | `{ nodeId, round, sufficient, gaps }` | 任务某轮 Reflect 评估 |
| `task_done` | `{ nodeId, result: TaskNode }` | 单个任务执行完毕（含所有轮次结果） |
| `l1_summary` | `{ nodeId, summary }` | L1 任务小结 |
| `content` | `{ chunk }` | 流式报告正文（同 v2） |
| `done` | `{ type:'report', reportId, markdown, usage }` | 报告完成 |

### 中间产物落盘

深度研究全流程每一步的中间产物均落盘到 `data/deep-research/{sessionId}/` 目录，确保：
- **可追溯**：出问题时能回溯每一步的输入输出
- **可恢复**：进程崩溃后可从断点继续
- **可审查**：研究过程全程有据可查

#### 目录结构

```
data/deep-research/{sessionId}/
├── meta.json              # session 元信息（topic, domain, 创建时间, 当前阶段）
├── 01-brainstorm.json     # Brainstorm 对话历史 + 最终任务清单
├── 02-task-tree.json      # 完整任务树（L1/L2/L3，含确认状态）
├── 03-execute/
│   ├── {nodeId}/
│   │   ├── round-1-search.json   # 搜索结果
│   │   ├── round-1-analysis.json # LLM 分析输出
│   │   ├── round-1-reflect.json  # Reflect 缺口评估
│   │   ├── round-2-search.json
│   │   ├── round-2-analysis.json
│   │   └── final.json            # 该叶子任务最终产出
│   └── l1-summary-{nodeId}.json  # 每个 L1 小结
├── 04-synthesize-prompt.json     # 综合阶段的 prompt（调试用）
└── 05-report.md                  # 最终报告 Markdown
```

#### 写入时机

| 事件 | 落盘内容 | 文件 |
|---|---|---|
| Brainstorm 结束 | 对话历史 + tasks[] | `01-brainstorm.json` |
| 每层 Plan 确认后 | 当前任务树快照 | `02-task-tree.json` |
| 每次搜索完成 | 搜索结果 | `03-execute/{nodeId}/round-N-search.json` |
| 每次 LLM 分析完成 | prompt + 分析输出 | `03-execute/{nodeId}/round-N-analysis.json` |
| 每次 Reflect 完成 | 缺口评估 | `03-execute/{nodeId}/round-N-reflect.json` |
| 叶子任务完成 | 最终产出 | `03-execute/{nodeId}/final.json` |
| L1 小结完成 | 小结内容 | `03-execute/l1-summary-{nodeId}.json` |
| 综合完成 | 最终报告 | `05-report.md` |

#### 约束

- 写入使用 `fs.writeFileSync`（同现有 logger 模式），try-catch 包裹，落盘失败不中断主流程
- `meta.json` 包含 `lastCheckpoint` 字段，记录最后完成的阶段+nodeId，用于断点恢复
- 深度研究 session 过期（1h TTL）时，落盘数据不自动清理，由用户手动管理
- 遵循 `CLAUDE.md` 规则：落盘到 `data/` 目录，不入 git（已在 `.gitignore` 中）

### Prompt 设计

| Prompt 函数 | 用途 | 新增/改写 |
|---|---|---|
| `getBrainstormTaskPrompt` | 以"产出分析任务清单"为目标的对话 prompt | **新增** |
| `getTaskDecomposePrompt` | 将任务分解为下一层子任务 | **新增** |
| `getTaskExecutePrompt` | 对单个叶子任务执行单轮搜索+分析 | **新增** |
| `getTaskReflectPrompt` | 对单个叶子任务评估信息缺口（per-task Reflect） | **新增** |
| `getL1SummaryPrompt` | 对 L1 任务做小结 | **新增** |
| `getStructuredReportPrompt` | 按任务树层级生成结构化报告 | **新增**（替代 `getDeepResearchBodyPrompt`） |

### 搜索策略变更

v2 是多轮全局搜索（每个子问题各搜一次，Reflect 后补搜），v3 改为：

- **Brainstorm 阶段**：每次对话轻量搜索（3 条，5s 超时），辅助范围明确
- **执行阶段**：每个叶子任务独立执行 mini Reflect 循环（最多 2 轮）
  - Round 1：搜索 1-2 个 query × 5 条 → LLM 分析 → Reflect 评估缺口
  - Round 2（有缺口时）：补搜 → LLM 分析 → 合并结果
  - 与 v2 全局 Reflect 的区别：确认前置到任务分解阶段，per-task Reflect 只做局部微调补搜，不做全局方向调整

### 成本估算

- Brainstorm：2-4 次 LLM + 每次 1 次轻量搜索
- L1 分解：1 次 LLM
- L2 分解：L1 数量 × 1 次 LLM（并行）
- L3 分解：L2 数量 × 1 次 LLM（并行）
- 执行：叶子任务数 × (每轮 1 次搜索 + 1 次 LLM 分析 + 1 次 LLM Reflect) × 最多 2 轮
- L1 小结：L1 数量 × 1 次 LLM
- 综合：1 次 LLM 流式生成

假设 4 L1 × 3 L2 × 2 L3 = 24 个叶子任务，每任务平均 1.5 轮，预估 LLM 调用 80-100 次。可控性提升对应成本增加——用户可通过减少叶子任务数（减少 L2/L3 分解度）来控制成本。

### 复用现有模块

| 模块 | 复用方式 |
|---|---|
| `search-provider.mjs` | 执行阶段每个叶子任务调用 `searchWeb()` |
| `llm-provider.mjs` | 全部 LLM 调用 |
| `session-manager.mjs` | 扩展 session 字段 |
| `markdown-to-html.mjs` | 报告保存时复用 |
| `storage.mjs` | `saveReport()` 复用 |
| `fetcher.mjs` | 可选 RSS 辅助（执行阶段与搜索并行） |

## API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/insight/deep-research` | v2 接口，保留不变 |
| POST | `/api/insight/deep-research-v3` | **新增** v3 接口，SSE 流式返回全流程 |
| POST | `/api/insight/deep-research-v3/confirm` | **新增** 用户确认/编辑任务树后提交 |
| POST | `/api/insight/chat` | Brainstorm 阶段复用（`_deepResearchV3: true` 标记走新 prompt） |

## 实现备忘

### 新增文件
- 无（在现有文件中新增函数）

### 修改文件
- `spec/003-deep-research.md` — 更新至 v3
- `lib/prompts.mjs` — 新增 5 个 prompt 函数
- `lib/pipeline/insight-pipeline.mjs` — 新增 `deepResearchV3Pipeline()` 函数
- `lib/pipeline/intent.mjs` — Brainstorm 阶段新增"确认任务"意图识别
- `lib/session-manager.mjs` — 新增 v3 session 字段
- `server.mjs` — 新增 `POST /api/insight/deep-research-v3` + confirm 路由
- `insight.html` — 新增确认 UI（任务树展示 + 逐项确认/全部自动 + 编辑能力）
