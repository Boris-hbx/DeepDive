# Dong 对 product 阶段的提议

- 状态：草稿 **v0.3**（2026-05-09 晚 — Boris spec/003+004 push 后再校准）
- 作者：Dong
- 关联：[`spec/mvp.md`](../../spec/mvp.md)、[`spec/product.md`](../../spec/product.md)、[`NOTES.md`](./NOTES.md)、[`spec.md`](./spec.md)、[Boris spec/003](../Boris/spec/003-self-evolving-agent.md)、[Boris spec/004](../Boris/spec/004-multi-team-collaboration.md)

> ⚠️ **个人观点，不是团队决议**。给 Boris 当 v2 启动会输入。

> **v0.3 修订说明**：Boris 当天 push spec/003（自进化 agent）+ spec/004（Platform / Evolution / Benchmark 三团队模型）+ 实际 agent 框架代码，**v2 议题被抬高一层**——从"统一 Job 1 brief 实现"变成"是否接受三团队拓扑"。本稿增加 **R1-R5（对 Boris 模型的回应）** 作顶层，v0.2 的 C / D / P / N 降为"支撑证据"。

---

## 思考前提

1. mvp.md 第 12 行：8 份实践 → 抽共识 → 系统化设计
2. 我的实现路径：spec-first → 端到端跑通 → LLM 抽象层 → observation 合并 brief → 扩源
3. 关键证据：[NOTES.md「成本/时延」](./NOTES.md#成本--时延) + [11 条「出乎意料的事」](./NOTES.md#出乎意料的事) + [10 条「如果再来一次」](./NOTES.md#如果再来一次)
4. **v0.2 加**：8 人远端实践扫描（Dong + Jun + Zhi + Wei 真实产出；Boris 重基础设施未出 brief；Feng / Jie / Yong 暂未动）
5. **v0.3 加**：Boris 当天 push spec/003+004 + agent 框架代码，把议题从"brief 实现共识"抬到"团队拓扑 + Benchmark"层

---

## 对 Boris 三团队模型的回应（v0.3 新顶层）

### R1. 同意「三关注点正交」思想

Boris 提的 **Platform 管能不能跑 / Evolution 管能不能变好 / Benchmark 管好不好** 是干净的拆法。类比"油门 / 刹车 / 仪表盘"也准确。这个**思想框架**接受。

### R2. 慎对「三团队人事分工」— 本周仍在 dogfood 阶段

**事实**：mvp.md 第 12 行设定的本周目标是"8 份对同一 spec 的不同实践"，**还没到拆团队的阶段**。当前实测：
- 4/8 出 brief（Dong / Jun / Zhi / Wei）
- 1/8 跳到 platform 层（Boris，0 brief）
- 3/8 完全没动（Feng / Jie / Yong）

**风险**：spec/004 把人按 Platform / Evolution / Benchmark 分组，会让"还没产出过 brief"和"已经稳定每日跑"的人放进同一团队按相同 KPI 评。**这把 product 阶段问题（人事分工）和 mvp 阶段问题（dogfood 验证）混了**。

**建议**：v2 启动会**先采纳"正交关注点"思想**作软约束，**人事分工推到 v3**。让每人在三个关注点上自选投入比例（如 Dong 70% Evolution + 20% Benchmark + 10% Platform），而非硬绑团队。

### R3. 补：Benchmark 漏了**产品/用户价值**维度（最严重盲点）

spec/004 的 Benchmark 三维度：**Health / Evolution / Accountability**——全是**系统侧**指标。

**漏掉的维度**：**用户价值** = product.md 第一句明文设定的目标——"团队成员每天用 5 分钟掌握当天值得关注的事"。

这意味着：
- 「成功率 99% / 工具复用率 80% / 决策可追溯」全达标，但**没人愿意每天花 5 分钟看 brief** → spec/004 的仪表盘看不出来
- Zhi 4 天连续产 brief 符合契约，但**有没有人真的每天读？**——这是真问题；Boris 0 brief 还没经过这一步检验

**建议**：spec/004 第 4 个维度补 **Product / Adoption**：
- 每日 brief 实际打开数 / 团队成员
- 每条 brief 引用回原文的点击率
- 周度团队"今天看到值得关注的事"自我评分

### R4. 补：Wei 的 Job 2 在 Boris 模型里**没位置**

Wei 已实现 interactive insight agent（Job 2 主题深挖），公开"取消 MVP 限制"。spec/004 把所有探索归到 Evolution 团队的 Tools / Workflow / Spec / QA / Training 五分支——**没有「产品形态分歧」一栏**。

Wei 做的不是"工具/workflow 探索"，是**第二种产品**。

**建议**：spec/004 增加第 6 个 Evolution 分支「Product Form 探索」，或把 Wei 的 Job 2 形态作正式独立分支与 Job 1 brief 并列。

### R5. 提：Boris 自己 0 brief 输出 — Platform 设计需要先 dogfood

Boris 的 003+004 框架理论自洽，但**他没经过"每天产出一篇 brief"的实测**。Dong / Jun / Zhi 踩过的坑（yibuapi 注入工具集 / 中文双引号破坏 JSON / cache 阈值 2048 / cron 无监控）在 spec/004 的 Platform 层都没体现。

**建议**：spec/004 进入实施前，请 Boris 先用自己的 agent 框架**跑出 7 天连续 brief**（Zhi 已示范可行）。Platform 层的接口和约束应该从这个实测里反推，不是从空白纸上设计。

---

## 共识候选（v0.2 保留 — 在 Boris 模型里映射到 **Platform 层**）

> 这些都是 8 人实测验证过、可以直接吸入 Platform 层的硬条件。

### C1. LLM 后端抽象层（**Python 路径共识**）

Dong + Jun 独立做了同款（签名几乎一致），其他 3 人 Anthropic-only 没痛点。**Platform 层的 LLM Gateway 应直接采纳此抽象**（即 Boris 在 spec/004 里写的 LLM Gateway 模块），跨语言不强推。

### C3. URL 全程透传 + LLM 不写 URL

防幻觉硬约束。Platform 层应在所有 LLM-call 接口里强制此约束（schema 不带 URL 字段、prompt 模板预置禁令）。

### C4. graceful skip + 三层 JSON 容错 + per-source retry

可靠性 baseline。Platform 层的 Tool Registry 和 LLM Gateway 应原生支持 retry / fallback / skip 策略，不要让每个 Evolution 探索者各自实现。

### C5. 输出契约硬约束 + 实现细节软约束

8 人中 4 个出 brief 的全部守住契约（包括公开"取消 MVP 限制"的 Wei）。**这是唯一真正起作用的硬约束**。Platform 层应把 brief / report / 任何产出物的契约作为一等公民（schema 校验 + 渲染前 lint）。

---

## 实测分歧（v0.2 保留 — 在 Boris 模型里映射到 **Evolution 层探索**）

### D1. 多步分解 vs 合并：4 路实测

| 实践者 | 切法 | 代价 |
|---|---|---|
| Dong | rank + summarize 各每条 1 调用 | ~70 调用 / brief；cache 命中 71% |
| Jun | rank 关键词 / summarize 1 调用 | rank 0 调用 |
| Zhi | 单 LLM call 整批 | 1 调用 / brief；省 token；无中间产物 |
| Boris（设计） | rank+summarize 合并 1/条 | 设计省 80-85% token；尚无实测 |

→ Evolution「Workflow 探索」分支的素材。

### D2. Ranker 策略 4 种

| 实践者 | 策略 |
|---|---|
| Dong | LLM 逐条评分 |
| Jun | 关键词 + 域名权重 |
| Zhi | 关键词预过滤 + LLM 单次 |
| Boris | rank+summarize 合并到 1 调用 |

→ Evolution「Tools 探索」分支的素材。

### D3. 输出形态分歧

| 实践者 | 形态 |
|---|---|
| Dong / Zhi / Jun | 单一 brief |
| Wei | brief + 主题深挖 reports（多格式） |
| Boris | brief + 反驳层 + 项目 radar |

→ 见 R4：spec/004 Evolution 缺「Product Form」分支，应补。

---

## 偏好提议（保留）

### P1. observe 二次提炼合并进 brief 折叠块（vs 独立产物）

LLM 一次调用产 4 字段（short / long / key_points / implications）。

### P2. 信息源选择策略

8 人源数对比：Zhi 5 / Dong 8 / Boris 11 / Wei 20+（含 Cybersec 双主题）。Wei 的双主题是 v2 主题边界扩张的潜在样本。

### P3. system prompt 写到 caching 阈值（2048 tokens）

实测命中 75%。**v0.3 补强**：Platform 层的 LLM Gateway 应内置"caching 阈值检查 + 命中率监控"作为 Health 指标之一。

### P4. Wei 的 Job 2 — 是否吸纳进 v2

→ 详 R4：建议 Boris spec/004 增「Product Form」分支正式吸纳 Wei。

---

## 暂缓 / 反对（保留 + v0.3 补）

### N1. 自动调度 — v0.2 软化保留

Zhi launchd 4 天 + Wei node-cron 都跑通，靠 commit 仓库做被动监控。Platform 层应内置 **health check + 失败告警 + dry-run check** 三件套，再统一上自动调度。

### N2. 多用户 / 登录 / 订阅 — 守住

mvp 服务团队 dogfood，Job 1 没充分对自己人好用前不引入 user model。

### N3. 共享库 / 团队级目录骨架 — v0.2 修订保留

跨语言公共层无意义；Python 路径上 Dong + Jun 的 LLM 抽象层有抽公共潜力（→ 喂入 Platform 层 LLM Gateway）。

### **N4（v0.3 新）. 反对在 dogfood 阶段拆三团队**

→ 详 R2。**先采纳「正交关注点」思想，人事分工推到 v3**。在还有 3/8 人停滞 + Boris 0 brief 的前提下，硬拆团队会让差距固化。

### **N5（v0.3 新）. 反对没有产品价值维度的 Benchmark**

→ 详 R3。spec/004 的 Health / Evolution / Accountability 三维全是系统侧，**漏了 Adoption / 用户价值**——这是 product.md 第一句的 KPI，不能不进 Benchmark。

---

## 范围建议（v0.3 重写）

**Job 1（每日 brief）**：v2 工程化 + 系统化。Platform 层吸纳 C1/C3/C4/C5；Evolution 探索 D1/D2。
**Job 2（主题深挖）**：Wei 已做一份。spec/004 应增 Evolution「Product Form」分支正式吸纳。
**Job 3（重大事件即时推送）**：spec/product.md 列为 P2，**不急**。等 Job 1 + Job 2 dogfood 顺再说。
**团队拓扑**：先用"正交关注点"软引导（每人按比例自选投入），人事分工推到 v3。
**Benchmark 维度**：spec/004 的三维 + **新增 Adoption / 用户价值**作第 4 维。

---

## 一句话总结（v0.3）

**v2 = 接受 Boris 的「三关注点正交」思想；拒绝在 dogfood 阶段拆三团队；Benchmark 必须补「产品价值」第 4 维；Wei 的 Job 2 应在 Evolution 里独立成「Product Form」分支；Boris 自己先用 agent 框架跑通 7 天 brief 再推 Platform 设计。**

要在分享会上展开讲哪一条，按 Boris 时间盒安排即可。
