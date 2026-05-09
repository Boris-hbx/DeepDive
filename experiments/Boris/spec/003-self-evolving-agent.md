# Spec: Self-Evolving Agent — 自进化工具生成 Agent

- 状态：草稿
- 作者：Boris + Claude
- 日期：2026-05-01
- 关联：[product.md](../../../spec/product.md)、[001-web-app.md](001-web-app.md)

## 目标

在 `experiments/Boris/` 下实现一个最小可行的自进化 agent：agent 在解决问题过程中，能动态创建可复用的工具脚本（Python/Bash），并通过反思循环持续改进工具库。

动机：当前 daily-report 流水线是固定管道，无法应对新类型任务。希望 agent 能在解决问题时"学会"新能力，并把这些能力沉淀为可复用工具，形成工具积累效应。

灵感来源：Live-SWE-agent 的自进化思路——agent 不只是用工具，还能创造工具。

## 用户故事

1. 作为 Boris，我给 agent 一个任务（如"从 HN 抓取今天关于 Claude 的帖子"），agent 完成任务后自我反思，发现"抓取 HN"是个可复用操作，自动生成 `fetch_hn.py` 工具并注册。
2. 作为 Boris，我给 agent 另一个任务（如"抓取 HN 上关于 Cursor 的帖子"），agent 发现已有 `fetch_hn.py`，直接复用，不重复造轮子。
3. 作为 Boris，我给 agent 一个 daily brief 任务，agent 生成 `from-b-agent-2026-05-01.md`，与 skill 产出的 `from-skill-*.md` 共存同一目录，可对比质量。
4. 作为 Boris，我查看 `changelog.md`，能看到每个工具的创建原因、改进历史，了解 agent 的演进轨迹。

## 验收条件

### Phase 1 — 工具仓库 + 手动注册

- [ ] `experiments/Boris/agent/tools/` 目录存在，可存放工具脚本
- [ ] `registry.json` 能记录工具元信息（name, description, path, created_at, usage_count）
- [ ] `tool_manager.py` 能注册、列出、按名称查找、执行工具
- [ ] 至少有 2 个手写种子工具，能通过 `tool_manager` 执行
- [ ] 工具执行时 `usage_count` 自动 +1

### Phase 2 — 反思循环

- [ ] `reflect.py` 调用 Claude API，输入当前步骤结果 + 工具清单，输出结构化 JSON（`{need_new_tool, tool_spec, reasoning}`）
- [ ] `loop.py` 实现 task → act → reflect 主循环，能跑通一个端到端任务
- [ ] 反思结果追加到 `changelog.md`

### Phase 3 — 自动工具生成

- [ ] 反思结论为"需要新工具"时，自动调 Claude 生成 Python/Bash 脚本
- [ ] 生成的脚本写入 `tools/`，自动更新 `registry.json`
- [ ] 下一次循环能自动发现并使用新工具
- [ ] 工具创建事件记录到 `changelog.md`（格式：`日期 | 动作 | 工具名 | 原因 | 上下文`）
- [ ] 改进工具时，旧版本自动归档到 `tools/archive/<tool_name>/v{N}_{date}.py`
- [ ] `registry.json` 中 `version` 字段正确递增

## 不做什么

- **不做** 多 agent 编排 — 只有一个 agent，一个循环
- **不做** 重型工具版本管理（git-for-tools）— 用 `archive/` 子目录保留旧版，轻量够用
- **不做** 工具质量自动评估 — 靠人 review 生成的脚本
- **不做** 工具沙箱 / 安全隔离 — 信任生成的脚本（Boris 自己的实验环境）
- **不做** Web UI — 纯 CLI / 脚本方式运行
- **不做** session 级别的详细日志 — changelog 一行式记录足够
- **不做** 效率标记（"哪步低效"）— 后续再加
- **不做** 自动部署 — agent 完成洞察后输出 .md 到本地，不自动发布到 web

## 设计要点 / 约束

### 目录结构

