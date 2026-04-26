# Spec: 洞察 Agent（Insight Agent）— 软件工程 & 网络安全

- 状态：草稿
- 作者：Wei
- 日期：2026-04-26
- 关联：[product.md](../../../spec/product.md)、DeepInsight spec 001 / 002（参考蓝本）

## 目标

构建一个 **Agent 驱动的洞察系统**，覆盖 **软件工程** 和 **网络安全** 两大领域，支持用户指定具体课题进行深入交互式洞察。从信息采集到报告消费形成完整闭环：

1. **指定课题深入洞察** — 用户输入任意技术课题（如"供应链攻击防御演进"、"AI Code Agent 架构对比"），Agent 自动采集、分析、生成带引用的结构化报告；支持多轮追问，交互式深挖
2. **每日 brief** — 定时扫描配置的信息源，按软件工程 / 网络安全两个领域分别生成每日摘要
3. **报告管理** — 现代化查看器，搜索、过滤、按领域分类、多格式切换
4. **反馈闭环** — 交互式反馈 → 自动 Skill 沉淀 → 下次生成自动注入
5. **多格式输出** — Markdown / HTML / Marp PPT，一份内容三种消费方式

为什么现在做：团队（8 人）跟踪技术趋势的方式是零散的人工阅读，信息孤岛、时效性差、深度不足、无法追溯。软件工程和网络安全是团队核心关注的两个领域，需要从"被动阅读"变为"主动洞察"。

## 用户故事

- 作为团队成员，我想输入一个技术课题（如"零信任架构落地实践"或"AI Code Agent 架构演进"），5 分钟内看到结构化综述报告（含 TL;DR、时间线、对比表、原文引用），以便快速建立系统性理解。
- 作为团队成员，我想在首次报告基础上继续追问（如"对比 SASE 和零信任的适用场景"），Agent 基于上下文生成补充分析，以便交互式深挖课题。
- 作为团队成员，我想每天早上打开网页，5 分钟分别扫完软件工程和网络安全两个领域的当日 brief，每条洞察能点回原文深读，正反两面的观点可以对比
- 作为团队成员，我想在报告查看器中搜索、按标签过滤、切换格式（HTML/Markdown/PPT），以便快速找到和消费历史报告。
- 作为团队成员，我想对报告提交反馈（洞察思路 / 分析方法 / 缺失内容 / 错误纠正），并让系统在后续同类课题中自动应用这些反馈。
- 作为团队成员，我想基于反馈重新生成报告，以便立即看到改进效果。

## 验收条件

### 能力 1 · 指定课题深入洞察

- [ ] 用户输入课题 + 可选领域（软件工程 / 网络安全）+ 可选标签 + 可选时间范围，5 分钟内生成结构化报告
- [ ] 报告包含：TL;DR（3 句话）、关键发现、对比分析表、时间线、引用来源（每条结论可追溯原文）
- [ ] 报告同时输出 Markdown、HTML（自包含）、Marp PPT 三种格式
- [ ] 按日期归档（`reports/YYYY/MM/DD/`），自动更新全局索引 `reports/index.json`
- [ ] 用户可指定标签（如 `#LLM` `#Agent` `#漏洞` `#供应链安全`），Agent 自动补充标签（基于内容分析）
- [ ] 支持交互式追问：用户在已生成报告基础上提出后续问题，Agent 基于上下文生成补充分析报告，与原报告关联

### 能力 2 · 每日 brief

- [ ] 定时（可配置，默认每日一次）自动扫描信息源，按软件工程 / 网络安全两个领域分别生成当日 brief
- [ ] 每个领域的 brief 结构：「最关注的事」（≤3 条，每条 1 段话 + 原文链接）+「值得一看的事」（≤5 条，每条 1 句话 + 原文链接）
- [ ] 当日无重要事件时输出"今日无重要事件"，不凑数
- [ ] 支持手动触发生成
- [ ] 同一事件多源报道时去重，brief 中只出现一次

### 能力 3 · 报告管理与查看

