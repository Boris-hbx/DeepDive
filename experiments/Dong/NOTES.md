# Dong 的实践笔记

> 下周分享会的素材。边做边补，作弊版完成时起手。
> 状态：作弊版打通，Python 流水线起步中。

## 技术栈

| 维度 | 选择 |
|---|---|
| 语言 | Python 3.11+ |
| 包管理 | uv |
| LLM | **可切换后端**：默认 Anthropic Claude（Sonnet 4.6 / Opus 4.7 难点），OpenAI 兼容协议备选（Gemini / DeepSeek / Kimi / OpenRouter / 自架代理） |
| LLM SDK | `anthropic` + `openai`（同时装；按 `LLM_BACKEND` env 选） |
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

首跑 2026-04-26（5 源 → 1078 raw → 27 deduped → 11 summaries → 1 brief）：

| 阶段 | 耗时 | input | cache_read | output | 备注 |
|---|---|---|---|---|---|
| fetch | <30s | — | — | — | 5 源全 200 |
| dedup | <1s | — | — | — | 1078→27（window=3 天）|
| **rank** (Opus 4.6, 27 次) | **5:29** | 32,598 | 13,134 | 12,075 | 1 次 SDK 自动重试，27/27 成功 |
| **summarize** (Opus 4.6, 11 次) | **2:51** | 12,917 | 5,122 | 7,735 | 1 次 SDK 自动重试，11/11 成功 |
| render | <1s | — | — | — | 纯 Python |
| **LLM 阶段合计** | **8:20** | **45,515** | **18,256** | **19,810** | cache 命中 **40%** |

按 Anthropic Opus 4.6 标牌价（input $5/1M, output $25/1M）粗估 **<$0.7**。代理实际计费看 yibuapi dashboard。

观察：
- 每条 output 偏多（300-700 tokens），主因是 Opus 4.6 默认开 thinking 把推理内容包在 `<thinking>` XML 里 inline 返回；`reasoning_effort=none` 被代理忽略关不掉
- cache 命中率 40% 说明代理透传了 OpenAI 兼容协议下的 prompt caching；首条写、后续读
- 主要瓶颈在 LLM 调用（rank+summarize 各占一半），fetch/dedup/render 加起来不到 1 秒——**真要并发 LLM 调用，时间能再压一半**
- 第一次完整跑通后做横向对比：和 dry-run 跑出来的 mock brief 比，真 LLM 把 8 条 Codex 文档**正确合并降权到 score=2**（mock 全打 4 分），单这一点就证明真 LLM 的 rank 远比规则强

## 出乎意料的事

1. **Astro 5 的 `import.meta.glob` 跨目录吃 markdown** 比想象中顺。`site/src/pages/index.astro` 直接 `glob('../../../briefs/*.md', { eager: true })` 就拿到全部，连 content collection 都不用配。
2. **macOS 装了全局 `http_proxy` 把 localhost 也代理了**，curl 验证一直 502，要 `--noproxy '*'` 才能走本地。这种"环境配置外溢"会咬死自动化测试，未来要在 README 显式提醒。
3. **AI 协作的"作弊版优先"心智** 比想象中重要。spec 里第 6 条开放问题选了"先 1 篇手敲打通端到端"，效果是半小时端到端有结果，比先铺架构爽得多——AI 协作下"快速把信号回路闭合"的价值放大了。
4. **Anthropic 没公开 RSS**，而且踩这个坑的代价是直到 fetch 跑起来才发现——spec 里讨论"信息源选哪 5 个"时根本没人想到去 ping 一下 URL。教训：spec 里的"已选定 5 个核心源"应该带 health check（`curl -I` 200 OK）作为锁定前置条件。
5. **OpenAI RSS 是历史全量**（实测 918 条），DeepMind 100 条也偏多。两天窗口能压到 7 条但漏掉 04-23 的 GPT-5.5 主公告（核心信号），三天窗口拿到 27 条且关键信号齐——所以默认 `--window-days=3`。
6. **同一时间戳批量发布**会让 dedup 错把"一次文档站发布"当 N 条独立信号：04-23 10:00 OpenAI 一次性推了 8 条 Codex 文档到 RSS。标题 fuzzy 匹配抓不住（标题都不一样），但靠"同源 + 同时戳" 可以。这条留给 rank 阶段用 LLM 处理（让模型理解"这 8 条是同一事件"），先不在 dedup 里硬编码规则。
7. **"Claude API 中转代理"分两类，长得一样但本质不同**：(a) **API 转发型**——按 token 计费，纯透明转发，能用；(b) **Claude Code 共享池型**（如 yibuapi.com）——背后是转售 Claude Pro 终端额度，给每个请求强行注入 Claude Code 工具集、替换 system prompt、忽略 `tool_choice=none`，从客户端**完全无法绕开**。我们撞上了 (b)，用 9 种请求形状全失败。教训：选代理时关键词要找"Anthropic API 中转 按量计费"，**不要**找"Claude Code 包月共享"。这次踩坑的直接产物是引入了 LLM 后端抽象层（`deep_dive/llm/`），从此换 backend 只改 env 不改代码。
8. **过度抽象的诱惑 vs 踩坑后的正确投资**：在写第一版 rank.py 时我没做后端抽象，因为"现在只用 Anthropic"。yibuapi 坑出现后才补抽象层——~150 行代码，但回报是"以后任何代理 / 模型问题都只动 env"。教训：**当你预计可能要换/对比某个组件时**，抽象不算过度设计；**当你 pretty sure 不会换**时，YAGNI 优先。这次的判断点是"团队还在评估模型"——抽象就值得。
9. **同一个代理走不同协议端点结果完全不同**：yibuapi.com 走 Anthropic 原生协议（`/v1/messages`）被它注入 Bash 工具集导致永远返回 `tool_use`；切到 OpenAI 兼容协议（`/v1/chat/completions`）后正常工作——OpenAI 协议无 `tool_use` 概念，代理无从注入。这意味着 LLM 抽象层不只是"换厂商"用，**同一个厂商的不同 API 协议端点也能用来绕坑**。代价：失去 Anthropic 独占特性（messages.create 的细节、cache_control 显式控制），但 OpenAI 兼容协议下 prompt caching 仍透传（实测命中率 40%）。
10. **OpenAI 兼容代理把 Anthropic thinking 内容 inline 在 `<thinking>` XML 里返回**：Claude Opus 4.6 默认开 adaptive thinking，走 OpenAI 兼容协议时代理把推理内容用 `<thinking>...</thinking>` 标签 inline 进文本响应。我们 `_extract_json` 必须先剥这个块再找 JSON。`reasoning_effort=none` 参数代理直接忽略，关不掉 thinking。
11. **中文 long 摘要里模型容易用未转义双引号做强调**（"模型卡死"），破坏 JSON 边界让 `json.loads` 挂掉。两层防御：(a) summarize prompt 加引号禁令告诉模型"用中文「」/《》代替"；(b) 解析失败时 fallback 用 regex 直接抠 short/long 字段。两条单独都不够稳，叠加才行。

