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

第一版 5 源（2026-04-26 锁定）+ 当天扩 3 源 = 8 源：

| 源 | URL | 选它的理由 |
|---|---|---|
| DeepMind blog | `https://deepmind.google/blog/rss.xml` | 模型/产品官方动态（**替补 Anthropic**）|
| OpenAI blog | `https://openai.com/blog/rss.xml` | 模型/产品官方动态 |
| Simon Willison's Weblog | `https://simonwillison.net/atom/everything/` | 高密度 LLM/agent 工程实践 |
| GitHub Blog | `https://github.blog/feed/` | Copilot / Agents 类产品动态 |
| Latent Space (Swyx) | `https://www.latent.space/feed` | agent / AI infra 行业讨论 |
| Pragmatic Engineer | `https://newsletter.pragmaticengineer.com/feed.xml` | _2026-04-26 加_：Gergely Orosz 工程实践视角，与 Simon 互补 |
| Hacker News frontpage | `https://news.ycombinator.com/rss` | _2026-04-26 加_：行业讨论广度；噪声多，靠 ranker 过滤（实测 30 条 HN frontpage 中 ~24 条被 score=1 滤掉，1 条 SWE-bench 信号 score=4） |
| Continue.dev releases | `https://github.com/continuedev/continue/releases.atom` | _2026-04-26 加_：开源 IDE agent 头部工具的 release atom |

未选（备查）：Cursor blog（无 RSS）、LangChain、Anthropic Twitter、arXiv、Aider releases、Eugene Yan、Lilian Weng、HuggingFace —— 后续按 ranker 信号密度反推增减。

**踩坑**：
- Anthropic 没公开 RSS（实测 7 个常见路径全 404）。靠 Simon Willison 转引覆盖；要直接源得做 HTML scrape。
- **fetch 网络不稳定**：实测过相同 .env 配置三次跑 fetch，每次失败的源都不同（SSL handshake timeout / Connection reset by peer 各种）。已加 per-source retry（max 3 attempts，1s/2s/4s 指数 backoff），实测让"间歇性 SSL 失败"基本被 retry 救回。

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

> 实战回填（2026-04-26 端到端跑通后）。

### 整体策略：多步分解 + system 缓存

不让 LLM 一次性做"读 27 条 → 选 3 条 → 写完整 brief"，而是拆 4 步，每步只做一件清晰的事：

| 步骤 | LLM 调用次数 | 输入 | 输出 |
|---|---|---|---|
| rank | N=27（每条独立） | 单条原始 RSS 条目 | `{score: 1-5, reason: 一句话}` |
| summarize | M=11（仅 score≥3） | 单条 ranked + 源摘要 | `{short: ≤30字, long: 60-150字}` |
| render | 0（纯 Python） | 全部 summaries | brief Markdown |

理由：
- **可控性**：单次任务越简单，模型越听话；让模型一次性吐 brief 容易出现幻觉、漏链接、JSON 截断
- **可复跑**：哪一步失败重跑哪一步，不用从头来
- **缓存友好**：system prompt 在每步内是固定的，每步内 N-1 次缓存命中（实测 cache_read 命中率 40%）

### system prompt 设计

每步 system prompt **写"够丰满"**，刻意做到 ≥ 2048 token（Sonnet 4.6 的 cacheable prefix 阈值）。这不是"为缓存而冗长"——把"角色 + 主题定义 + 评分/摘要标准 + 边界 case + 示例"都塞进 system 本来就该是这样写。

具体来说每个 system 都包含：
- **角色 + 项目背景**：让模型知道它在替谁工作（"DeepDive 团队的信号筛选员/摘要员"）
- **主题边界**：什么算 Agentic SE 内 / 外 / 边缘（节省后续每条都要解释）
- **评分/摘要原则**：5 档评分含义 + 边界案例 + 评分原则（用例：批量发布、第三方转引、过期信号）
- **输出格式**：JSON schema + 示例
- **反向负面例子**：什么是 ❌ 不合格（比直接说"应该这样"更有效）

效果：rank 把 8 条 OpenAI Codex 文档批量发布**正确合并降权到 score=2**（mock 直接关键词命中全打 4），靠的就是 system prompt 里那条「同源 + 同时戳的批量发布按文档站事件聚合视角降级」。

### user prompt 设计

每条只放变化的部分：source / title / URL / published_iso / 源 RSS 摘要 / ranker 给的分数。开头加 `今日日期（UTC）：YYYY-MM-DD`——这是在排查 yibuapi 时发现的"模型为查日期去调 bash 工具"问题的预防针。结尾收一句 `直接返回 JSON，不要任何前后文字、不要代码块标记、不要调用任何工具`，把"想用工具/想加 prose"的倾向压住。

### 输出格式：从"强制 schema"退到"prompt 引导 + 容错解析"

最初版用 `output_config={"format": {"type": "json_schema", ...}}`（Anthropic 结构化输出）。

走兼容代理后**全部失效**：
- 代理把请求当 Claude Code 用，强行注入 Bash 工具；
- Anthropic adaptive thinking 内容被代理 inline 在 `<thinking>...</thinking>` XML 里返回；
- 中文 long 摘要里模型偶尔用未转义双引号做强调（"模型卡死"）破坏 JSON。

