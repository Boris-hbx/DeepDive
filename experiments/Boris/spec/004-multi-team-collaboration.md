# spec/004 — 自进化系统多团队协作模型

> 日期：2026-05-03
> 状态：draft
> 关联：spec/003-self-evolving-agent.md, self-evolving-agent-architecture.html (slides 15-17)

## 目标

定义当自进化 Agent 系统由多团队协作完成时的分工模型，使系统能持续逼近统一的 Benchmark 目标（Health / Evolution / Accountability）。

## 核心原则

三个关注点正交，减少耦合：
- **Platform** 管"能不能跑"
- **Evolution** 管"能不能变好"
- **Benchmark** 管"好不好"

## 团队定义

### 1. Platform 团队（稳定）

提供稳定的基座，不关心具体任务域。

| 模块 | 职责 |
|------|------|
| Agent Runtime | 循环执行引擎、工具沙箱、进程隔离、资源限制 |
| Tool Registry & Lifecycle | 注册、版本管理、归档、依赖解析 |
| LLM Gateway | 模型路由、token 预算、缓存、fallback |
| Observability | 每次循环的 trace（plan/act/reflect 各阶段耗时、token 用量、调用链） |
| Benchmark Runner | 统一的评测框架，跑分、打分、出报告的基础设施 |

交付物：SDK + API + Dashboard，其他团队是它的用户。

### 2. Evolution 团队（灵活探索）

从不同角度探索如何让系统更可信，共同目标是逼近 Benchmark。内部按探索方向自然分工：

| 方向 | 职责 |
|------|------|
| Tools 探索 | 工具质量门、自动评估、生成/改进/淘汰策略 |
| Workflow 探索 | 模板优化、步骤组合、从历史 trace 中学习最优路径 |
| Spec / Prompt 探索 | 根据执行效果自动调优 plan.md / reflect.md / create_tool.md |
| Testing / QA | 工具 test case、回归检测、边界验证 |
| Training Data | 从成功 trace 中提取高质量样本，用于 fine-tune 或 few-shot |

内部分工灵活——同一个人可以同时探索 tools 和 workflow，按兴趣和能力自然分化。

### 3. Benchmark 团队（定义标准）

定义所有团队共同逼近的 North Star Metrics，不写 agent 代码。

| 维度 | 指标 |
|------|------|
| Health | 成功率、延迟 P50/P99、错误分类、资源消耗 |
| Evolution | 工具复用率、新工具存活率（7天）、workflow 步骤数收敛趋势 |
| Accountability | 决策可追溯、变更审计、安全边界、回滚能力 |

仲裁规则：
- Health 分数 < 阈值 → 冻结新工具上线
- Evolution 分数停滞 → 鼓励更大胆的探索
- Accountability 异常 → 强制 review 所有变更

## 关键接口

### Platform ←→ Evolution

```
POST   /tools/register      # 注册新工具
POST   /tools/{id}/upgrade   # 升级工具（旧版自动归档）
POST   /tools/{id}/rollback  # 回滚到指定版本
GET    /tools/{id}/health    # 工具健康度
GET    /traces?run_id=xxx    # 执行 trace（Evolution 用于学习）
```

### Evolution ←→ Benchmark

- 统一 metric schema（所有团队上报同一格式）
- 评测数据集规范（Evolution 提供 test case，Benchmark 定义格式和评分）
- 工具质量 SLA（生成工具须通过 quality gate）

### Benchmark ←→ All

- North Star Metrics 定义和更新
- 定期评测报告 + 趋势可视化
- 当 Evolution 和稳定性冲突时的仲裁机制

## 核心张力

Evolution 天然想"多探索"（生成更多工具、更频繁优化），系统稳定性天然要求"可预期"。Benchmark 通过三维综合分数来仲裁：

- 分数上升 → 放宽探索
- 分数下降 → 收紧变更

类比：Evolution 是油门，稳定性需求是刹车，Benchmark 是仪表盘。

## 不做什么

- 不做硬性的 Evolution 内部边界划分（按兴趣自然分化）
- 不做跨团队的代码 ownership 强制规则
- 不做自动化的团队绩效评估
