# Spec: `/daily-report-boris` — Boris 每日洞察 Skill

- 状态：**草稿（待 Boris 评审）**
- 作者：Boris + Claude
- 日期：2026-05-01
- 关联：[`spec/mvp.md`](../../../spec/mvp.md)（输出契约）、[`spec.md`](../spec.md)（Boris MVP）、[`config/sources.yaml`](../config/sources.yaml)（信息源）

## 目标

做一个 Claude Code skill（slash command），Boris 在任何会话里输入 `/daily-report-boris` 就能一键产出当日的 agentic SE 洞察报告。

**核心卖点**：零外部依赖。不需要 `npm install`、不需要 `ANTHROPIC_API_KEY`、不需要 Python 环境。全部工作在当前 Claude Code 会话内完成——用 WebFetch 抓 RSS，用 Claude 自身能力做筛选/评分/摘要/蓝军反驳，用 Write 工具输出文件。

## 交付件

每次执行产出两样东西：

1. **归档 Markdown 文件**：`experiments/Boris/daily-report/YYYY-MM-DD.md`
   - 符合 `spec/mvp.md` 输出契约
   - 含蓝军反驳章节
   - 每条要点有可点击原文链接
   - 长期归档，可 git 追踪

2. **GitHub Pages 可见**：推送后自动部署到 `https://boris-hbx.github.io/DeepDive/Boris/`
   - Boris 和团队成员在浏览器里能直接看到
   - 依赖已有的 `deploy-Boris-pages.yml` workflow（push 触发）

> Skill 本身只负责产出 Markdown 文件。部署到网站是 push 后 GitHub Actions 自动完成的。

## 用户故事

作为 Boris，我打开 Claude Code，输入 `/daily-report-boris`，看到每一步的进度提示（正在抓哪个源、抓了多少条、正在筛选、正在写蓝军反驳……），几分钟后在 `experiments/Boris/daily-report/` 下看到今天的洞察报告。push 后网站上也能看到。

## 验收条件

- [ ] 输入 `/daily-report-boris` 能跑通，产出 `experiments/Boris/daily-report/YYYY-MM-DD.md`
- [ ] 输出文件符合 `spec/mvp.md` 输出契约（章节结构、文件命名）
- [ ] 「最关注的事」最多 3 条，每条有原文链接
- [ ] 「值得一看的事」最多 5 条，每条有原文链接
- [ ] 所有 URL 从 RSS 源透传，不由 LLM 编造
- [ ] 蓝军反驳章节附在 brief 末尾，每条引用原文真实说法
- [ ] 蓝军失败不阻塞主 brief 输出（fail-soft）
- [ ] 单源抓取失败不阻塞其他源
- [ ] 当日无重要事件时使用兜底文案
- [ ] `/daily-report-boris` 可接可选参数 `YYYY-MM-DD` 指定日期（默认今天）
- [ ] **每步有进度输出**，用户能看到当前在做什么
- [ ] 只处理近 3 天内发布的条目

## 设计

### 为什么是 Skill 而不是脚本

| 维度 | 脚本 pipeline（spec.md 方案） | Skill（本 spec） |
|------|------|------|
| 依赖 | Node.js + npm + API key | 零（Claude Code 自带） |
| 维护 | 代码要跟模型 API 变化 | 无代码，prompt 即逻辑 |
| 灵活性 | 改逻辑要改代码 | 改 prompt 文件即可 |
| 可复现 | 中间产物落盘 | 中间产物也落盘（data/） |
| 成本 | 额外 API 调用费 | 包含在 Claude Code 会话费用内 |
| 适用场景 | CI/CD 自动化 | 人在环的日常使用 |

两条路不冲突。Skill 先跑起来解决"今天就要洞察"的问题；脚本 pipeline 后续做自动化时再建。

### 成本优化策略

**核心原则：批量处理，合并步骤，最小化 LLM 交互轮次。**

