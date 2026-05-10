# boris-deepdive-dailyreport

Boris 子线 web 应用。把 `daily-report/*.md` 统一渲染 + 接受 YouTube URL 实时分析。

完整设计见 [`../spec/001-web-app.md`](../spec/001-web-app.md)。
偏离 mvp.md 「无动态后端」限制的理由见 [`/docs/decisions.md`](../../../docs/decisions.md) 2026-04-26 条目。

## 本地开发

```bash
cd experiments/Boris/site
npm install
cp .env.example .env.local   # 然后填入真实 ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3850
```

## 构建

```bash
npm run build
npm start                    # 默认 3000；fly 容器中 PORT 由 fly.toml 注入
```

## 部署

**已上线：** https://boris-deepdive-dailyreport.fly.dev/

布局要点：
- `fly.toml` + `.dockerignore` 在 `experiments/Boris/`（fly build context）
- `Dockerfile` 在 `experiments/Boris/site/Dockerfile`，但路径相对 context root（`COPY site/ ./` 等）
- `daily-report/*.md` 与 `prompts/analyze_system.md` 在 build 时 COPY 到 image 的 `/app/data/`，Dockerfile 用 `REPORTS_DIR` / `PROMPTS_DIR` env 暴露给 lib 代码

```bash
# 首次：设 API key（Boris 自己跑，key 不进 chat / 不进 git / 不进 image）
fly secrets set ANTHROPIC_API_KEY=sk-ant-... -a boris-deepdive-dailyreport

# 部署（在 experiments/Boris/ 下跑，不是 site/）
cd experiments/Boris
fly deploy --remote-only
```

`--remote-only` 用 fly 的远程 builder，不需要本地 Docker。

App name：`boris-deepdive-dailyreport` · region `nrt` · VM `shared-cpu-1x` 512MB · `auto_stop_machines = stop`（idle 自动停机）

## 安全

- `ANTHROPIC_API_KEY` **永远**只通过 `fly secrets` 或本地 `.env.local`（gitignored）注入，绝不进 git/image/客户端 bundle
- `/api/analyze-video` 限制：URL 长度 ≤ 200、域名白名单 youtube/youtu.be、per-IP 5/min、全局 3 并发

## 目录路标

```
experiments/Boris/
├── fly.toml                ✓ D+3
├── .dockerignore           ✓ D+3
├── daily-report/*.md       ← source of truth（Dockerfile COPY 进 image）
├── prompts/analyze_system.md  ← talk-report system prompt
└── site/
    ├── Dockerfile          ✓ D+3 multi-stage standalone
    ├── package.json        ✓
    ├── next.config.ts      ✓ output: 'standalone'
    ├── src/app/
    │   ├── layout.tsx      ✓ D0
    │   ├── globals.css     ✓ D+1 port variant-b-v2
    │   ├── (reports)/
    │   │   ├── layout.tsx  ✓ D+1 TopBar + Sidebar 共享 chrome
    │   │   ├── page.tsx    ✓ D+1 / 重定向最新 slug
    │   │   └── reports/[slug]/page.tsx  ✓ D+1
    │   ├── analyze/page.tsx            ✓ D+2 client form
    │   └── api/analyze-video/route.ts  ✓ D+2 POST + 限流 + pipeline
    └── src/lib/
        ├── reports.ts      ✓ D+1 扫 md，env REPORTS_DIR 可覆盖
        ├── markdown.ts     ✓ D+1 marked + 外链 _blank
        ├── youtube.ts      ✓ D+2 video_id 提取 + 字幕抓取 + 清洗
        ├── claude.ts       ✓ D+2 Anthropic SDK，env PROMPTS_DIR 可覆盖
        └── rateLimit.ts    ✓ D+2 内存 token bucket + 全局并发
```
