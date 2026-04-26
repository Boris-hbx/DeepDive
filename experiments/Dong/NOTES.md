# Dong 的实践笔记

> 下周分享会的素材。边做边补，作弊版完成时起手。
> 状态：作弊版打通，Python 流水线起步中。

## 技术栈

| 维度 | 选择 |
|---|---|
| 语言 | Python 3.11+ |
| 包管理 | uv |
| LLM | Anthropic Claude — Sonnet 4.6 默认 / Opus 4.7 难点 |
| LLM SDK | `anthropic`（带 prompt caching） |
| HTTP | `httpx` |
| RSS 解析 | `feedparser` |
| 正文抽取 | `trafilatura`（按需） |
| 去重 | URL 规范化 + `rapidfuzz`（标题 fuzzy）|
| 配置 | YAML（`pyyaml`） |
| 静态站点 | Astro 5 |
| 站点托管 | 本周本地预览 + 顺带 GitHub Pages |
| 触发 | 本地手跑 `uv run python -m deep_dive ...` |

为什么这样选：
- Python 处理 RSS / HTTP / LLM SDK 生态最顺；不引入 LangChain 等编排框架，本周保持手感
- Astro 的 `import.meta.glob` 直接吃 `../briefs/*.md`，零配置就能列+渲染
- 全程不上数据库；中间产物 JSON 落盘 → 任何步骤都能独立重跑

## 信息源

第一版 5 源（2026-04-26 锁定，当天即修正 1 项）：

| 源 | URL | 选它的理由 |
|---|---|---|
| DeepMind blog | `https://deepmind.google/blog/rss.xml` | 模型/产品官方动态（**替补 Anthropic**）|
| OpenAI blog | `https://openai.com/blog/rss.xml` | 模型/产品官方动态 |
| Simon Willison's Weblog | `https://simonwillison.net/atom/everything/` | 高密度 LLM/agent 工程实践，实测单日 3+ 篇是常态 |
| GitHub Blog | `https://github.blog/feed/` | Copilot / Agents 类产品动态 |
| Latent Space (Swyx) | `https://www.latent.space/feed` | agent / AI infra 行业讨论 |

未选（备查）：HN front page、Pragmatic Engineer、LangChain、Cursor、Anthropic Twitter、arXiv —— 第一周先收敛 5 源，避免噪声压力过大；后续每天复盘后增减。

**踩坑**：Anthropic 没公开 RSS（实测 `/news/rss.xml`、`/feed.xml`、`/rss`、`/feed` 等 7 个常见路径全 404）。Anthropic 的官方动态目前靠 Simon Willison 转引覆盖；如需直接源，得做 HTML scrape，本周不做。

## 流水线设计

```
fetch (并发)  →  dedup  →  rank (LLM 1-5 分)  →  summarize (LLM)  →  render
                                                                    (Markdown + Astro)
```

每步落盘到 `data/<YYYY-MM-DD>/<step>.json`：

- `raw.json`（fetch 后，所有源原始条目）
- `deduped.json`（dedup 后）
- `ranked.json`（每条带 1-5 分 + LLM 给的 1 句理由，**保留作为决策痕迹**）
- `summaries.json`（每条 1-2 句摘要）
- 最终：`../briefs/<YYYY-MM-DD>.md`

**关键约束：** brief 里的每条 URL **必须**从 fetch 阶段透传，**不让 LLM 写 URL**（防幻觉）。

## Prompt 思路

（实现 rank/summarize 阶段后填）

预想：多步分解。先逐条 rank（give a score 1-5 + 一句理由），再逐条 summarize（1-2 句中性摘要），最后合成 brief 时只做"取前 N 条 + 写一句话总摘要 + 套模板"，不让 LLM 自由发挥。

## 成本 / 时延

（待跑过完整流水线后填）

记录维度：
- 每跑一次的总 token（input/output 分开）
- 每跑一次的耗时（fetch / LLM / render 各占多少）
- 用 prompt caching 后的命中率

## 出乎意料的事

1. **Astro 5 的 `import.meta.glob` 跨目录吃 markdown** 比想象中顺。`site/src/pages/index.astro` 直接 `glob('../../../briefs/*.md', { eager: true })` 就拿到全部，连 content collection 都不用配。
2. **macOS 装了全局 `http_proxy` 把 localhost 也代理了**，curl 验证一直 502，要 `--noproxy '*'` 才能走本地。这种"环境配置外溢"会咬死自动化测试，未来要在 README 显式提醒。
3. **AI 协作的"作弊版优先"心智** 比想象中重要。spec 里第 6 条开放问题选了"先 1 篇手敲打通端到端"，效果是半小时端到端有结果，比先铺架构爽得多——AI 协作下"快速把信号回路闭合"的价值放大了。
4. **Anthropic 没公开 RSS**，而且踩这个坑的代价是直到 fetch 跑起来才发现——spec 里讨论"信息源选哪 5 个"时根本没人想到去 ping 一下 URL。教训：spec 里的"已选定 5 个核心源"应该带 health check（`curl -I` 200 OK）作为锁定前置条件。
5. **OpenAI RSS 是历史全量**（实测 918 条），DeepMind 100 条也偏多。两天窗口能压到 7 条但漏掉 04-23 的 GPT-5.5 主公告（核心信号），三天窗口拿到 27 条且关键信号齐——所以默认 `--window-days=3`。
6. **同一时间戳批量发布**会让 dedup 错把"一次文档站发布"当 N 条独立信号：04-23 10:00 OpenAI 一次性推了 8 条 Codex 文档到 RSS。标题 fuzzy 匹配抓不住（标题都不一样），但靠"同源 + 同时戳" 可以。这条留给 rank 阶段用 LLM 处理（让模型理解"这 8 条是同一事件"），先不在 dedup 里硬编码规则。

## 如果再来一次

（待复盘）

## 跑步指南（自用）

```bash
# 第一次安装
cd experiments/Dong && uv sync

# 配置 LLM 凭证（首次）—— 见下面「环境变量」一节
cp .env.example .env
# 编辑 .env 填 ANTHROPIC_API_KEY（+ 走代理时也填 ANTHROPIC_BASE_URL）

# 端到端跑当日 brief
uv run python -m deep_dive fetch
uv run python -m deep_dive dedup
uv run python -m deep_dive rank          # 加 --dry-run 不调 LLM
uv run python -m deep_dive summarize     # 加 --dry-run 不调 LLM
uv run python -m deep_dive render        # 不调 LLM

# 跑站点（本地预览）
cd site && npm run dev

# 全量构建（输出 site/dist/）
cd site && npm run build
```

环境变量：

| 变量 | 必需 | 说明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | rank / summarize 阶段必需（render / fetch / dedup 不需要） | Anthropic 或代理给的 key |
| `ANTHROPIC_BASE_URL` | 走第三方代理时必需 | 代理域名 + `/v1`，例如 `https://example.com/v1` |

加载顺序：`cli.py` 启动时读 `experiments/Dong/.env` 注入 `os.environ`，**shell 里已 export 的优先**（方便临时调试用别的 key）。`.env` 已被 `.gitignore` 排除。