- [ ] 报告查看器（`index.html`）：卡片式布局，网格 / 列表视图切换
- [ ] 实时搜索（标题 + 标签）
- [ ] 标签过滤：展开 / 折叠、显示数量、多选、按数量 / 名称 / 类型排序、一键清除
- [ ] 领域过滤：软件工程 / 网络安全 / 全部
- [ ] 全局格式切换：HTML / Markdown / PPT
- [ ] 排序：按时间倒序（默认）/ 按标题拼音
- [ ] Header 统计：总报告数、总标签数
- [ ] 新建洞察入口：弹出 Modal → 填写课题 / 领域 / 标签 / 时间范围 → 异步生成 → Toast 进度提示

### 能力 4 · 反馈闭环与 Skill 沉淀

- [ ] 每份 HTML 报告底部有"反馈与改进"面板
- [ ] 支持 4 种反馈类型：洞察思路、分析方法、缺失内容、错误纠正
- [ ] 反馈可附加关键词（用于后续匹配）
- [ ] 反馈可选"保存为可复用 Skill"（默认勾选）
- [ ] 历史反馈按报告展示
- [ ] 基于反馈重新生成：保存反馈 + 生成 Skill → 重新生成 → 新窗口打开
- [ ] Skill 自动注入：生成时读取 `skills/*.json`，按关键词匹配课题，匹配的 Skill 注入 prompt

### 基础设施

- [ ] LLM 后端可通过环境变量 / 配置切换（默认 Claude，可选 DeepSeek 等）
- [ ] 信息源列表通过配置文件管理，支持 RSS / HN / 官方 Blog /微信公众号 / X（tweeter）博主等类型
- [ ] 单个源抓取失败时跳过，不阻塞流水线，日志记录失败原因
- [ ] HTTP 服务器提供 API（生成、反馈、Skill 查询、重新生成）

## 不做什么

- **不做用户登录 / 认证** — 团队内网共用，先跑通最重要
- **不做自动发现信息源** — 质量难保证，人工指定的源先跑通
- **不做邮件 / IM 推送** — brief 质量稳定后再加
- **不做趋势预测 / 根因预判** — 只梳理"已发生的"
- **不做社交功能** — 不做评论、点赞、分享到社交网络
- **不做自动决策** — Agent 只输出洞察，不自动执行行动
- **不做多语言翻译** — 只支持中英文混合
- **不做多人协作** — 不做共享报告、批注、讨论（后续再议）

## 设计要点 / 约束

### 目录结构

```
experiments/Wei/
├── server.mjs              # HTTP 服务器 + API
├── generate.mjs            # CLI 入口（手动触发生成）
├── sources.json            # 信息源配置
├── index.html              # 报告查看器（前端）
├── .env                    # API keys（不入库）
├── lib/
│   ├── fetcher.mjs         # 信息源抓取（RSS / HN / Blog）
│   ├── dedup.mjs           # 去重逻辑
│   ├── summarizer.mjs      # LLM 摘要 + brief / 综述生成
│   ├── llm-provider.mjs    # LLM 抽象层（Claude / DeepSeek）
│   ├── prompts.mjs         # Prompt 模板
│   ├── report-generator.mjs # 报告生成（含 Skill 注入、Marp PPT）
│   ├── html-renderer.mjs   # Markdown → 自包含 HTML（含反馈面板）
│   ├── feedback.mjs        # 反馈 + Skill 管理
│   └── storage.mjs         # 文件存储 + 索引管理
├── reports/
│   ├── index.json          # 全局索引（按标签、日期、类型查询）
│   ├── feedback.json       # 反馈记录
│   └── YYYY/MM/DD/
│       ├── *.md            # Markdown 报告
│       ├── *.html          # HTML 报告（含反馈面板）
│       ├── *.marp.md       # Marp PPT 源文件
│       └── *.meta.json     # 元数据（标签、来源、成本）
├── briefs/
│   └── YYYY/MM/DD/
│       ├── brief.md        # 每日 brief（Markdown）
│       └── brief.html      # 每日 brief（HTML）
└── skills/
    └── *.json              # 自动生成的 Skill
```

### 数据流

#### 课题综述