```
experiments/Boris/agent/
├── __init__.py
├── loop.py              # 主循环
├── reflect.py           # 反思模块
├── tool_manager.py      # 工具注册/发现/执行/计数
├── prompts/
│   ├── reflect.md       # 反思 prompt 模板
│   └── create_tool.md   # 工具生成 prompt 模板
├── tools/               # 工具脚本存放处
│   ├── registry.json    # 工具清单（只指向当前版本）
│   └── archive/         # 历史版本存档
│       └── <tool_name>/
│           ├── v1_2026-05-01.py
│           └── v2_2026-05-03.py
└── changelog.md         # 演进日志
```

### 技术约束

- 语言：Python 3.10+
- LLM：Claude API（`anthropic` Python SDK）
- 工具脚本格式：独立 Python 或 Bash 脚本，接受命令行参数，输出到 stdout
- 不引入除 `anthropic` 之外的新依赖
- 所有文件仅在 `experiments/Boris/` 下，不碰他人代码

### registry.json 格式

```json
{
  "tools": [
    {
      "name": "fetch_hn",
      "description": "Fetch top stories from Hacker News matching a keyword",
      "path": "tools/fetch_hn.py",
      "language": "python",
      "args_schema": "keyword: str, limit: int = 10",
      "created_at": "2026-05-01",
      "updated_at": "2026-05-01",
      "version": 1,
      "usage_count": 0
    }
  ]
}
```

### 工具版本归档策略

- `registry.json` 的 `path` 只指向 `tools/` 根目录下的当前版本
- 改进工具时，`tool_manager` 自动执行：
  1. 将当前版本 copy 到 `tools/archive/<tool_name>/v{N}_{date}.py`
  2. 写入新版本到 `tools/<tool_name>.py`（覆盖）
  3. `registry.json` 中 `version` +1，`updated_at` 更新
- `archive/` 下的文件不会被 `tool_manager` 加载或执行，纯供人工对比
- 可用 `diff tools/fetch_hn.py tools/archive/fetch_hn/v1_2026-05-01.py` 查看演进

### changelog.md 格式

```markdown
# Agent Evolution Changelog

| 日期 | 动作 | 工具 | 原因 | 上下文 |
|------|------|------|------|--------|
| 2026-05-01 | 创建 | fetch_hn.py | 需要从 HN 抓取特定主题帖子 | task: 抓取 Claude 相关帖子 |
| 2026-05-03 | 改进 | fetch_hn.py | 增加分页支持 | task: 需要抓取超过 30 条结果 |
| 2026-05-03 | 创建 | summarize_url.py | 需要自动摘要网页内容 | task: 生成 brief 时手动读原文太慢 |
```

### Agent 洞察输出规范

当 agent 执行洞察任务时的输出：

- **内容格式**：符合 [`spec/mvp.md`](../../../spec/mvp.md) 的输出契约（固定结构、有链接、有数据源统计、诚实兜底）
- **文件命名**：`from-b-agent-YYYY-MM-DD.md`（前缀区分来源）
- **输出目录**：`experiments/Boris/daily-report/`（与 skill 产出同一目录）
- **部署**：Agent 完成洞察后不自动部署，.md 保留在本地，由 Boris 决定何时通过部署脚本发布到 web

> 命名对照：`from-skill-YYYY-MM-DD.md`（skill 产出）vs `from-b-agent-YYYY-MM-DD.md`（agent 产出）

### 反思 prompt 输出格式（JSON）

```json
{
  "step_assessment": "成功抓取了 HN 数据，但过程中手动写了 HTTP 请求代码",
  "need_new_tool": true,
  "tool_spec": {
    "name": "fetch_hn",
    "description": "Fetch top stories from Hacker News matching a keyword",
    "language": "python",
    "args": "keyword: str, limit: int = 10"
  },
  "reasoning": "抓取 HN 是高频操作，应该抽成独立工具"
}
```

## 开放问题

> 已关闭：
> - ~~API key 管理~~ → 从环境变量 `ANTHROPIC_API_KEY` 读取
> - ~~工具脚本错误处理~~ → exit code + stderr，最简 Unix 约定
> - ~~工具版本保留~~ → `tools/archive/` 子目录归档旧版，当前版本留在 `tools/` 根目录

暂无未决问题。

## 实现备忘

（实现过程中追加）