Dong 的脚本 pipeline 对 ~220 条逐条调 LLM 评分（220 次 API 调用），成本高、慢。Skill 方案利用 Claude 自身的长 context 优势，把多步合并成少量推理轮次：

| 步骤 | 逐条方案（Dong 式） | 批量方案（本 Skill） | 节省 |
|------|---------------------|---------------------|------|
| rank | ~220 次 LLM 调用 | 紧凑列表一次性筛选 top 10 | ~95% |
| summarize | ~8 次 LLM 调用 | 入选条目一次性摘要 | ~85% |
| critique | ~3 次 LLM 调用 | 最关注条目一次性反驳 | ~65% |

**预估 token 消耗（单次 /daily-report-boris）**：

```
fetch:       11 次 WebFetch（内置小模型提取，成本忽略）
rank:        输入 ~220 条 × ~50 token/条 ≈ 11K input + ~1K output
summarize:   输入 ~8 条详情 ≈ 4K input + ~2K output
critique:    输入 ~3 条 brief ≈ 2K input + ~1.5K output
render:      纯文本拼接，0 LLM token
──────────────────────────────────────────────────────
总计约 20-25K token / 次
```

与逐条方案（~150K token）相比，节省约 80-85%。

### 进度反馈

Skill 执行过程中，每个阶段都输出简短的进度提示，让用户知道当前状态：

```
[1/5] 抓取信息源... (1/11) Anthropic Engineering
[1/5] 抓取信息源... (2/11) OpenAI Blog
...
[1/5] 抓取完成：11 个源，共 187 条条目
[2/5] 去重... 187 → 142 条（去掉 45 条重复）
[3/5] 筛选 + 摘要... 142 条中筛出 8 条（3 条最关注 + 5 条值得一看）
[4/5] 蓝军反驳... 对 3 条最关注生成反驳
[5/5] 渲染输出 → experiments/Boris/daily-report/2026-05-01.md
完成！
```

### 流水线

```
[1] fetch    — WebFetch 抓 sources.yaml 中的 RSS 源
               只保留近 3 天内发布的条目
               落盘 → data/YYYY-MM-DD/raw.json
    ↓
[2] dedup    — URL 规范化 + 标题相似度去重（纯规则，不调 LLM）
               落盘 → data/YYYY-MM-DD/deduped.json
    ↓
[3] rank+summarize（合并）
             — 将去重后的条目压缩成紧凑列表，一次性：
               ① 按 agentic SE 相关性打分筛选
               ② 对入选条目直接生成摘要
               ≥4 → 最关注（最多 3 条，含段落摘要）
               =3 → 值得一看（最多 5 条，含一句话摘要）
               <3 → 丢弃
               落盘 → data/YYYY-MM-DD/ranked.json
    ↓
[4] critique — 蓝军反驳（仅针对「最关注」≤3 条，一次性出）
               fail-soft：失败则跳过，主 brief 照常
    ↓
[5] render   — 组装成符合输出契约的 Markdown（纯拼接，不调 LLM）
               写入 experiments/Boris/daily-report/YYYY-MM-DD.md
```

### 信息源

读取 `experiments/Boris/config/sources.yaml`，当前 11 个源：

**Vendor（5）**：Anthropic Engineering、OpenAI Blog、GitHub Blog、Google AI Blog、Hugging Face Blog
**Practitioner（4）**：Simon Willison、Latent Space、Lilian Weng、Max Woolf
**Community（2）**：Hacker News Best、Lobsters

### 评分标准（嵌入 rank 步骤的 prompt）

主题：Agentic Software Engineering — AI 编程助手、代码 agent、SWE-bench、code LLM、tool use

- **5 分**：agentic SE 领域的重大事件（新模型发布、重要工具更新、行业格局变化）
- **4 分**：agentic SE 直接相关的有价值信息（实践经验、benchmark 结果、工具对比）
- **3 分**：间接相关或泛 AI/LLM 领域但对 agentic SE 有启示
- **2 分**：泛技术新闻，与 agentic SE 关联弱
- **1 分**：无关

