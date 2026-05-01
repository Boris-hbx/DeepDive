# 001 — Web App: md 渲染 + 动态视频解析 + Fly 部署

- 状态：**已评审（Boris 已批，进入实施）**
- 作者：Boris + Claude（草稿）
- 日期：2026-04-26
- 关联：[`../spec.md`](../spec.md)（Boris MVP overview，未评审）· [`/spec/mvp.md`](../../../spec/mvp.md)（团队 MVP 契约）· [`/docs/decisions.md`](../../../docs/decisions.md)（偏离记录，2026-04-26 条目）· `C:\Project\DeepInsight\experiments\hello-fly`（fly 部署参考）

## 目标

把当前"零散静态 html + 多份 md"的状态收敛成一个 **Next.js 应用**，覆盖三件事：

1. **静态视图**：把 `daily-report/*.md` 渲染成统一网页——**一个 URL 看所有 brief + talk reports**，sidebar 切换
2. **动态交互**：在网页上输入 YouTube 视频 URL → 后端调字幕抓取 → Claude 分析 → 返回结构化 talk-style 报告（沿用蓝军视角结构）
3. **Fly.io 部署**：可访问的公网 URL，区别于 gh-pages 静态托管，支持上面的动态请求

## 用户故事

**Story A · 浏览历史 brief**：作为 Boris，访问应用首页，左侧 sidebar 列出所有日期的 brief + talk report，点击切换 → 右侧主区显示对应内容（variant-b-v2 视觉风格）。

**Story B · 临时分析视频**：作为 Boris（或团队成员），访问 `/analyze` 页，粘贴 YouTube 链接，点"分析"。等待 30-90 秒后，页面显示一份 talk-style 报告（TL;DR / 主线 / 金句 / 蓝军）。可选"保存为 archive"（写回 md）或丢弃。

## 验收条件

- [ ] `experiments/Boris/site/` 下是能 `npm run dev` 启动的 Next.js 应用
- [ ] 首页 `/` 展示 sidebar + 默认最新 daily report
- [ ] sidebar 自动列出所有 `daily-report/*.md`，按日期 + 类型（brief / talk）分组
- [ ] 任意 .md 改动后 dev 模式热刷新生效
- [ ] `/analyze` 页：输入 YouTube URL → 正确返回字幕分析报告
- [ ] 失败优雅降级：无字幕 / yt-dlp 失败 / Claude 失败 → 清晰错误信息，不是白屏
- [ ] `fly deploy` 成功，公网 URL 能访问首页 + `/analyze`
- [ ] `ANTHROPIC_API_KEY` 走 `fly secrets set`，**绝不进 git / image / 客户端**
- [ ] 输入校验：URL 格式 + 长度上限 + 域名白名单（仅 youtube/youtu.be）
- [ ] 速率限流：per-IP + 全局并发上限，防恶意刷 LLM

## ⚠ 与 `spec/mvp.md` 的偏离声明

mvp.md 明确：

> ❌ 动态后端（DB / API 服务）

本 spec 引入了 API route + fly.io server，**与 mvp 契约直接冲突**。**Boris 作为 PM 自批 exception**，理由：

1. 静态站点无法满足"输入 URL 实时分析"这条 Story
2. fly 部署带来的实时性 + 公网可达，是显著产品体验提升，超出 mvp 范围但方向正确
3. 本周**仍然产出**符合 mvp 输出契约的 md 文件（每日 brief 走 archive 路径，未受影响）；偏离的只是网页呈现层 + 动态交互层

**已记录**：见 `docs/decisions.md` 2026-04-26 条目「Boris 子线：偏离 mvp.md「无动态后端」限制」。

## 不做什么

- ❌ 用户登录 / 鉴权（短期：URL 公开 + 速率限流够用）
- ❌ 持久化数据库 — 分析结果默认不保存；"保存为 archive" 是把 md 写回仓库交给 git
- ❌ 任务队列 / Worker — 单次请求同步等待（30-90s 客户端可接受）
- ❌ 多语言界面 — 中文为主
- ❌ 视频本体处理（转写 / 视频帧）— **只取字幕**，无字幕的视频报错而不是降级转写
- ❌ 复杂权限模型 — 速率限流足矣

## 技术栈（**待 Boris 确认**）

| 维度 | 推荐默认 | 备选 | 备注 |
|---|---|---|---|
| 框架 | **Next.js 16 App Router + TypeScript** | Astro、Remix、Express + EJS | 复用 hello-fly 经验、与 ../spec.md 一致 |
| Build 模式 | **`output: 'standalone'`**（server 模式） | `output: 'export'`（静态） | fly 必须 server 模式；export 不支持 API route |
| 样式 | 保留 variant-b-v2 inline CSS，先抽到 CSS Modules | Tailwind / shadcn | 当前 prototype 全 inline，迁移最快；后续可重构 |
| Markdown | `marked` 或 `markdown-it`（Node 端编译） | MDX | .md 文件已有，不改成 .mdx |
| **YouTube 字幕** | **a · `youtube-captions-scraper`**（pure Node） | **b · `yt-dlp` 子进程**（要 Docker 装 Python） | a 简单 / b 鲁棒。建议先 a 跑通，失败兜底走 b |
| LLM SDK | `@anthropic-ai/sdk`（hello-fly 同款） | openai 兼容 | 默认 Claude Sonnet 4.6 |
| 部署 | **Fly.io** Dockerfile + fly.toml | Vercel、Railway | hello-fly 已搭好流程，复用 |
| 速率限流 | 内存 token bucket（per-IP）+ 全局并发上限 | redis-based | 第一周不引外部 storage |
| Secrets | `fly secrets set ANTHROPIC_API_KEY=...` | — | 唯一姿势 |

