# Spec: 交互式洞察工作台

- 状态：已锁定
- 作者：Wei
- 日期：2026-04-28
- 修订：2026-04-28（v2 — 优化信息来源策略和纲要内容深度）
- 关联：001-insight-agent.md（洞察 Agent 总 spec）、索引页已有"新建洞察"按钮

## 目标

将当前的"填表单 → 等待 → 看到报告"单向模式，重构成**交互式洞察工作台**：用户可以实时看到信息采集进度、参与提纲确认、以及在线修改最终报告。从"黑盒生成"变为"白盒协作"。

## 用户故事

- 作为团队成员，我在点击"新建洞察"后进入一个左右分栏的工作台页面，左侧输入课题，点击"开始洞察"，系统首先基于 LLM 自身知识进行初步思考和分析（不依赖外部数据源），生成初始分析快照，以便快速获得对该课题的系统性认知。
- 作为团队成员，在 LLM 初步分析完成后，系统提示"可添加更多信息源深化分析"，我可以在左侧粘贴论文 URL、博客链接、业界热点事件描述等，agent 抓取这些参考信息后融入分析，扩展洞察的深度和广度。
- 作为团队成员，我可以选择是否使用配置的数据源进行自动搜索——工作台提供"自动搜索信息源"按钮，点击后才触发对 `sources.json` 中已配置源的抓取。不点击则完全基于 LLM 知识 + 用户手动添加的参考信息生成报告。
- 作为团队成员，在文档列表加载完成后，系统生成一份洞察纲要（1-3 级标题结构），**每个章节附有关键观点和关键素材**（从已分析文档中提取），我在左侧可以编辑、增删条目、调整观点之后再点"确认生成"，以便控制报告的方向和深度。
- 作为团队成员，报告生成后显示在右侧预览区，我可以直接在页面上编辑 Markdown 文本或通过自然语言指令（如"把第二章提到第三章前面"、"补充一段关于工具对比的表"）交互修改报告。
- 作为团队成员，修改满意后点击"保存"，报告存档并出现在首页列表，同时支持导出为 HTML/PPT。

## 验收条件

- [ ] 点击"新建洞察"后，从当前页面的 modal 跳转到一个独立的洞察工作台页面（如 `/insight.html` 或单页 SPA 路由）
- [ ] 工作台为左右分栏布局：左侧（~40%）交互面板，右侧（~60%）预览面板
- [ ] 左侧面板包含：课题输入 → 领域/时间范围（可选）→ "开始洞察"按钮 → **LLM 初始思考区 → 自定义信息源添加区 → "自动搜索信息源"按钮（可选）** → 纲要交互区 → 修改交互区
- [ ] 点击"开始洞察"后，右侧首先显示 **LLM 基于自身知识的初步分析**（系统性认知快照），而非直接搜索外部源
- [ ] LLM 初步分析完成后，左侧显示"添加更多信息源"输入区：支持粘贴 URL（论文/博客/新闻等），系统自动抓取并分析；同时提供"自动搜索信息源"按钮，点击后才触发对配置源的搜索
- [ ] 所有信息源（LLM 知识 + 自定义 URL + 配置源搜索结果）汇总后，右侧逐步滚动显示文档列表和分析结果
- [ ] 纲要显示为可编辑的树状标题列表（1-3 级），**每个节点除标题外还包含：关键观点（keyPoints，1-3 条）和关键素材（materials，来源引用）**，每个条目右侧有 ⊢ 删除 / ✎ 编辑按钮，底部有 + 添加按钮
- [ ] 用户在纲要阶段可以：增删改条目、编辑关键观点和素材、确认生成 / 重新生成纲要
- [ ] 确认纲要后，LLM 按纲要逐节生成报告正文，右侧实时流式渲染（Markdown → HTML 增量渲染）
- [ ] 报告生成完成后，左侧切换为修改模式：支持自然语言指令输入（如"把第二章和第三章合并"），LLM 对报告进行局部修改
- [ ] 修改模式支持 Undo（保留每次修改前的快照，最多 5 步）
- [ ] 点击"保存"后，报告写入 reports/ 目录，HTML 化，出现在首页列表中
- [ ] 保存后的报告在首页点击后，仍可进入工作台继续修改（加载已有 markdown + 初始化修改历史）
- [ ] 信息采集阶段失败时，右侧显示部分结果 + 错误提示，不从零开始

## 不做什么

- 不做实时协作（多人同时编辑同一份报告）
- 不做 Websocket 长连接 — 用 SSE（Server-Sent Events）或轮询实现渐进更新
- 不改变 reports/ 存储目录结构
- 不改变现有 brief 生成逻辑
- 不做移动端适配（桌面优先）
- 不修改首页卡片布局 — 工作台是独立页面

## 设计要点 / 约束