## 如果再来一次

> 这一周踩坑 / 顺手 / 反思的总结，按"该改 vs 该坚持"两类。

### 该改的

1. **spec 锁定前先 ping 一遍信息源 / API URL**——这周两次踩坑都是"spec 锁定后才发现前提失效"：
   (a) Anthropic 锁进 5 源后 fetch 才发现没公开 RSS；
   (b) yibuapi 配进 .env 才发现是 Code 共享池不是 API 中转。
   每次成本：半天到一天的回退 + 决策记录。
   投入：spec 锁定前 30 秒 `curl -I <url>` + 看代理官网"按 token 还是按月"。
   **30 秒 vs 半天**——下次必做。

2. **抽象层早做，在引入第二个候选前**——rank.py 第一版直接 `from anthropic import Anthropic`，撞上 yibuapi 才补 `deep_dive/llm/`。补抽象的成本不大（150 行），但**重写两个调用点 + 文档对齐 + 改 .env 模板** 比一开始就分层贵。规则：**当你预计 6 个月内可能换某个组件，第一版就分层**。

3. **真 LLM 跑通要早，别等所有阶段写完**——我把 rank → summarize → render 全写完才第一次跑真 LLM。结果一次性暴露了 yibuapi 工具注入、`<thinking>` 包裹、JSON 引号失误三个问题，调一晚上。如果作弊版完工后**第二天就跑真 LLM 单测 rank**，问题会分散在不同时间出现。

4. **prompt 输出格式默认走"无 schema 强制"假设**——`output_config.format` 在 Anthropic 直访可靠，走兼容代理立刻失效。下次直接默认"prompt 引导 JSON + parser 容错（剥围栏 / 剥 thinking / regex fallback）"，不要先吃强制 schema 的甜头再痛苦回退。

5. **作弊版输出物要和真版隔离**——首次自动 render 直接冲掉了我手敲的 brief（git 还在但 working tree 没了），差点丢 truth source。下次：作弊版输出走不同文件名（如 `cheat-YYYY-MM-DD.md`），或者 render 写前检查"目标是否被手动改过"。

6. **NOTES.md 当工作日志写，不要事后补**——「出乎意料的事」我都是事后回忆补的，肯定漏了细节。下次每跑通一个阶段当场写两行。

### 该坚持的

7. **dry-run 是必备而非可选**——rank/summarize 都带 `--dry-run` 用 mock 跑通管道，让我在没 API key 时验证下游逻辑、在 yibuapi 排错时不烧 quota 验证 brief 渲染。这是这周最关键的工程决策之一。

8. **作弊版优先**——spec 第 6 条开放问题选了"先 1 篇手敲打通端到端"。半小时见到端到端结果带来的心理安全感，比按部就班铺架构强 10 倍。下个项目继续这么干。

9. **输出契约硬约束 + 其他全自由**——MVP spec 只锁 brief 文件位置和章节结构，技术栈/信息源/流水线全交给个人。这让我能"边做边换思路"（dedup 改窗口、加 fallback parser、换 backend）而不破坏对外承诺。下周 8 人横向对比也能对得上。

10. **spec-first 流程值回票价**——8 次决策点（信息源、技术栈、是否抽象、yibuapi 解决方案、Gemini vs DeepSeek、…）每次都是先列选项再问 Dong 拍板，避免了 AI 自说自话走偏。代价是来回多几次，但每次都是正确决策。下次照搬。

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

环境变量（详细配置见 `.env.example`）：

| 变量 | 何时必需 | 说明 |
|---|---|---|
| `LLM_BACKEND` | 可选 | `anthropic`（默认）或 `openai` |
| `ANTHROPIC_API_KEY` | backend=anthropic 时 | Anthropic 或兼容代理的 key |
| `ANTHROPIC_BASE_URL` | 走代理时 | 代理 URL |
| `OPENAI_API_KEY` | backend=openai 时 | Gemini / DeepSeek / Kimi 等的 key |
| `OPENAI_BASE_URL` | backend=openai 时 | 提供商对应 URL |
| `OPENAI_MODEL` | backend=openai 时 | 模型名（每家不同） |

CLI 也支持 `--backend anthropic|openai` 临时覆盖 env。

加载顺序：`cli.py` 启动时读 `experiments/Dong/.env` 注入 `os.environ`，**shell 里已 export 的优先**（方便临时调试用别的 key）。`.env` 已被 `.gitignore` 排除。
