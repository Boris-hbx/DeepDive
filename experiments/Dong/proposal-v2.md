# Dong 对 product 阶段的提议

- 状态：草稿（基于 2026-04-26 ~ 04-27 MVP 实现 + 踩坑）
- 作者：Dong
- 关联：[`spec/mvp.md`](../../spec/mvp.md)、[`spec/product.md`](../../spec/product.md)、[`NOTES.md`](./NOTES.md)、[`spec.md`](./spec.md)

> ⚠️ **个人观点，不是团队决议**。这份是分享会上的"我建议"+ 会后给 Boris 当输入。每条都尽量指向具体实测证据。

---

## 思考前提

1. mvp.md 第 12 行：8 份实践 → 抽共识 → 系统化设计
2. 我的实现路径：spec-first → 端到端跑通 → LLM 抽象层 → observation 合并 brief → 扩源
3. 关键证据来源：[NOTES.md「成本/时延」](./NOTES.md#成本--时延) + [11 条「出乎意料的事」](./NOTES.md#出乎意料的事) + [10 条「如果再来一次」](./NOTES.md#如果再来一次)

---

## 共识候选（实测强证据，建议直接吸收进 v2）

### C1. LLM 后端抽象层做成团队共享库

**证据**：踩 yibuapi 坑后引入 ~150 行 `deep_dive/llm/`，让换 backend = 改 env 而非改代码（`docs/decisions.md` 2026-04-26）。yibuapi 走 Anthropic 原生协议失败、走 OpenAI 兼容协议成功——同一代理不同协议端点结果完全不同。**多 backend 切换能力对国内团队尤其值钱**。

**建议**：把 `deep_dive/llm/` 作为 v2 的工程基础设施起点，团队所有人都受益。

### C2. 流水线多步分解（fetch → dedup → rank → summarize → render）

**证据**：rank/summarize 走"每条独立 LLM 调用"，prompt caching 命中率实测 40%，单任务可控、中间产物落盘可独立重跑。

**建议**：v2 流水线设计照搬"多步 + 中间产物落盘"，不要追求"一次性出 brief"的优雅但脆弱方案。

### C3. URL 全程透传 + LLM 不写 URL

**证据**：URL 由 fetch 阶段写死，rank/summarize 的 schema **不含** URL 字段，prompt 里也禁止。这是 brief 类应用防幻觉的**硬约束**，本周从未出现 URL 错误。

**建议**：v2 任何 LLM 输出都遵循"URL 透传不写"原则。

### C4. graceful skip + 三层 JSON 容错 + per-source retry

**证据**：fetch 网络间歇 SSL 失败靠 retry 救场；rank/summarize 单条 JSON 失败靠 graceful skip 不挂整批；中文未转义双引号靠 regex fallback 兜底。**三个机制单独都不够，叠加才稳**。

**建议**：v2 把这三件作为可靠性 baseline，不要给"先做 happy path 再加错误处理"的诱惑机会。

### C5. 输出契约硬约束 + 实现细节软约束

**证据**：mvp.md 只锁 brief 章节结构和文件位置，其他全自由——这让我能边做边换思路（dedup 阈值、抽象层、observe 合并等）而不破坏对外承诺。下周 8 人横向对比也能对得上。

**建议**：v2 spec 继承这种"硬约束最小化"哲学。

---

## 偏好提议（有个人取径，欢迎争论）

### P1. observe 二次提炼合并进 brief 的 `<details>` 折叠块（vs 独立产物）

**我的取径**：先做了独立 `observations/<date>.md` + 站点路由，发现内容简介与 brief 的 long 段冗余，改为合并进 brief 的折叠块。一次 LLM 调用产 4 字段（short / long / key_points / implications），节省往返。

**讨论点**：其他人可能选独立产物形态。Job 2「主题深挖」可能不应该是 brief 的扩展而是独立形态——v2 要不要把"5 分钟扫"和"深读"做成两份产物？

### P2. 信息源选择策略：5 → 8（加 HN 这种高噪声源）

**我的取径**：HN 加进来 30 条 frontpage 中 24 条被 ranker 正确打 score=1，1 条 SWE-bench score=4——**ranker 在高噪声面前稳定**，新增成本几乎为零换 1 条独家信号。

**讨论点**：是 ranker prompt 的功劳还是 Sonnet/Opus 的能力？v2 应该把"加噪声源 + 强 ranker"作为信息源策略，还是保守只挑高信噪比源？

### P3. system prompt 写到 caching 阈值（2048 tokens）

**我的取径**：Sonnet 4.6 的 cacheable 前缀最小 2048 token，我写 rank/summarize 的 system prompt 时刻意做到 ≥ 2048（评分标准 + 边界 case + 反例），实测命中 40%。

**讨论点**：这是"刻意写丰满"还是"自然就这么长"？v2 prompt 设计是否要明确把"cacheable 阈值"作为约束？

---

## 暂缓 / 反对（不希望团队急着上）

### N1. 自动调度（cron / GH Actions）— 推到 v2 末或 v3

**理由**：自动化前应该先做监控和告警，否则 brief "无声跑歪"几天没人看。本周明确选了"手跑"，理由仍成立。先把 brief 的产出质量监控起来再上自动化。

### N2. 多用户 / 登录 / 订阅 — spec/product.md 已划走，建议守住

**理由**：mvp 服务团队 dogfood，加多用户会破坏"我们自己每天用"的反馈回路。Job 1 没充分对自己人好用前，不引入 user model。

### N3. 共享库 / 团队级目录骨架 — 第 1 周内不要做

**理由**：mvp.md 「不做什么」明确推迟。8 人实现差异大，过早抽公共层会让分歧变成代码 conflict。建议 v2 启动会专门讨论"哪些可抽 vs 哪些先各做各的"。

---

## 范围建议

**Job 1（每日 brief）**：v2 工程化 + 系统化，作为团队共识基础。
**Job 2（主题深挖）**：建议做最小可用形态——`observations/<date>.md` 已经是雏形，可以扩展为"输入主题 + 时间窗口 → 跨多日 brief 抽取深度报告"。
**Job 3（重大事件即时推送）**：spec/product.md 列为 P2，**不急**。等 Job 1 + Job 2 自己用顺再说。

---

## 一句话总结

**v2 = 把 MVP 做对的几件事抽出来作为共享基础（C1-C5），让 Job 2 走起来；先不碰自动化和多用户**。

要在分享会上展开讲哪一条，按 Boris 时间盒安排即可。