**Boris 决策（2026-04-26 锁定）**：

1. **YouTube 字幕**：先走 a（`youtube-captions-scraper`，pure Node），失败兜底走 b（`yt-dlp` subprocess）。如果 D+2 评估发现 a 命中率 < 50%，直接换 b。
2. **速率限流**：接受默认 — per-IP 5 次/分钟 + 全局 3 并发上限。
3. **fly app 名字**：**`boris-deepdive-dailyreport`**。
4. **LLM SDK**：`@anthropic-ai/sdk`，默认模型 Claude Sonnet 4.6（API id：`claude-sonnet-4-6`）；蓝军视角同模型同 prompt 内出（单次调用），质量不达标再拆双调用。

## 架构图

```
┌────────────── browser ───────────────┐
│  GET /                                │
│  GET /reports/<slug>                  │
│  POST /api/analyze-video {url}        │
└──────────────┬───────────────────────┘
               │
               ▼
┌────────── Next.js (fly machine) ──────────┐
│  src/app/                                  │
│    page.tsx                  列表 + 默认  │
│    reports/[slug]/page.tsx   单份         │
│    analyze/page.tsx          视频分析 UI  │
│    api/analyze-video/route.ts             │
│  src/lib/                                  │
│    reports.ts   读 daily-report/*.md      │
│    markdown.ts  md → html (server-side)   │
│    youtube.ts   字幕抓取 + 清洗           │
│    claude.ts    Anthropic SDK 调用        │
│  daily-report/*.md  Dockerfile COPY 进    │
└────────────┬─────────────────────────────┘
             │
             ▼
   ┌─── 外部依赖 ────┐
   │ YouTube CC API  │
   │ Anthropic API   │
   └─────────────────┘
```

`daily-report/*.md` 在 build 时 COPY 进 image，运行时直接读文件。新增 brief = git push + redeploy。

## 工作目录

```
experiments/Boris/
├── spec.md                       ← 现有 overview spec
├── spec/
│   └── 001-web-app.md            ← 本 spec
├── daily-report/                 ← md source (不动)
│   ├── 2026-04-26.md
│   ├── 2026-04-26-talk-*.md
│   └── ...
├── site/                         ← 新建：Next.js 应用
│   ├── Dockerfile
│   ├── fly.toml
│   ├── package.json
│   ├── next.config.ts            ← output: 'standalone'
│   ├── src/app/
│   │   ├── page.tsx
│   │   ├── reports/[slug]/page.tsx
│   │   ├── analyze/page.tsx
│   │   ├── api/analyze-video/route.ts
│   │   └── layout.tsx
│   ├── src/lib/
│   │   ├── reports.ts
│   │   ├── markdown.ts
│   │   ├── youtube.ts
│   │   └── claude.ts
│   ├── src/styles/               ← 抽 variant-b-v2 CSS
│   └── public/
├── prompts/
│   ├── dedup_system.md           ← 现有
│   ├── analyze_system.md         ← 新（transcript → 结构化报告）
│   └── critique_system.md        ← 新（从 prototype 抽出）
└── prototypes/                   ← 现有，留作 reference
```

## 流水线

### 静态视图（build/run 时）

```
daily-report/*.md ─→ reports.ts ─→ {slug, type, date, title, content}
                                         │
                                         ▼
                                   markdown.ts ─→ sanitized HTML
                                         │
                                         ▼
                                   page.tsx 注入
```

### 动态分析（请求时）

```
POST /api/analyze-video {url}
  │
  ├── 1. 校验 URL（格式 + youtube/youtu.be 域名白名单）
  ├── 2. 速率限流（per-IP token bucket + 全局并发上限）
  ├── 3. youtube.ts
  │      ├── 解析 video_id
  │      ├── youtube-captions-scraper 抓 en-orig 字幕
  │      └── clean transcript（参考 prototype 阶段 clean_vtt 逻辑）
  ├── 4. claude.ts
  │      ├── ANALYZE_SYSTEM prompt：transcript → JSON
  │      └── 字段：tldr / sections[] / quotes[] / critique
  └── 5. 返回 {report, meta} → 前端按 talk-report 视觉渲染
```

**蓝军反驳**：第一版**单次 LLM 调用同时产主报告 + 蓝军**（一份 prompt，分两个字段输出），简单、省一次 round trip。如果质量差再拆成两次串联调用（hello-fly 模式）。

## 安全清单（沿用 hello-fly README）