```
用户输入课题 + 标签 + 时间范围
    ↓
fetcher.mjs — 调用 Web 搜索 / 信息源抓取，输出 RawItem[]
    ↓
dedup.mjs — URL + 标题相似度去重，输出 UniqueItem[]
    ↓
summarizer.mjs — LLM 筛选 + 结构化分析（TL;DR / 对比表 / 时间线 / 引用）
    ↓                ↑
    ↓         feedback.mjs — getSkillsForTopic() 匹配关键词，注入 prompt
    ↓
report-generator.mjs — 生成 Markdown + Marp PPT
    ↓
html-renderer.mjs — 生成自包含 HTML（含反馈面板）
    ↓
storage.mjs — 归档到 reports/YYYY/MM/DD/ + 更新 index.json
```

#### 每日 brief

```
定时触发 / 手动 node generate.mjs --brief
    ↓
fetcher.mjs — 并行抓取 sources.json 中所有源
    ↓
dedup.mjs — 去重
    ↓
summarizer.mjs — LLM 筛选 + 生成 brief（最关注 ≤3 + 值得一看 ≤5）
    ↓
html-renderer.mjs — 生成 brief.md + brief.html
    ↓
更新 briefs/ 目录
```

#### 反馈闭环

```
用户在 HTML 报告底部提交反馈
    ↓
POST /api/feedback
    ↓
feedback.mjs — saveFeedback() → reports/feedback.json
    ↓
feedback.mjs — saveSkill() → skills/*.json
    ↓
下次生成同类课题时
    ↓
report-generator.mjs → getSkillsForTopic() 按关键词匹配
    ↓
匹配的 Skill 注入 prompt → LLM 生成报告（已包含历史反馈要求）
```

### 核心数据结构

```typescript
// 抓取到的原始条目
interface RawItem {
  title: string;
  url: string;
  source: string;       // 来源名称
  publishedAt: string;  // ISO 8601
  snippet: string;      // 摘要或正文前 500 字
}

// 去重后的条目
interface UniqueItem extends RawItem {
  duplicateUrls?: string[];
}

// 综述报告
interface InsightReport {
  id: string;
  title: string;
  createdAt: string;
  type: 'survey' | 'daily-brief' | 'follow-up';
  domain: 'software-engineering' | 'cybersecurity';
  parentReportId?: string;  // 追问报告关联的原始报告 ID
  tags: {
    user: string[];   // 用户指定标签
    auto: string[];   // Agent 自动生成标签
  };
  markdown: string;
  html: string;
  summary: {
    tldr: string[];          // 3 句话摘要
    keyTakeaways: string[];
  };
  sources: { title: string; url: string }[];
  metadata: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    llmProvider: string;
  };
  filePath: string;  // reports/YYYY/MM/DD/slug.md
}

// 每日 brief
interface DailyBrief {
  date: string;          // YYYY-MM-DD
  domain: 'software-engineering' | 'cybersecurity';
  generatedAt: string;
  llmProvider: string;
  topStories: BriefItem[];      // ≤3 条
  worthReading: BriefItem[];    // ≤5 条
  noNews: boolean;
}

interface BriefItem {
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
}

// 反馈
interface Feedback {
  id: string;
  reportId: string;
  reportTitle: string;
  type: 'insight' | 'method' | 'missing' | 'error';
  content: string;
  keywords: string[];
  saveAsSkill: boolean;
  createdAt: string;
}

// Skill
interface Skill {
  id: string;
  name: string;
  type: 'insight' | 'method' | 'missing' | 'error';
  content: string;
  keywords: string[];
  sourceReport: string;
  createdAt: string;
  updatedAt: string;
}
```

### API 设计

