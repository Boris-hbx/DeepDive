# Wilson 的实践笔记

> 边做边补，记关键决策、踩坑和修复方法。参考 Dong 的 NOTES.md 格式。
> 状态：Insight Agent 全流水线已跑通，server 运行中。

## 2026-05-10

### 功能：深度研究 v3 — 三层任务分解 + 逐级确认

- 做了什么：实现 spec/003-deep-research.md v3 的后端 pipeline + server 路由 + 前端 UI
- 为什么修改：v2 是单层线性搜索，v3 改为 Brainstorm → 任务树分解（L1/L2/L3）→ 逐级用户确认 → 逐叶子任务执行（mini Reflect）→ 结构化报告
- 改动范围：
  - `lib/pipeline/insight-pipeline.mjs`：新增 5 个导出函数：`deepResearchV3BrainstormTurn`、`deepResearchV3Plan`、`deepResearchV3PlanL2`、`deepResearchV3PlanL3`、`deepResearchV3Execute`、`deepResearchV3Synthesize`；新增 `persistV3`、`collectLeaves`、`findNode` 辅助函数；中间产物落盘到 `data/deep-research/{sessionId}/`
  - `server.mjs`：新增 3 个路由：`POST /api/insight/deep-research-v3/brainstorm`（SSE）、`POST /api/insight/deep-research-v3/plan`（SSE）、`POST /api/insight/deep-research-v3/confirm`（SSE，处理 L1/L2/L3 确认 + 执行 + 综合）
  - `insight.html`：新增"深度研究 v3"开关（与 v2 互斥）、v3 状态变量、任务树渲染函数、执行进度渲染、SSE 读取辅助函数 `readSSE`、v3 CSS 样式
- 关键判断点：
  - v3 pipeline 拆分为多个独立导出函数（而非单一大函数），原因：每个阶段需要等待用户确认，无法在一次 HTTP 请求内完成；confirm 路由根据 level 参数决定调用哪个阶段
  - 中间产物落盘用 `fs.writeFileSync` + try-catch，落盘失败不中断主流程（遵循 spec 约束）
  - v3 开关与 v2 开关互斥，避免状态混乱
- 风险和假设：v2 `deepResearchPipeline` 保留不变；v3 session 用 `createDeepResearchV3Session` 独立创建，不复用 v2 session
- 如何验证：启动 server → 访问 `/insight.html` → 勾选"深度研究 v3" → 输入课题 → 多轮 Brainstorm → 发送"确认" → 右侧出现任务清单 → 点击"开始任务分解" → 右侧出现 L1 任务树 + 确认按钮 → 逐级确认 → 执行阶段右侧显示进度 → 最终生成结构化报告

## 2026-04-29

### 功能：报告删除

- 做了什么：在首页 `index.html` 增加选择模式 + 删除功能，在 `server.mjs` 增加 `DELETE /api/reports` 端点
- 为什么修改：需要能清理旧报告，之前只能生成不能删除
- 关键判断点：确认对话框默认聚焦"取消"按钮，只有显式点击"确认删除"才执行，防止误操作
- 如何验证：启动 server，访问首页，点击"选择"→勾选报告→"删除选中"→确认→报告从列表消失且文件被清理

### 功能：邮件发送

- 做了什么：增加邮件发送功能，支持在管理台配置 SMTP 和收件人，在首页报告卡片上一键发送报告邮件
- 为什么修改：需要将生成的洞察报告通过邮件分发给团队成员
- 关键判断点：引入 nodemailer（标准 SMTP 库）；密码在 GET 返回时掩码，PUT 时 `***` 视为不变；发送测试邮件时若报告不存在也算 SMTP 配置有效
- 改动范围：
  - `package.json`：新增 `nodemailer` 依赖
  - `server.mjs`：新增 `GET/PUT /api/email-config`、`POST /api/send-email`
  - `admin.html`：新增"邮件配置"面板（SMTP 设置 + 收件人列表管理 + 测试发送）
  - `index.html`：每张报告卡片新增"发送报告"按钮，弹出模态框选择收件人
  - `config.json`：新增 `email` 字段存储 SMTP 和收件人配置
- 如何验证：配置 SMTP → 添加收件人 → 保存 → 首页卡片点击"发送报告" → 选择收件人 → 发送 → 检查收件箱
- 安全性改进：SMTP 用户名/密码从 config.json 移到环境变量（SMTP_USER/SMTP_PASS），写入 .env，GET API 只返回 hasUser/hasPass 掩码，不暴露明文

### 功能：每日 Brief 深度优化