### 蓝军反驳规则

对每条「最关注的事」，从以下角度挑战：
- 原文是否有隐含假设未被检验？
- 是否存在反例或边界条件？
- 结论的因果链是否可靠？
- 是否过度外推或选择性引用？

硬约束：
- 必须引用原 brief 中**真实写过**的话，不造稻草人
- 反驳要有实质内容，不是为反而反
- 每条反驳 2-4 句

### 输出格式

严格遵循 `spec/mvp.md` 输出契约，蓝军反驳作为额外章节附在末尾：

```markdown
# Daily Brief — YYYY-MM-DD

> 一句话摘要：...
>
> 数据源：N 个 / 已扫条目：M / 入选条目：K

## 最关注的事

### 1. <标题>
<2-4 句说明>
来源：[<原文标题>](<URL>)
相关来源：
- [<标题>](<URL>)

### 2. ...

## 值得一看的事

- <一句话> — [<源>](<URL>)
- ...

## 今日观察小结

<不超过 100 字>

---

## 蓝军反驳（Boris 实验扩展，非 spec 契约）

### 反驳 #1（针对 <章节名>）
**原文观点**：<引用 brief 中的具体说法>
**蓝军视角分析**：<反驳，2-4 句>

### 反驳 #2 ...
```

### 兜底文案

当日所有源加起来 ≥3 分的条目数为 0 时：

```markdown
# Daily Brief — YYYY-MM-DD

> 今日无重要事件。
>
> 数据源：N 个 / 已扫条目：M / 入选条目：0

## 说明

今日扫描的 N 个源中，没有达到入选标准的事项。明天再来。
```

## Skill 实现

### 文件结构

```
experiments/Boris/
├── spec/
│   └── 002-daily-brief-skill.md   ← 本文件
├── config/
│   └── sources.yaml               ← 信息源配置（已有）
├── daily-report/
│   └── YYYY-MM-DD.md              ← 输出物（归档 Markdown）
└── data/
    └── YYYY-MM-DD/                ← 中间产物
        ├── raw.json
        ├── deduped.json
        └── ranked.json
```

### 关键约束

- **URL 不让 LLM 编造**：所有链接从 WebFetch 抓取的 RSS 条目中原样透传
- **fail-soft 全程**：单源失败跳过、蓝军失败跳过、单条评分失败跳过
- **中间产物落盘**：每步结果写 JSON 到 `data/YYYY-MM-DD/`，便于调试和复跑
- **日期窗口**：只保留近 3 天内发布的条目（RSS 源可能返回更早的）
- **进度可见**：每步输出简短状态，避免用户以为"死机"

## 决策记录（已关闭的开放问题）

| # | 问题 | 决策 | 理由 |
|---|------|------|------|
| 1 | 输出目录 | `daily-report/` | Boris 决定：日报、报告类统一放这里 |
| 2 | 日期窗口 | 近 3 天 | Boris 确认 |
| 3 | 进度反馈 | 每步输出状态 | 避免长时间无输出让用户以为卡死 |
| 4 | 交付件 | md 归档 + 网站可见 | md 是 skill 直接产出；网站靠 push 后 GH Actions 部署 |

## 不做什么

- ❌ 自动化调度（cron / GitHub Actions）— 本 skill 是人触发的
- ❌ 外部 API 调用（Anthropic SDK 等）— 全部用 Claude Code 内置能力
- ❌ 改动 `experiments/Boris/` 之外的文件
- ❌ 引入任何 npm / pip 依赖
- ❌ 静态站点构建 — 网站部署由已有 workflow 处理，不在 skill 范围内

## 时间盒

- 今天：spec 评审 + 决策定稿
- 确认后：实现 skill + 跑通第一篇
