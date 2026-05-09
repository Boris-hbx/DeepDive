## 任务

你是一个自进化 agent 的反思模块。请根据当前的执行结果，判断是否需要创建或改进工具。

## 当前任务描述

{task}

## 刚才执行了什么（步骤记录）

{steps}

## 现有工具清单

现有工具共 {tool_count} 个：
{tool_list}

## 输出要求

请输出一段有效的 JSON（不要有markdown标记、不要有额外文本）：

```json
{{
  "step_assessment": "描述这一步做得怎么样、有什么问题",
  "need_new_tool": true或false,
  "tool_spec": {{
    "name": "工具名称（英文、kebab-case）",
    "description": "工具用途一句话描述",
    "language": "python 或 bash",
    "args_schema": "参数说明"
  }},
  "reasoning": "为什么需要/不需要新工具",
  "workflow_fit": "good | poor | mismatch",
  "workflow_note": "如果 workflow 不匹配任务类型，建议什么调整（fit 为 good 时留空）"
}}
```

## 判断标准

创建工具的条件（满足任一即可）：
- 同样的操作出现了 2 次以上
- 当前步骤花了大量代码但这个操作未来可能复用
- 发现了一个通用的数据获取 / 文本处理 / 调用 API 模式

改进工具的条件：
- 现有工具在当前任务中暴露了不足
- 新需求明显超出工具当前能力范围

## 注意事项

- 如果不需要新工具，`tool_spec` 可以为 `null`
- 工具名必须是唯一的、英文、kebab-case（如 `fetch-hn`、`summarize-url`）
- 语言选 `python` 或 `bash`（纯 shell 脚本选 bash）