- 做了什么：三方面改造 — 自然语言关注主题 + 双通道排序 + 新数据源类型
- 为什么修改：原有排序只看领域关键词匹配，无法表达复杂关注意图；信息来源局限于 RSS 和 HN
- 关键判断点：
  - 关注主题按领域（SE/CS）分别管理，自然语言配置，通过关键词 token 匹配计算 focusScore
  - 新增 globalScore 通道（纯热度+权威+时效，不做领域过滤）选出业界 TOP 新闻
  - 原有 domainScore 融入 focusScore（wFocus=0.10），再综合排序
  - X/WeChat 源复用 RSS 解析逻辑，通过 Nitter/RSSHub 桥接，无需新 API 依赖
- 改动范围：
  - `config.json`：新增 `focusTopics` 字段
  - `server.mjs`：GET/PUT schedule 支持 focusTopics
  - `admin.html`：定时任务面板新增 SE/CS 两区关注主题增删 UI
  - `lib/fetcher.mjs`：新增 `fetchX()`、`fetchWechat()`
  - `lib/ranker.mjs`：新增 `computeGlobalScore()`、`computeFocusScore()`，rankItems 支持双通道
  - `lib/pipeline/stages.mjs`：rankStage 传入 focusTopics，briefSummarizeStage 分离 globalTop + domainItems
  - `lib/pipeline/runner.mjs`：ctx 新增 focusTopics
  - `lib/brief-generator.mjs`：注入 focusTopics 到 pipeline
  - `lib/prompts.mjs`：重写 `getBriefPrompt`，三段式结构 + 关注主题注入

### Bug 修复

- 修复 insight 工作台两个 bug：
  1. 思考阶段右侧无内容：`setupSSE` 漏掉了 `thinking` 事件的实时转发，补上 `on`/`off` 监听
  2. 思考完成后左侧面板不切换、无法进入下一步：`initialThinking` 成功后只 emit 了 `stage: 'thinking'` 的 progress，没有 emit `stage: 'awaiting_sources'`，导致前端的 `switchPanel('sec-sources')` 永远不触发
- 修复：`insight-pipeline.mjs` 的 `initialThinking` 成功路径改为 emit `stage: 'awaiting_sources'` 的 progress

### 功能：Insight 工作台 Chat 化改造

- 做了什么：将 insight 工作台从固定步骤流（思考→搜索→分析→纲要→生成→修改）改为全程 Chat 交互模式
- 为什么修改：原有固定步骤无法在思考阶段补充背景，无法多轮 brainstorm，交互体验割裂
- 改动范围：
  - `insight.html`：完全重写左侧面板为 Chat UI（消息气泡、打字动画、自动高度 textarea），右侧预览区随对话阶段切换（分析文档 → 概要 → 报告正文）；前端用 `fetch` + `ReadableStream` 读 SSE（不用 EventSource，因为是 POST 请求）
  - `server.mjs`：新增 `POST /api/insight/chat` 路由，直接以 SSE 流响应，首次消息自动创建 session 并通过 `session` 事件返回 sessionId
  - `lib/pipeline/insight-pipeline.mjs`：新增 `chatPipeline(sessionId, message, domain, emit)` 函数，处理 4 种意图：brainstorm / generate_outline / modify_outline / generate_report
  - `lib/pipeline/intent.mjs`：新建，关键词匹配意图识别（无需额外 LLM 调用）
  - `lib/prompts.mjs`：新增 `getBrainstormUpdatePrompt`（输出 JSON `{analysis, reply}`）、`getOutlineFromChatPrompt`、`getOutlineModifyPrompt`
  - `lib/session-manager.mjs`：session 新增 `chatHistory: []`、`analysisDoc: ''` 字段，初始 `stage` 改为 `'init'`
- 风险和假设：旧 API（`/api/insight/start`、`/api/insight/stream` 等）保留不删，避免破坏现有调用；`generate_report` 在无真实抓取内容时用 `analysisDoc` 作为合成素材
- 如何验证：启动 server，访问 `/insight.html`，依次测试：发送主题 → 右侧出现分析文档 → 发"生成概要" → 右侧切换为概要 → 发修改指令 → 概要更新 → 发"生成报告" → 右侧流式出现报告正文 → 保存报告

## 2026-04-28