Base URL: `http://localhost:3457`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/generate` | 生成课题综述（异步）。Body: `{ topic, domain?, userTags?, timeRange? }` |
| POST | `/api/follow-up` | 交互式追问（基于已有报告深挖）。Body: `{ parentReportId, question }` |
| POST | `/api/brief` | 手动触发每日 brief 生成（两个领域各一份） |
| GET | `/api/feedback?reportId=xxx` | 查询某报告的反馈记录 |
| POST | `/api/feedback` | 提交反馈。Body: `{ reportId, reportTitle, type, content, keywords, saveAsSkill }` |
| GET | `/api/skills` | 查询所有 Skill |
| POST | `/api/regenerate` | 基于反馈重新生成。Body: `{ topic, feedback }` |

### 信息源配置示例

```json
{
  "domains": {
    "software-engineering": {
      "label": "软件工程",
      "sources": [
        { "type": "rss", "name": "Anthropic Blog", "url": "https://www.anthropic.com/rss.xml" },
        { "type": "rss", "name": "OpenAI Blog", "url": "https://openai.com/blog/rss.xml" },
        { "type": "rss", "name": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/" },
        { "type": "rss", "name": "Simon Willison", "url": "https://simonwillison.net/atom/everything/" },
        { "type": "hn", "name": "Hacker News", "keywords": ["AI agent", "LLM", "Claude", "Copilot", "Cursor", "agentic", "software engineering"] }
      ]
    },
    "cybersecurity": {
      "label": "网络安全",
      "sources": [
        { "type": "rss", "name": "Krebs on Security", "url": "https://krebsonsecurity.com/feed/" },
        { "type": "rss", "name": "The Hacker News", "url": "https://feeds.feedburner.com/TheHackersNews" },
        { "type": "rss", "name": "Schneier on Security", "url": "https://www.schneier.com/feed/" },
        { "type": "rss", "name": "CISA Alerts", "url": "https://www.cisa.gov/cybersecurity-advisories/all.xml" },
        { "type": "hn", "name": "Hacker News", "keywords": ["CVE", "zero-day", "ransomware", "supply chain attack", "vulnerability", "cybersecurity"] }
      ]
    }
  },
  "maxItemsPerSource": 20
}
```

### Marp PPT 约束

- 长段落 > 600 字符 → 截断到最后一个句号，末尾加 `*(...)*`
- 表格 > 3 行 → 拆分多页，每页显示页码
- 全局字体 22px，标题 h1: 36px / h2: 28px / h3: 22px，表格字体 16px
- 用户标签 + 自动标签合并时去重

### LLM 调用约束

- 单次综述 token budget ≤ 100K（输入 + 输出）
- 超时 60s，指数退避重试 3 次（1s, 2s, 4s）
- Prompt 要求：只输出有来源支撑的内容，不编造事实，无重要事件时诚实说"无"
- 每用户每天最多 10 次课题综述（防滥用）

### 技术选型约束

- Node.js（ESM）
- 前端纯 HTML/CSS/JS，不引入框架，CSS 变量 + 深色模式自适应，响应式布局
- 核心依赖：`@anthropic-ai/sdk`、`rss-parser`、`marked`、`@marp-team/marp-cli`
- 引入新依赖前需确认

## 开放问题

> **AI 看到本节非空时应停下来问，不要自行决定。**

- ~~去重策略~~：URL 精确匹配 + 标题 Jaccard 相似度（阈值 0.6）。已确认。
- ~~HN 抓取方式~~：hnrss.org RSS。已确认。
- ~~定时触发方式~~：node-cron 内置定时 + 本地预览（npx serve）。已确认。
- ~~静态站点发布位置~~：先本地预览，后续按需迁移。已确认。
- ~~信息源初始清单~~：先用 spec 中列的 10 个源（软件工程 5 + 网络安全 5）跑通。已确认。
- ~~Skill 匹配精度~~：初期用关键词子串匹配，后续按需升级。已确认。
- ? **中文编码**：Windows 环境下 JSON 文件中文存储需注意 UTF-8 编码问题。
- ~~交互式追问的上下文管理~~：最多 5 轮，超过时自动摘要前文作为上下文，对话历史持久化到 meta.json。已确认。
- ~~领域自动分类~~：用户不指定领域时，LLM 自动判断课题归属，跨领域课题打双标签。已确认。

## 实现备忘（可选，实现过程中追加）

> 实现中临时的设计选择、踩坑记录。完成后挑重要的整理进 `docs/decisions.md`，本节随 PR 一起留档。