- [ ] `.env.local` 入 `.gitignore` + `.dockerignore`
- [ ] `.env.example` 仅放 placeholder（`ANTHROPIC_API_KEY=sk-ant-api03-REPLACE_ME`）
- [ ] `ANTHROPIC_API_KEY` 通过 `fly secrets set` 注入，绝不进 image
- [ ] API route 错误处理：完整 SDK 错误只写服务端 log；401/403 客户端只显示"服务端配置错误"
- [ ] 速率限流：per-IP token bucket（默认 5/min）+ 全局并发上限（默认 3）
- [ ] 输入校验：URL 长度 ≤ 200、域名白名单、video_id 正则
- [ ] CSRF：POST endpoint 加 same-origin 检查（虽然单页，但建议）
- [ ] **绝不**在前端代码、聊天、commit message、截图里粘 API key

## 部署细节

- **App name**：`boris-deepdive-dailyreport`（Boris 已确认 2026-04-26）
- **Region**：`nrt`（东京），与 hello-fly 一致
- **VM**：`shared-cpu-1x` + 512MB RAM（hello-fly 同款）
- **`auto_stop_machines = 'stop'` + `min_machines_running = 0`** — 闲置自动停机省钱
- **冷启动**：第一次请求 1-3 秒
- **Dockerfile**：multi-stage 沿用 hello-fly 模板（Next.js standalone）；如果选 yt-dlp subprocess 方案，需加 `apk add python3 py3-pip && pip install yt-dlp`

## 设计要点 / 约束

- **md 是 source of truth**：网页是 derived。改内容只改 md，不直接改 html
- **archive 永远可写**：保存视频分析结果时写到 `daily-report/<date>-talk-<slug>.md`，与人工写的 md 同结构
- **fail-soft**：单个分析失败不能让整个 app 挂；前端有重试按钮
- **可观测**：每次请求记录 latency / token count / model 用量到服务端 log（log 不出 fly machine）
- **不引入新依赖前先问** — 但 spec 列出的依赖（next/react/anthropic-sdk/marked/youtube-captions-scraper）批准后视为已确认

## Prompt 资产

| 文件 | 用途 |
|---|---|
| `prompts/dedup_system.md` | 现有，每日 brief dedup 用 |
| `prompts/analyze_system.md` | 新，transcript → 结构化 talk report（含蓝军字段） |
| `prompts/critique_system.md` | 新，从当前 prototype 蓝军写法抽出来，可复用 |

## 时间盒

- D0 (2026-04-26 今天)：spec 评审 ✓ · `docs/decisions.md` 偏离条目 ✓ · 删 3 个冗余 html ✓ · scaffold `experiments/Boris/site/` Next.js 骨架（仅启动壳）
- D+1：reports.ts + markdown.ts + 首页 sidebar + `/reports/[slug]` 路由跑通（静态部分）
- D+2：`/analyze` 页 + youtube.ts + claude.ts + `/api/analyze-video` route（动态部分）
- D+3：Dockerfile + fly.toml + 部署到 fly（`boris-deepdive-dailyreport.fly.dev`）+ secrets 注入

## 开放问题（D+2/D+3 时再回答）

- [ ] 视频分析结果**默认是否落盘**？倾向：默认不存，UI 显示"保存为 archive"按钮，点了才写 md。D+2 实施时定。
- [ ] 是否为 fly deploy 加 GitHub Actions 自动化（push 即部署）？倾向：**不加**，手动 `fly deploy`。D+3 复盘再议。
- [ ] 旧 `experiments/Boris/spec.md`（overview）何时收敛进本 spec？倾向：D+3 部署完成后做一次 overview 重写。

## 决策定稿

| 维度 | 决定 |
|---|---|
| 框架 | Next.js 16 App Router + TypeScript + React 19 |
| Build 模式 | `output: 'standalone'`（server 模式，fly 部署需要） |
| 样式 | 沿用 variant-b-v2，先抽到 CSS Modules / 单一 globals.css |
| Markdown 渲染 | `marked`（轻量，server-side 渲染） |
| YouTube 字幕 | `youtube-captions-scraper`（先 a，失败兜底走 yt-dlp subprocess） |
| LLM SDK | `@anthropic-ai/sdk` ^0.91.0，默认模型 `claude-sonnet-4-6` |
| 蓝军模式 | 单次 LLM 调用同时产主报告 + 蓝军字段（一次 round trip） |
| 部署 | Fly.io，app name `boris-deepdive-dailyreport`，region `nrt`，VM `shared-cpu-1x` 512MB |
| 闲置策略 | `auto_stop_machines = 'stop'` + `min_machines_running = 0` |
| Secrets | `fly secrets set ANTHROPIC_API_KEY=...`（绝不进 git/image/前端） |
| 速率限流 | per-IP 5/min + 全局 3 并发；内存 token bucket（不引外部 storage） |
| 输入校验 | URL 长度 ≤ 200 + 域名白名单 `youtube.com`/`youtu.be` + video_id 正则 |
| dev 端口 | `next dev -p 3850`（与 hello-fly 不冲突） |