- 修复 PPT 模板持久化问题：清理 `loadTemplates()` 死代码和重复 fetch，添加错误日志
- 修复 PPT 下载不弹窗问题：`<a>` 元素需先 append 到 DOM 再 click()，否则浏览器可能阻止下载
- 修复 server MIME types 缺少 `.pptx` → 添加 `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- 关键判断点：`<a download>` 在 detached 状态下 click() 在部分浏览器（Firefox、新版 Chrome）不触发下载，必须 `document.body.appendChild(a)` → `a.click()` → `removeChild(a)`

## 技术栈

| 维度 | 选择 |
|---|---|
| 语言 | Node.js（ESM，.mjs） |
| LLM | Anthropic Claude（Sonnet 4.6 / Opus 4.7），可切换 |
| LLM SDK | `@anthropic-ai/sdk` |
| RSS 解析 | `rss-parser` |
| Markdown 渲染 | `marked` |
| 去重 | URL 精确匹配 + 标题 Jaccard 相似度（阈值 0.6） |
| HTTP 服务器 | Node.js 原生 `http` 模块 |
| 前端 | 纯 HTML/CSS/JS，无框架，CSS 变量 + 深色模式 |
| 定时任务 | `node-cron` |
| 触发方式 | 本地手跑 `node insight-cli.mjs` 或 server 定时 |

为什么这样选：
- 复用 DeepInsight explorations/阿伟/ 的现有实现，降低重写成本
- Node.js ESM 生态对 Anthropic SDK 支持最顺
- 不引入框架，保持轻量，便于团队理解和修改

## 领域范围

覆盖两大领域（2026-04-26 确定）：

| 领域 | 信息源（各 5 个） |
|---|---|
| 软件工程 | Anthropic Blog、OpenAI Blog、Google AI Blog、Simon Willison、HN（AI/agent 关键词） |
| 网络安全 | Krebs on Security、The Hacker News、Schneier on Security、CISA Alerts、HN（CVE/漏洞关键词） |

## 系统架构

```
用户输入课题
    ↓
report-generator.mjs — LLM 自动判断领域（未指定时）
    ↓
fetcher.mjs — 并行抓取 sources.json 中对应领域的源
    ↓
dedup.mjs — URL 去重 + Jaccard 标题去重
    ↓
LLM 筛选 + 结构化分析（TL;DR / 对比表 / 时间线 / 引用）
    ↓
markdown-to-html.mjs — 生成 Markdown + 自包含 HTML
    ↓
storage.mjs — 归档到 reports/YYYY/MM/DD/ + 更新 index.json
```

每日 brief 流水线：
```
定时触发 / node insight-cli.mjs --brief
    ↓
brief-generator.mjs — fetcher → dedup → LLM 筛选
    ↓
生成 brief.md + brief.html（最关注 ≤3 + 值得一看 ≤5）
    ↓
归档到 briefs/YYYY/MM/DD/
```

交互式追问：
```
用户在报告页点"追问"
    ↓
POST /api/follow-up { parentReportId, question }
    ↓
读取父报告 meta.json 中的 conversationHistory（最多 5 轮）
    ↓
超过 5 轮时自动摘要前文作为上下文
    ↓
生成追问报告，parentReportId 关联原始报告
```

## 关键设计决策

### 复用 DeepInsight 代码而非重写

从 DeepInsight explorations/阿伟/ 复制并适配了 7 个模块：
- `llm-provider.mjs`（90% 复用）：LLM 抽象层，支持切换 backend
- `storage.mjs`（80% 复用）：加了 domain 字段和 brief 存储支持
- `feedback.mjs`（95% 复用）：反馈 + Skill 沉淀，几乎原样
- `markdown-to-html.mjs`（85% 复用）：改了品牌名，加了追问入口按钮
- `report-generator.mjs`（70% 复用）：加了 domain 参数和 follow-up 逻辑
- `prompts.mjs`（60% 复用）：大量扩展，加了 brief/follow-up/领域分类 prompt
- `server.mjs`（70% 复用）：加了 /api/brief、/api/follow-up 路由

新写的模块只有三个：`fetcher.mjs`、`dedup.mjs`、`brief-generator.mjs`。

### URL 不让 LLM 写（防幻觉）

和 Dong 的方案一致：fetch 阶段透传 URL，LLM 的 output schema 不含 URL 字段，render 阶段从结构化字段直接拼链接。

### 领域自动分类

用户不指定 domain 时，LLM 自动判断课题归属（软件工程 / 网络安全）。跨领域课题（如"AI 在安全运营中的应用"）打双标签。

## 踩坑记录

### 1. .bashrc 语法错误导致所有 Bash 命令报警告

**现象**：每次执行 Bash 命令都出现：
```
/c/Users/hexiaoqing2/.bashrc: line 1: syntax error near unexpected token `"ANTHROPIC_BASE_URL",'
```

**根因**：`.bashrc` 第一行是 Windows PowerShell 语法（`[Environment]::SetEnvironmentVariable(...)`），被 bash 解析时报错。

**修复**：警告不影响命令执行结果，可忽略。根本修复需要把 `.bashrc` 里的 PowerShell 语法改成 bash 语法（`export ANTHROPIC_BASE_URL=...`），但不在本次任务范围内。

**教训**：Windows 环境下混用 PowerShell 和 bash 设置环境变量容易出现这类问题，建议统一用 `.env` 文件管理项目级变量。

### 2. 初次写 spec 时 AI 自作主张限定了 MVP 范围

**现象**：第一次生成 spec 时，AI 把目标收敛到"每日 brief MVP"，丢掉了 DeepInsight 001+002 的完整能力（课题综述、反馈闭环、Skill 沉淀等）。