最后稳定的姿势：
1. **prompt 引导**：在 system + user 都写明 schema 字段名 + 类型 + 长度限制
2. **解析三层防御**：
   a. 剥 `<thinking>...</thinking>` 块（regex）
   b. 剥 ` ```json ... ``` ` 围栏
   c. 找最外层 `{...}`（regex）
   d. `json.loads` 失败 → 用更松散的 regex 直接抠 short/long 字段
3. **重试**：每条最多重试 1 次
4. **graceful skip**：还失败的条目记 warn 跳过，整批不挂

### 对 LLM 自由度的态度

整套设计的隐含原则：**不让 LLM 写决定 brief 形态的东西**。

- URL 不让 LLM 写（防幻觉）—— render 阶段从 fetch 透传
- "最关注 vs 值得一看"由 score 阈值决定，不让 LLM 自己分类
- 标题、来源、链接全部从结构化字段拼，不是 LLM 重写
- 一句话总摘要的"今天最值得关注的方向"由 render 用 top-1 标题套，不让 LLM 写

LLM 只做两件事：评分 + 摘要。其他全是规则。这是本周最重要的工程判断。

### Prompt caching 实测

Anthropic 直访（spec 默认）和 yibuapi 走 OpenAI 兼容协议都验证了 caching 透传。命中率 40%（首条写、后续读）。Sonnet 4.6 cacheable 前缀最小 2048 token，本来担心 system 不够长——结果按"丰满"标准写够了，不是 caching 强制写长，是丰满刚好满足。

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

第二跑 2026-04-27（**扩到 8 源** + summarize 合并 4 字段后第一跑）：

| 阶段 | 耗时 | input | cache_read | output | 备注 |
|---|---|---|---|---|---|
| fetch（8 源 + retry）| ~30s | — | — | — | 8 源全 200，4 次自动 retry 救场 |
| dedup | <1s | — | — | — | 1138→42（HN 加进来后 +15 条进窗口） |
| **rank** (Opus 4.6, 42 次) | **7:33** | 48,159 | 19,516 | 12,240 | 41/42 成功（1 跳过），cache 命中 40% |
| **summarize** (Opus 4.6, 11 次) | **12:10** | 13,358 | 5,597 | 7,153 | 10/11 成功（1 跳过），summarize 合并 4 字段未明显增 token |
| render | <1s | — | — | — | 纯 Python |
| **LLM 阶段合计** | **~20 分钟** | **61,517** | **25,113** | **19,393** | cache 命中 **41%** |

观察：
- HN 进来后 dedup 从 27 条变 42 条（+15）。其中 24 条 HN 条目 ranker 几乎全部打 score=1（Mahjong / Alzheimer's / 硬件等无关条目），正确识别。HN 净贡献的 agentic SE 信号是 1 条 SWE-bench score=4。
- Pragmatic Engineer 1 条入选 score=3（"AI token spending out of control"），稳定贡献。
- Continue.dev releases 0 条进窗口（最近无 release）。
- summarize 阶段 12:10 比首跑 2:51 长很多——主要原因是 yibuapi 触发了多次限速（SDK 自动 backoff），不是 prompt 改动本身的成本。
- summarize 合并 4 字段后单条 output 增长不明显（避免了之前 observe 的多余 LLM 调用，整体反而省）。

观察：
- 每条 output 偏多（300-700 tokens），主因是 Opus 4.6 默认开 thinking 把推理内容包在 `<thinking>` XML 里 inline 返回；`reasoning_effort=none` 被代理忽略关不掉
- cache 命中率 40% 说明代理透传了 OpenAI 兼容协议下的 prompt caching；首条写、后续读
- 主要瓶颈在 LLM 调用（rank+summarize 各占一半），fetch/dedup/render 加起来不到 1 秒——**真要并发 LLM 调用，时间能再压一半**
- 第一次完整跑通后做横向对比：和 dry-run 跑出来的 mock brief 比，真 LLM 把 8 条 Codex 文档**正确合并降权到 score=2**（mock 全打 4 分），单这一点就证明真 LLM 的 rank 远比规则强

### 兜底文案实测

构造空数据日（2099-01-01 raw.json + summaries.json 都为 `[]`），跑 `python -m deep_dive render --date 2099-01-01`，输出符合 spec/mvp.md 的兜底契约：

```
# Daily Brief — 2099-01-01

> 今日无重要事件。
>
> 数据源：5 个 / 已扫条目：0 / 入选条目：0

## 说明

今日扫描的 5 个源中，没有达到入选标准的事项。明天再来。
```

测试 artifact 验证后已删除。生产场景兜底触发条件：所有 raw 条目经 dedup → rank → summarize 后没有 score ≥ 3 的入选；render 看到 summaries 为空就走 fallback。

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

## 对 mvp.md 6 个开放问题的回答

> mvp.md 末尾"开放问题"6 条 —— 每人各自回答，分享会对比用。

