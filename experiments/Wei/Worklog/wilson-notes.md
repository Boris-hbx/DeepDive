# Wilson 的实践笔记

> 边做边补，记关键决策、踩坑和修复方法。参考 Dong 的 NOTES.md 格式。
> 状态：Insight Agent 全流水线已跑通，server 运行中。

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