- **不引入新 npm 依赖**：SSE 用原生 `http` 模块实现（`res.write` + `text/event-stream`）；Markdown 编辑用 `<textarea>` + 已有 `marked` 渲染
- **复用现有模块**：`fetcher.mjs`（信息采集）、`ranker.mjs`（排序）、`llm-provider.mjs`（LLM 调用）、`prompts.mjs`（prompt 模板，新增纲要和修改 prompt）、`storage.mjs`（报告存储）
- **流式输出**：LLM 生成阶段支持 streaming（DeepSeek/OpenAI 兼容协议已支持 `stream: true`），Markdown 增量渲染到右侧预览
- **纲要数据结构**：JSON 树，每个节点 `{ id, title, level, children?, keyPoints?: string[], materials?: string[] }`，持久化到中间产物。`keyPoints` 为该章节的核心观点（1-3 条），`materials` 为支撑该章节的关键素材/来源引用
- **修改历史**：内存中维护 `reportSnapshot[]` 数组，最多 5 个快照，不落盘

## 技术路线

### 后端新增（v2）

1. **`POST /api/insight/start`** — 接收 `{ topic, domain?, timeRange? }`，创建 session，**触发 LLM 初始思考（Stage 0）**，返回 `{ sessionId }`
2. **`GET /api/insight/stream?sessionId=`** — SSE 端点，推送流水线各阶段事件：
   - `event: progress` — `{ stage: "thinking"|"fetching"|"ranking"|"analyzing"|"outlining"|"generating", detail: "..." }`
   - `event: thinking` — `{ content: "LLM 初步分析 markdown" }`（新增，LLM 基于自身知识的初始分析）
   - `event: documents` — `{ items: [...] }`（分批，每批 10 条）
   - `event: outline` — `{ outline: [...] }`（LLM 生成的纲要树，每节点含 keyPoints 和 materials）
   - `event: content` — `{ chunk: "markdown delta" }`（流式正文）
   - `event: done` — `{ reportId, path, url }`
   - `event: error` — `{ message }`
3. **`POST /api/insight/add-source`** — `{ sessionId, url }`，抓取用户自定义 URL，分析后添加到 session.items，返回 `{ items: [...] }`（新增）
4. **`POST /api/insight/auto-search`** — `{ sessionId }`，触发对配置数据源的自动搜索，返回 `{ ok: true }`（新增，搜索过程通过 SSE 推送）
5. **`POST /api/insight/confirm-outline`** — `{ sessionId, outline }`，确认/修改后的纲要，触发正文生成
6. **`POST /api/insight/modify`** — `{ sessionId, instruction }`，LLM 局部修改报告，返回 `{ modifiedMarkdown, snapshotCount }`
7. **`POST /api/insight/save`** — `{ sessionId, title? }`，最终保存

### 前端新增（v2）

1. `insight.html` — 独立工作台页面，左右分栏布局
2. 左侧交互面板（按时间顺序显示）：
   - **输入区**：课题输入 + 领域/时间范围 + "开始洞察"按钮
   - **自定义信息源区**（LLM 初始分析完成后显示）：URL 输入框 + "添加"按钮 + 已添加列表
   - **自动搜索按钮区**："自动搜索信息源"按钮（可选触发）
   - **纲要编辑区**：每个节点含标题、关键观点（keyPoints）、关键素材（materials），可编辑
   - **修改指令区**：自然语言指令输入 + Undo + 保存
3. 右侧：实时预览区，分阶段显示 LLM 初始分析 → 文档列表 → 纲要预览 → 流式报告渲染
4. SSE 客户端：连接 `/api/insight/stream`，解析事件更新 UI，新增 `thinking` 事件处理

### 流水线阶段（v2）

```
LLM Initial Thinking (基于自身知识)
     ↓
  SSE:thinking (初始分析快照)
     ↓
[用户可选：添加自定义信息源 URL]  →  Fetch Custom Sources
     ↓                                          ↓
[用户可选：点击"自动搜索"]  →  Fetch Configured Sources
     ↓                                          ↓
  All Sources →  Rank & Filter  →  LLM Analyze (per-document摘要)
     ↓                  ↓                    ↓
  SSE:documents    SSE:progress       SSE:documents (enriched with摘要)
                                              ↓
                                    LLM Generate Outline (含每章 keyPoints + materials)
                                              ↓
                                        SSE:outline
                                              ↓
                                  [用户确认/编辑纲要（含观点和素材）]
                                              ↓
                                    LLM Generate Body (streaming)
                                              ↓
                                        SSE:content (chunked)
                                              ↓
                                  [用户交互修改报告]
                                              ↓
                                         Save → Done
```

## 开放问题

- 纲要的"逐节生成"是一节一个 LLM 请求还是一个大请求？→ 倾向一个大请求 + `stream: true`，LLM 自然会按标题分节输出
- 自然语言修改报告的效果依赖 LLM 理解能力，不保证完美。作为 V1 接受
- 工作台是否替换现有首页的"新建洞察"modal，还是作为新入口并存？→ 替换，modal 改为跳转到工作台

## 实现备忘（实现过程中追加）