**根因**：AI 看到 DeepDive 的 MVP 定位后自行做了范围收缩，没有按用户意图综合两份参考 spec。

**修复**：用户明确指示"取消 MVP 限制，继承 001+002 全部能力"，AI 重新生成了完整 spec。

**教训**：给 AI 的指令要明确说"不要收敛范围"，否则 AI 倾向于保守地缩小 scope。

### 3. spec 开放问题未清空就进入开发计划

**现象**：spec 里有 9 条开放问题（`? **xxx**`），AI 按 CLAUDE.md 规则停下来逐一确认，花了额外时间。

**处理**：通过两轮问答确认了所有决策（去重算法、HN 抓取方式、定时触发、追问深度、领域分类等），然后把开放问题更新为已确认状态（`~~xxx~~`）。

**教训**：spec 写完后应该先把开放问题讨论清楚再交给 AI 实现，避免实现中途被打断。

### 4. 文件写入截断（TRUNCATED）

**现象**：写大文件时出现：
```
⚠️ [FATAL] TRUNCATED - Tool call FAILED!
The stream ended before the tool call completed.
REQUIRED: Retry with smaller content. For Write/Edit, split into chunks of ≤50 lines.
```

**修复**：改为分块写入——先用 Write 创建文件骨架（HTML head + CSS），再用 Update/Append 逐步追加内容，每次控制在 50-200 行。

**教训**：大文件（尤其是 HTML）必须分块写入，不要一次性写超过 200 行。

### 5. server.mjs 端口冲突

**现象**：启动 server 时报 `EADDRINUSE: address already in use :::3457`。

**根因**：之前的 server 进程没有正常退出，端口被占用。

**修复**：
```bash
# 找到占用端口的进程
netstat -ano | findstr :3457
# 杀掉进程
taskkill /PID <pid> /F
# 重新启动
node server.mjs
```

**教训**：Windows 下进程不会随终端关闭自动退出，开发时要养成手动停止 server 的习惯。

### 6. dedup.mjs 测试文件未追踪

**现象**：`git status` 显示 `experiments/Wei/lib/dedup.test.mjs` 为未追踪文件（`??`）。

**状态**：测试文件已写好但尚未提交，待确认测试通过后一并提交。

## 开放问题（待讨论）

- ? **中文编码**：Windows 环境下 JSON 文件中文存储需注意 UTF-8 编码，目前用 `JSON.stringify(..., null, 2)` + `fs.writeFile(..., 'utf8')` 处理，实测正常，但需要在 README 里显式说明。
- ? **Worklog 目录**：`experiments/Wei/Worklog/` 目录已存在，是否需要和 wilson-notes.md 合并或保持分离？

## 如果再来一次

### 该改的

1. **spec 开放问题先讨论完再开发**——9 条开放问题在开发计划阶段才逐一确认，打断了节奏。下次 spec 写完后立即开一个"决策会"把所有问题过一遍。

2. **大文件分块写入要从第一次就做**——第一次写 HTML 就截断了，浪费了一次重试。规则：超过 100 行的文件，直接用骨架 + 追加模式。

3. **Windows 环境变量统一用 .env**——`.bashrc` 里混入 PowerShell 语法导致每次 bash 命令都有警告噪声。项目级变量全部放 `.env`，不要动 shell 配置文件。

### 该坚持的

4. **复用优先于重写**——从 DeepInsight 复用 7 个模块，节省了大量时间，只需要新写 3 个模块。下次遇到类似项目，先花 30 分钟探索可复用代码，再决定写什么。

5. **spec-first 流程**——8 次决策点（领域范围、去重算法、追问深度等）都是先列选项再确认，没有 AI 自说自话走偏。代价是多几次来回，但每次都是正确决策。

6. **LLM 只做评分和摘要，其他全是规则**——URL 透传、领域分类阈值、brief 结构都用规则控制，LLM 只负责"理解内容"这一件事。这是最重要的工程判断。

## 跑步指南（自用）

```bash
# 安装依赖
cd experiments/Wei && npm install

# 配置 LLM 凭证
cp .env.example .env
# 编辑 .env 填 ANTHROPIC_API_KEY

# 生成课题综述
node insight-cli.mjs --topic "AI Code Agent 架构演进"
node insight-cli.mjs --topic "零信任架构落地" --domain cybersecurity

# 生成每日 brief（双领域）
node insight-cli.mjs --brief
node insight-cli.mjs --brief --domain software-engineering

# 启动 HTTP 服务器（含定时任务）
node server.mjs
# 然后打开 http://localhost:3457

# 运行去重模块测试
node lib/dedup.test.mjs
```

环境变量：

