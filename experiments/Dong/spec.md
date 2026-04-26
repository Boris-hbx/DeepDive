# Spec: Dong 的 MVP 实现

- 状态：已锁定（2026-04-26 评审通过，进入实现）
- 作者：Dong + Claude（草稿）
- 日期：2026-04-26
- 关联：[`spec/mvp.md`](../../spec/mvp.md)、[`spec/product.md`](../../spec/product.md)

## 目标

本周内跑通一条端到端流水线，每天能在 `experiments/Dong/briefs/` 下产出 1 篇符合 [输出契约](../../spec/mvp.md#输出契约所有人必须一致) 的 brief，并能在本地静态站点预览。优先"跑通"，不追求质量。

## 用户故事

作为 Dong，我打开本地静态站点首页，能看到当日及历史 brief 列表；点进当日 brief 能看到 ≤3 条「最关注的事」+ ≤5 条「值得一看的事」，每条要点可点回原文。

## 验收条件

mvp.md 已有的（沿用）：

- [ ] 至少跑出 1 篇真实数据生成的 brief
- [ ] brief 文件位置和命名符合输出契约（`experiments/Dong/briefs/YYYY-MM-DD.md`）
- [ ] brief 章节结构符合输出契约
- [ ] 每条要点都有可点击的原文链接
- [ ] 当日无重要事件时使用兜底文案
- [ ] 静态站点能本地预览，能从首页点进当天的 brief
- [ ] `experiments/Dong/NOTES.md` 已写
- [ ] 已 push（仅 `experiments/Dong/`）

我自己加的：

- [ ] 一条命令能从零跑出当日 brief（如 `make today` 或 `python -m brief`）
- [ ] 失败可重试：抓取/LLM 调用失败不会让整条流水线崩，会跳过失败源、记录到日志
- [ ] 有一个 `--dry-run` 或类似开关，能只跑抓取+去重、不调 LLM，方便调试

## 输出契约

**完全照搬 [`spec/mvp.md`](../../spec/mvp.md#输出契约所有人必须一致)，本 spec 不做任何变动。**

## 技术栈（**待 Dong 确认**）

> 以下是 AI 给出的建议默认 + 备选。Dong 选定后把"建议"框收掉。

| 维度          | 建议默认                                                         | 备选                             | 备注                                  |
| ------------- | ---------------------------------------------------------------- | -------------------------------- | ------------------------------------- |
| 语言          | Python 3.11+                                                     | Node/TypeScript、Go              | Python 处理 RSS / HTTP / LLM SDK 最顺 |
| LLM           | Anthropic Claude（Sonnet 4.6 默认 / Opus 4.7 用于难点）          | OpenAI、本地模型                 | 团队已在用 Claude Code，API key 复用  |
| LLM 调用      | `anthropic` Python SDK + prompt caching                          | curl 直调、LangChain             | caching 能压成本；本周不引入框架      |
| RSS / HTTP    | `feedparser` + `httpx`                                           | `requests` + `feedparser`        | httpx 支持异步，便于并发抓取          |
| HTML 正文抽取 | `trafilatura` 或 `readability-lxml`                              | 不抽取，直接喂 RSS summary       | 看源是否给全文                        |
| 去重          | URL 规范化 + 标题 fuzzy（`rapidfuzz`）                           | 加 embedding 聚类                | 第一周先简单                          |
| 静态站点      | **方案 A**：纯 Markdown + 一个最小 `index.md` 索引（仓库直接看） | **方案 B**：Astro/11ty 生成 HTML | A 最快跑通；B 美观                    |
| 站点托管      | 本周仅本地预览（`python -m http.server` 或 markdown viewer）     | GitHub Pages                     | mvp.md 没要求托管，本地够             |
| 触发          | 本地手动跑命令                                                   | cron / GitHub Actions            | 本周手跑就够                          |
| 配置          | `config.toml` 或 `sources.yaml`                                  | 写死在代码                       | 信息源清单走配置文件                  |
| 依赖管理      | `uv` 或 `pip + requirements.txt`                                 | poetry                           | uv 最快                               |

**Dong 你需要回答：**

1. 语言选 Python 还是 TypeScript？（决定后续所有依赖）
2. LLM 用 Claude 哪个 model？（Sonnet 4.6 默认够；难点切 Opus）
3. 站点：本周要不要直接接 GitHub Pages，还是只本地跑通？

## 信息源（**待 Dong 筛选，目标 5–10 个**）

候选清单（按"信噪比"粗排）：

**已选定 8 个源**（2026-04-26 锁定，当天修正 1 项 + 当天扩 3 个）：

核心 5（最初锁定）：

- [x] **DeepMind blog** — `https://deepmind.google/blog/rss.xml` _（2026-04-26 替换 Anthropic：实测 Anthropic 无公开 RSS）_
- [x] **OpenAI blog** — `https://openai.com/blog/rss.xml`（实测会重定向到 `/news/rss.xml`，httpx follow_redirects 已处理）
- [x] **Simon Willison's Weblog** — `https://simonwillison.net/atom/everything/`
- [x] **GitHub Blog** — `https://github.blog/feed/`
- [x] **Latent Space (Swyx)** — `https://www.latent.space/feed`

扩 3（2026-04-26 加，按"工程实践 / 行业讨论 / 工具厂商"三个新维度）：

- [x] **Pragmatic Engineer**（Gergely Orosz 工程实践博客）— `https://newsletter.pragmaticengineer.com/feed.xml`
- [x] **Hacker News frontpage**（行业广度信号；噪声多由 ranker 过滤）— `https://news.ycombinator.com/rss`
- [x] **Continue.dev releases**（开源 IDE agent 头部工具的 release atom）— `https://github.com/continuedev/continue/releases.atom`

**未选**（备查）：Cursor blog（无 RSS）、LangChain、Anthropic Twitter、arXiv、Aider releases、Eugene Yan、Lilian Weng、HuggingFace —— 后续按 ranker 信号密度反推增减。
**待解决**：Anthropic 模型/产品动态目前依赖 Simon Willison 转引覆盖，如需直接源得做 HTML scrape。

## 流水线设计（**建议方案，待 Dong 改**）

```
┌──────────┐   ┌────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐
│  fetch   │──▶│ dedup  │──▶│  rank    │──▶│summarize │──▶│ render │
└──────────┘   └────────┘   └──────────┘   └──────────┘   └────────┘
   并发拉取      URL+标题       LLM 评分       LLM 写每条      Markdown
   N 个源       fuzzy           或规则          要点摘要         + index
   写 raw/      去重            打分>=阈值
   今天.json                    才进 brief
```

每步建议落盘到 `experiments/Dong/data/<YYYY-MM-DD>/<step>.json`，便于调试和复跑。

**关键决策点（建议默认）：**

- **重要性判定**：单条用 LLM 给 1–5 分 + 1 句理由；阈值 ≥ 4 进「最关注」、3 进「值得一看」、< 3 丢弃
- **诚实兜底阈值**：当日所有源加起来 ≥ 4 分的条目数为 0 → 用兜底文案
- **链接准确性**：brief 里的每条 URL 必须从 fetch 阶段的原始数据透传，**不让 LLM 写 URL**（避免幻觉）
- **多步 vs 一次性 prompt**：建议多步——先逐条打分+1 句话摘要，再合成 brief；可控性更高

**Dong 你需要：** 这套流水线 OK 吗？哪步你想换思路？

## 工作目录建议

```
experiments/Dong/
├── spec.md              ← 本文件
├── NOTES.md             ← 实践笔记（mvp.md 必交）
├── briefs/              ← 输出物（硬约束位置）
│   └── YYYY-MM-DD.md
├── src/                 ← 代码
├── data/                ← 各步骤中间产物（gitignore 大部分）
│   └── YYYY-MM-DD/
│       ├── raw.json
│       ├── deduped.json
│       └── ranked.json
├── config/
│   └── sources.yaml
├── prompts/             ← prompt 模板（迭代留痕）
└── site/                ← 静态站点（如选 Astro/11ty 才有）
```

`data/` 大部分加 gitignore，但保留 `data/YYYY-MM-DD/ranked.json` 这类"决策痕迹"便于复盘——下周分享会能用。

## 不做什么

- ❌ 自动定时调度（cron / GitHub Actions） — 本周手跑
- ❌ 多用户 / 登录 / 个性化
- ❌ 数据库（中间产物用 JSON 文件就够）
- ❌ 邮件 / IM 推送
- ❌ 历史 brief 全文搜索（首页列表点进去够）
- ❌ 高级去重（embedding 聚类） — 第一周先 fuzzy 标题
- ❌ 在 `experiments/Dong/` 之外动任何文件
- ❌ 引入 multi-agent 编排 / 自定义 sub-agent — CLAUDE.md 明确推迟

## 设计要点 / 约束

- **输出契约硬约束**：brief 文件位置、章节结构、原文链接，一字不改
- **链接不让 LLM 生成**：URL 从抓取阶段透传，避免幻觉
- **失败优雅降级**：单个源抓取失败不影响其他源
- **可复跑**：相同输入 + 相同 prompt（先暂不固定 seed）应能产出基本一致的 brief；中间产物落盘
- **成本可观测**：每跑一次记录 token 消耗（写到 NOTES.md）
- **不引入新依赖前先问**（CLAUDE.md 规则）—— 但本 spec 列出的依赖批准后视为已确认

## 决策定稿（2026-04-26）

1. **技术栈**：Python 3.11+ / **LLM 后端可切换**（默认 Anthropic Claude Sonnet 4.6 / Opus 4.7 难点；OpenAI 兼容协议备选——Gemini / DeepSeek / Kimi / OpenRouter / 自架代理 等同一份代码可接） / **Astro**（站点）
2. **依赖**：spec 列出的全部批准（`anthropic`、`openai`、`feedparser`、`httpx`、`trafilatura`、`rapidfuzz`、`pyyaml`、`uv`、`astro`）
3. **重要性判定**：LLM 打分 + 阈值（≥4 进「最关注」、3 进「值得一看」、<3 丢弃）
4. **prompt 思路**：多步（每条独立打分+1 句摘要 → 合成 brief）
5. **去重粒度**：同一事件多家报道合并成 1 条，取主源
6. **站点托管**：本地预览 + GitHub Pages
7. **跑通节奏**：先做"作弊版"——1 条真实新闻 + 手敲摘要 + 站点本地预览
8. **复跑策略**：每天早上手跑一次

## 实现备忘

> 实现期的元决策快速汇总，**详细原因和经验都在 NOTES.md**。

1. **代理选型踩坑 → 引入 LLM 后端抽象层** — 实测 yibuapi.com 等"Claude Code 共享池"代理与本流水线（纯 LLM 推理）不兼容（注入工具集、忽略 tool_choice）。临时方案是绕走 OpenAI 兼容协议；长期方案是新建 `deep_dive/llm/` 让"换 backend 只改 env"。详 NOTES.md 出乎意料的事 #7、#9；决策见 `docs/decisions.md` 2026-04-26。
2. **JSON 输出从"强制 schema"退到"prompt 引导 + 容错解析"** — `output_config.format` 走兼容代理失效；现状是三层防御（剥 `<thinking>` / 剥 ``` 围栏 / regex 抠字段）+ 单次重试 + graceful skip。详 NOTES.md Prompt 思路。
3. **system prompt 写"够丰满"满足 caching 阈值** — Sonnet 4.6 的 cacheable 前缀最小 2048 token；一开始担心要"凑"，结果按"角色+主题+5 档评分+边界 case+反例"自然写够。实测命中率 40%。
4. **graceful skip 而非 fail-fast** — 单条 LLM 解析失败 warn 后跳过，整批不挂。这是自加验收条件 #2 的兑现，也匹配 spec 设计要点「失败优雅降级」。
5. **`deep_dive run` 一键命令** — 把 fetch → dedup → rank → summarize → render 串起来，兑现自加验收条件 #1。分步命令保留供调试。
6. **作弊版输出物 vs 真版的隔离没做** — 自动 render 会冲掉手敲 brief 和真 LLM 产出的 ranked.json，这周靠 git restore 救场。下次该把 dry-run 输出走单独路径。详 NOTES.md 如果再来一次 #5。
7. **GH Pages 工作流是仓库根级文件** — `.github/workflows/deploy-dong-pages.yml` 不在 `experiments/Dong/` 下，严格 reading 团队 mvp.md 「仅在子目录下」可能需要 PM exception。需在群里同步。
8. **observation 二次提炼从独立产物 → 合并进 brief** — 起初做了 `observe` 模块产 `observations/<date>.md` 单独文件 + 站点详情路由，后发现内容简介与 brief 的 `long` 段冗余。改为在 brief 「最关注」每条下挂 `<details>` 折叠块（含 key_points + implications），由 summarize 一次 LLM 调用同时产出 4 个字段。spec 输出契约的必有结构未变，details 是扩展。已删除独立 `observe.py` / `observe_system.md` / `observations/` 目录 / 站点 observation 路由。