### 1. 抓取阶段怎么处理失败 / 限流？

- **RSS 源**：每源独立 try/except，单源失败记 warn 跳过，其他源继续；httpx `follow_redirects=True` 处理 OpenAI 的 307 重定向到 `/news/rss.xml`
- **LLM 限流（429）**：OpenAI backend 主动节流（`OPENAI_MIN_REQUEST_INTERVAL` 秒间隔）+ 解析错误体里的 `retryDelay` 字段做长 sleep + 重试 3 次；单条最终失败 → graceful skip
- **未踩坑**：5 个 RSS 源都没限流；Gemini Free Tier 撞过 RPM/RPD 双重限制

### 2. 去重用什么策略？

四层叠加，从粗到细：
1. **日期窗口过滤**（默认 3 天）：先把 OpenAI 这种"918 条历史全量"砍到几十条
2. **URL 规范化**（小写 host、去 fragment、去 utm_*/ref/fbclid 等 tracking 参数、去末尾斜杠）+ 精确去重
3. **标题 fuzzy**（rapidfuzz `token_set_ratio` ≥ 85）—— 同事件不同源的转引（极少）
4. **同事件批量发布**：交给 LLM rank 阶段处理（system prompt 里写"同源同时戳的批量发布按聚合视角降级"），实测 8 条 OpenAI Codex 文档被识别合并降权到 score=2

未做：embedding 聚类——spec 明确推迟。

### 3. "重要性"如何判定？

**LLM 评分 + 阈值**，不混合规则：

- 每条独立调 LLM 输出 `{score: 1-5, reason: 一句话}`
- system prompt 详写：5 档定义、边界 case（边缘相关 / 不在范围）、6 条评分原则（新颖性优先权威性、批量发布合并、过期信号降级、不确定时倾向低分等）
- 阈值：≥4 「最关注」/ =3 「值得一看」/ <3 丢弃；空数据时走兜底文案

为什么不混规则：spec 明确"什么算重要交给每人定义" → 全交给 LLM 让定义体现在 prompt 里，规则会让边界 case 变难调

### 4. 如何确保每条要点原文链接准确（不串源、不幻觉 URL）？

**URL 全程从 fetch 阶段透传，LLM 看到 URL 但不写 URL**：

- fetch → raw.json：URL 是 `feedparser` 拿的源 RSS `link` 字段，原值
- rank/summarize 的输入 user prompt 里有 URL，但**output schema 不含 URL 字段**（rank 输出 score+reason，summarize 输出 short+long）
- prompt 里明确："不要在 short 或 long 里放 URL"
- render 阶段从 summaries.json 的 `url` 字段直接拼 markdown 链接，零 LLM 介入

这是本周最重要的工程判断之一（详见 NOTES.md Prompt 思路 → LLM 自由度）。

### 5. Prompt 一次性出 brief vs. 多步分解，哪个更好？

**多步分解，明显胜出**。

拆成 rank → summarize → render，理由：
- 单次任务越简单模型越听话；一次性吐 brief 容易出 JSON 截断、漏链接、漏分类
- 中间产物落盘 → 任意步独立可重跑（实测 yibuapi 排错时只重跑 rank 不需要重 fetch）
- system prompt 在每步内是固定的 → caching 命中率 40%

代价：N 次调用比 1 次贵 token、慢，但本任务（27 条）成本仍 <$0.7。

### 6. 静态站点用什么工具？

**Astro 5**。

- `import.meta.glob('../../../briefs/*.md', { eager: true })` 直接吃跨目录 markdown，零 content collection 配置
- 默认 SSG（无运行时），适合 GitHub Pages
- `base` + `trailingSlash: 'always'` 让子路径部署（`/DeepDive/Dong/`）干净

部署：本地 `npm run dev`（开发）+ GH Actions push 到 `gh-pages/Dong/`（公开预览，等 Boris 启 Pages）。

未选 11ty / 手写 HTML / 纯 Markdown viewer：Astro 的"接近零配置就有像样默认样式"对一周 MVP 最划算。

---

## 跑步指南（自用）

```bash
# 第一次安装
cd experiments/Dong && uv sync

# 配置 LLM 凭证（首次）—— 见下面「环境变量」一节
cp .env.example .env
# 编辑 .env 填 ANTHROPIC_API_KEY（+ 走代理时也填 ANTHROPIC_BASE_URL）

# 端到端跑当日 brief（一键）
uv run python -m deep_dive run            # 加 --dry-run 走 mock 不调 LLM

# 或分步（调试时用）
uv run python -m deep_dive fetch
uv run python -m deep_dive dedup
uv run python -m deep_dive rank          # 加 --dry-run 不调 LLM
uv run python -m deep_dive summarize     # 加 --dry-run 不调 LLM
uv run python -m deep_dive render        # 不调 LLM

# 注：之前曾有独立 `observe` 子命令产 observations/<date>.md，
# 后来发现与 brief 内容冗余，已合并到 brief 的「最关注」每条下的 <details> 折叠块。
# summarize 一次 LLM 调用同时产 short / long / key_points / implications 四个字段。

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