| 变量 | 说明 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_BASE_URL` | 可选，走代理时填代理 URL |
| `LLM_MODEL` | 可选，默认 claude-sonnet-4-6 |

## 2026-04-28

- **实现交互式洞察工作台**（spec 002）：将"填表单→等待→看报告"单向模式重构为左右分栏交互式工作台，支持实时文档搜索、纲要编辑、流式报告生成、自然语言修改、Undo 和历史报告继续编辑
- 为什么：用户需要看到信息采集过程、参与纲要决策、在线修改报告，从"黑盒生成"变为"白盒协作"
- 风险和假设：
  - 文档分析阶段的 LLM 批量摘要解析可能不稳定（JSON 解析失败时静默跳过），后续可优化 prompt
  - Claude 协议暂不支持真 streaming，fallback 为一次性 generate 后一次性 yield
  - hnrss.org 间歇不可用影响 HN 热度信号，已加 Firebase API fallback
- 关键判断点：
  - SSE vs WebSocket：选 SSE，原生 http 模块支持，不引入新依赖
  - 纲要逐节生成 vs 一个大请求：选一个大请求 + stream:true，LLM 自然按标题分节
  - 文档分析批处理：5 篇一个 batch，减少 LLM 调用次数
  - 修改历史：内存快照数组（最多 5 个），不落盘
- 新增文件：
  - `lib/session-manager.mjs` — 会话状态机（EventEmitter + 1h TTL 回收）
  - `lib/pipeline/insight-pipeline.mjs` — 7 阶段洞察流水线
  - `insight.html` — 左右分栏工作台页面
- 修改文件：
  - `lib/llm-provider.mjs` — 新增 `generateStream()` 异步生成器
  - `lib/prompts.mjs` — 新增 4 个 prompt（文档分析、纲要生成、正文生成、修改）
  - `server.mjs` — 新增 6 个 API 路由 + SSE 辅助函数
  - `index.html` — "新建洞察"按钮改为跳转 `/insight.html`
- 验证：启动 server 后 SSE 流推送完整流水线（88 条文档获取→排序→分析→纲要），各阶段事件正常发送，前端正确渲染文档列表

## 2026-05-05

### 功能：深度研究（增强现有洞察流水线）

- 做了什么：在 insight.html 工作台中增加"深度研究"模式——勾选后课题会经过 Plan→Search→Analyze→Reflect 多轮迭代循环，最终综合生成深度报告
- 为什么修改：现有洞察是单次线性 RSS 抓取+分析，无法主动搜索互联网，也无法迭代深入
- 关键判断点：
  - **增强而非重建**：不复刻 LangGraph/DeerFlow 的多 agent 架构，而是在现有 insight-pipeline.mjs 中新增 `deepResearchPipeline` 函数，复用 fetcher、ranker、analyzeDocuments、bodyGeneration 等已有能力
  - **Web 搜索后端选 Tavily**：专为 AI agent 设计，API 简单，`fetch()` 调用无需新 npm 依赖；同时保留 DuckDuckGo 免费 fallback
  - **轮次上限 3**：控制成本和延迟，Reflect 阶段 LLM 评估信息缺口，有缺口才补搜
  - **SSE 流式推送**：与现有 Chat API 模式一致，前端用 `fetch` + `ReadableStream` 读 SSE，事件类型新增 plan/search_results/reflect
  - **UI 不破坏现有行为**：深度研究是 checkbox 开关（默认不勾选=现有 brainstorm 模式），勾选后才走新接口
- 改动范围：
  - `lib/search-provider.mjs`：新建，Tavily API + DuckDuckGo fallback，返回标准化 `[{title, url, snippet, source}]`
  - `lib/prompts.mjs`：新增 3 个 prompt（`getDeepResearchPlanPrompt`、`getReflectPrompt`、`getSearchQueryPrompt`）
  - `lib/session-manager.mjs`：session 新增 `subQuestions`、`researchRounds`、`mode` 字段
  - `lib/pipeline/insight-pipeline.mjs`：新增 `deepResearchPipeline(sessionId, domain, emit)`，5 阶段 Plan→循环(Search→Analyze→Reflect)→Synthesize
  - `server.mjs`：新增 `POST /api/insight/deep-research` SSE 路由
  - `insight.html`：新增深度研究 checkbox + CSS + `sendDeepResearch()` SSE 处理函数
  - `.env.example`：新增 `SEARCH_PROVIDER`、`TAVILY_API_KEY`
- 风险和假设：
  - Tavily API key 需要在 .env 中配置，未配置时自动 fallback 到 DuckDuckGo（效果差一些但可用）
  - 深度研究单次消耗 10-30 次 LLM 调用，成本显著高于普通 brainstorm
  - Reflect 阶段的 JSON 解析可能不稳定，失败时默认 `overallSufficient=true` 提前结束
- 如何验证：启动 server → 打开 insight.html → 勾选"深度研究" → 输入课题 → 观察 SSE 流（Plan 拆解、每轮搜索、Reflect 评估、最终报告生成）→ 保存报告 → 确认首页出现
- 修复 Bing 搜索：Node.js fetch 用 HTTP/2 连 cn.bing.com 被 ECONNRESET，改为 https 模块 + ALPNProtocols: ['http/1.1']；Bing HTML 结构中标题在一个不带 tilk class 的 `<a target="_blank" h="ID=SERP,...">` 中，修复正则匹配
- 新建 `spec/003-deep-research.md` — 深度研究功能完整 spec（目标、验收条件、设计约束、API、实现备忘）
- 修复深度研究报告不显示在主界面：
  - 现象：深度研究 pipeline 只 emit done 事件，从未调用 saveReportPipeline 落盘
  - 根因：`deepResearchPipeline` 缺少自动保存调用，`saveReportPipeline` 硬编码 type='survey'，`index.html` TY 映射缺少 'deep-research'
  - 修复：`deepResearchPipeline` 末尾增加调用 `saveReportPipeline(sessionId, topic, { type: 'deep-research' })` 自动落盘；`saveReportPipeline` 接收可选 opts.type（默认 'survey'）；server 保存 API 根据 session.mode 自动传 type；index.html 新增 deep-research 筛选项 + TY 映射 + CSS tag

## 2026-05-07

### 功能：深度研究 v2 — Brainstorm 前置 + 去纲要 + 对话修改

- 做了什么：三方面改进 —
  1. 深度研究增加 Brainstorm 前置阶段，先对齐目标再启动搜索
  2. 移除纲要生成步骤，研究完成后直接流式生成报告正文
  3. 报告生成后支持对话修改（modify_report intent）
- 为什么修改：
  - 原先直接拆解子问题搜索，缺少目标对齐环节，研究方向可能跑偏
  - 纲要生成步骤输出空泛不可用，浪费 LLM 调用
  - 报告生成后无修改能力，用户需重新生成
- 改动范围：
  - `lib/prompts.mjs`：`getDeepResearchPlanPrompt` 新增 `analysisDoc` 参数注入 Brainstorm 上下文；新增 `getDeepResearchBodyPrompt`（无需 outline 参数）
  - `lib/pipeline/intent.mjs`：新增 `DEEP_RESEARCH_TRIGGERS`、`modify_report` intent；`detectIntent` 接受 `fromDeepResearch` 参数
  - `lib/pipeline/insight-pipeline.mjs`：`deepResearchPipeline` 签名新增 `analysisDoc`；移除 ~50 行纲要生成代码，改为 `getDeepResearchBodyPrompt` 直出报告；设 `session._fromDeepResearch = true`；`chatPipeline` 新增 `modify_report` 处理（流式修改 + emit）
  - `server.mjs`：`POST /api/insight/deep-research` 接受 `analysisDoc` 字段
  - `lib/session-manager.mjs`：`createSession` 接受可选 `analysisDoc`
  - `insight.html`：新增 `deepResearchStarted`/`deepResearchDone`/`analysisDoc` 状态；Brainstorm 完成后注入"开始深度研究"按钮；移除 outline SSE 事件处理；支持 `modify` done 类型；checkbox 切换重置状态
  - `spec/003-deep-research.md`：更新至 v2（新流程、验收条件、SSE 事件表、实现备忘）

- 修复深度研究搜索失败（Bing HTML 解析器正则缺陷）：
  - 现象：Brainstorm 阶段信息正确，但深度研究搜索阶段"未检索到任何有效信息"
  - 根因：Bing 标题链接 `<a>` 内含 `<strong>` 等内联标签（如 `<a ...><strong>RSAC</strong> 2026 Conference</a>`），正则 `([^<]*)` 遇 `<` 即断，标题匹配失败；同时每个结果块有两个 `<a>` 标签（tilk 面包屑+标题），原有正则会先匹配到含 `<div>` 的 tilk 链接
  - 修复：`([^<]*)` → `([\s\S]*?)` 跨标签匹配标题；`<a\s+target=` 确保 `target="_blank"` 紧跟 `<a` 后，跳过 tilk 面包屑链接

- 修复深度研究 LLM 声称"无法搜索网络"：
  - 现象：深度研究 pipeline 实际执行了网络搜索（Bing），但 LLM 在合成阶段输出"我无法搜索网络"、"我的知识截止于2025年"、"建议您访问官网"
  - 根因：`getDeepResearchBodyPrompt` 没有告诉 LLM 素材来自网络搜索——LLM 看到的只是"已收集并分析的素材"，不知道这是实时搜索的结果。当素材不包含用户要的精确信息时，LLM 回退到默认行为（诚实声明能力边界）
  - 修复：
    1. `lib/prompts.mjs`：重写 `getDeepResearchBodyPrompt`，增加强指令——
       - 明确告知"系统刚刚为你执行了多轮网络搜索"
       - 黑名单禁止语："我无法搜索"、"我无法访问网络"、"我的知识截止于"、"建议您访问XX官网"
       - 建立 LLM 角色认同：你就是搜索执行者
       - 空素材时明确要求用内部知识写报告并标注待验证
    2. `.env`：设置 `SEARCH_PROVIDER=bing` 避免 Tavily→Bing fallback 的无效网络调用
  - 风险：强指令可能让 LLM 在素材确实不足时编造内容——已通过"标注哪些信息需要进一步验证"来平衡

- 修复 Bing 搜索 `read ECONNRESET`：
  - 现象：深度研究 pipeline 中 Bing 搜索报 `read ECONNRESET`，连接建立后读取响应时被重置
  - 根因：
    1. Node.js `https` 模块全局 agent 默认 `keepAlive: true`，Bing 服务器关闭了空闲连接但 agent 仍保持引用，下一个请求复用已关闭的连接导致 reset
    2. 当 `SEARCH_PROVIDER=bing` 时，`searchWeb` 的 fallback chain 没有覆盖 bing（只有 tavily 和 duckduckgo），Bing 失败后直接返回 `[]`
  - 修复 (`lib/search-provider.mjs`)：
    1. 创建独立 `https.Agent({ keepAlive: false, timeout: 10000 })` + 请求头加 `Connection: close`，避免复用已关闭连接
    2. `fetchHttps` 增加 `retries` 参数，`ECONNRESET` 时自动重试（200ms 间隔），最多重试 1 次
    3. `searchWeb` fallback 新增 `provider === 'bing'` → DuckDuckGo
  - 验证：直接测试 searchWeb 返回 3 条；searchBatch 并行 2 查询返回 6 条；5 轮压力测试全部通过

## 2026-05-10

### 功能：系统可观测性 — 落盘日志

- 做了什么：设计并实现统一落盘日志系统，覆盖 LLM 调用、搜索操作、邮件发送、错误记录四类
- 为什么修改：系统问题排查全靠 `console.log`，无法回溯历史调用，出问题后无法追溯
- 关键判断点：
  - **格式选 JSONL**（每行一个 JSON 对象）：比 CSV 灵活支持嵌套字段，比 SQLite 零依赖，`grep`/`jq` 可直接查询
  - **按 category 分文件**（llm.jsonl / search.jsonl / email.jsonl / error.jsonl）：比单一大文件更易于按类型检索
  - **按日期分目录**（logs/YYYY/MM/DD/）：自动轮转，旧日志可手动清理
  - **写盘用 `appendFileSync`**：写入量不大（每次 LLM 调用 ~1KB），同步写避免进程退出时丢数据，try-catch 包裹确保不因日志写盘失败中断主流程
- 改动范围：
  - `lib/logger.mjs`：新建，4 个导出函数 `logLLM`/`logSearch`/`logEmail`/`logError`，统一写入格式
  - `lib/llm-provider.mjs`：`createProvider()` 返回前用 `withLogging()` 包装，透明记录每次 `generate()` 和 `generateStream()` 的耗时、token、错误
  - `lib/search-provider.mjs`：`searchBatch()` 记录 provider、查询词、结果数、耗时、错误
  - `lib/pipeline/insight-pipeline.mjs`：plan/reflect/synthesize/save 阶段解析失败和异常落盘
  - `server.mjs`：邮件发送成功/失败落盘；chat/deep-research/start/confirm-outline/auto-search/skip-search 各 pipeline 异常落盘
  - `.gitignore`：新增 `logs/`
- 日志示例：
  - LLM: `{"ts":"...","type":"llm","provider":"Claude (Anthropic)","model":"...","promptLen":3500,"promptPreview":"...","responseLen":1200,"usage":{"input":3500,"output":1200},"durationMs":3200,"error":null}`
  - Search: `{"ts":"...","type":"search","provider":"bing","queries":["RSAC 2026"],"resultCount":5,"durationMs":800,"error":null}`
  - Email: `{"ts":"...","type":"email","to":["..."],"subject":"...","reportId":"...","success":true,"messageId":"<...>","error":null}`
  - Error: `{"ts":"...","type":"error","source":"deepResearchPipeline.plan","message":"...","stack":"...","sessionId":"..."}`
- 验证：语法检查全部通过；写入测试产生 4 个 JSONL 文件，格式正确

### 功能：Brainstorm 阶段增加轻量搜索

- 做了什么：在 Chat pipeline 的 brainstorm 阶段，每次 LLM 调用前执行一次轻量 Web 搜索（3 条结果，5s 超时），搜索结果注入到 prompt 中辅助目标对齐
- 为什么修改：原先 Brainstorm 完全依赖 LLM 内部知识，对前沿/小众课题（如 RSAC 2026）方向可能跑偏；增加实时搜索让 LLM 能看到最新动态后再做分析
- 关键判断点：
  - 搜索量 3 条（非 5 条），超时 5s，失败静默回退——不阻塞用户体验
  - 搜索结果注入位置在 prompt 中段，紧跟课题后，附指令"请利用搜索结果中的最新动态、产品名称、事件来佐证或补充分析"
  - 无搜索结果时 search block 完全不出现在 prompt 中（保持向后兼容）
- 改动范围：
  - `lib/prompts.mjs`：`getBrainstormUpdatePrompt` 新增第 5 参数 `searchContext`
  - `lib/pipeline/insight-pipeline.mjs`：brainstorm handler 增加 `Promise.race([searchWeb(...), timeout])` 调用
- 验证：prompt 正确注入/不注入搜索块；Bing 搜索 3 条结果正常返回；语法检查通过
  - 修复：Brainstorm 搜索注入效果不够 — LLM 仍说"尚未公布"：
    - 现象：Brainstorm 搜索已执行并返回结果，但 LLM 仍输出"实际 RSAC 2026 创新沙盒十强尚未公布"
    - 根因：
      1. `searchWeb` 无落盘日志，无法验证搜索是否确实执行
      2. prompt 中搜索结果权威性不够——原指令"请利用搜索结果佐证"太温和，LLM 在内部知识冲突时倾向保守
    - 修复：
      1. `lib/search-provider.mjs`：`searchWeb` 增加 `logSearch` 落盘（finally 块），每次查询可追溯
      2. `lib/prompts.mjs`：重写 searchBlock 指令——
         - 标注"系统刚刚从互联网搜索获取的最新信息"加实时时间戳
         - 明确"如果搜索结果与内部知识有冲突，以搜索结果为准"
         - 黑名单：绝对不要说"尚未公布"、"尚未发生"，除非搜索结果本身这样说明
         - snippet 长度截断到 300 字

- 修复 Bing 搜索无法查到具体信息（如 RSAC 创新沙盒十强名单）：
  - 现象：手工搜索可以查到 RSAC 2026 创新沙盒十强公司，但系统提示"搜索未返回具体名称"。Bing 返回的 5 条结果都是 RSAC 通稿，标题和 snippet 不含公司名
  - 根因：
    1. `cn.bing.com` 对特定页面（如 RSAC 沙盒入围名单）索引质量差，不排在首页
    2. `setmkt=en-US` 在 `cn.bing.com` 上行为不一致——部分英文查询返回无关垃圾结果（豆包AI、百度知道等）
    3. 仅凭搜索 snippet（150 字）不够——具体信息埋在文章正文里
    4. 知乎等中文内容站返回 403 禁止抓取
  - 修复：
    1. `lib/search-provider.mjs`：提取 `parseBingResults()` 共用解析函数；`searchBing` 改为并行发两个请求（无 setmkt + setmkt=en-US），合并去重取交集——覆盖中英文查询
    2. `lib/pipeline/insight-pipeline.mjs`：brainstorm 搜索后增加内容增强——挑选非知乎、非首页的结果，fetch 全文 HTML，清洗后注入 `_fullText`（最多 3000 字）。过滤 403 站点，<200 字内容视为无效丢弃
    3. `lib/prompts.mjs`：searchBlock 增加 `_fullText` 展示（以"页面全文摘录"注入，最多 2000 字）
  - 限制：即使双路搜索，`cn.bing.com` 仍无法返回决赛入围名单专属页面——该信息在 Bing.cn 索引中不存在或排名极低。后续可考虑增加 Baidu/Google 作为备选搜索源

- 增加 Bing 国际版作为第三个并行搜索源：
  - 做了什么：`searchBing` 从双路并行升级为三路并行——新增 `www.bing.com` + `setmkt=zh-CN`，与原有 `cn.bing.com`（无 setmkt + setmkt=en-US）合并去重
  - 为什么：`www.bing.com` 国际版索引与 `cn.bing.com` 不同，对特定页面（如 RSAC 创新沙盒决赛名单、知乎文章等）覆盖面更好，实测从 5 条通稿提升到 8 条覆盖知乎/secrss/163/腾讯新闻等中文信息源
  - 如何验证：`searchWeb('RSAC 2026 创新沙盒 十强', 8)` 返回 8 条结果，包含知乎专栏文章详细列出创新沙盒十强公司
- 尝试增加百度搜索源：
  - 做了什么：测试 `www.baidu.com`、`m.baidu.com`、`sp0.baidu.com` 等多个百度端点，均返回"百度安全验证"CAPTCHA 页面（1438 字节），即使使用 Baiduspider UA 也无法绕过
  - 结论：百度在当前服务器 IP 上全面封禁程序化访问，需 headless browser（Playwright/Puppeteer）才能使用，不在本次任务范围内
  - 替代方案：Bing 三路并行搜索已显著提升中文内容覆盖面，暂不引入百度
