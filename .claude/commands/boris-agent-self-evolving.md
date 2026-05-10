# /boris-agent-self-evolving — Boris 自进化 Agent

运行 Boris 的自进化 agent，执行洞察任务并自动保存报告。

参数：$ARGUMENTS（必填，任务描述）

---

在 `experiments/Boris/` 目录下运行自进化 agent：

```bash
cd experiments/Boris && python -m agent "$ARGUMENTS"
```

报告自动保存到 `experiments/Boris/daily-report/` 目录。
