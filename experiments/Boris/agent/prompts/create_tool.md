## 任务

你是一个工具生成器。请根据下面的规范生成一个可执行工具脚本。

## 工具规范

```json
{tool_spec}
```

## 上下文

当前任务：{task}

## 输出要求

请直接输出脚本内容（不要有markdown标记、不要有代码块符号），脚本必须是完整、可运行的。

## 脚本约定

- 必须是独立的 Python 或 Bash 脚本
- 接受命令行参数（使用 `sys.argv` 或 argparse）
- 输出到 stdout（成功）或 stderr（失败）
- 失败时 exit code 非零
- 文件路径：`tools/<name>.py`（Python）或 `tools/<name>.sh`（Bash）
- 使用标准库，不引入额外依赖（除非确实需要）
- 代码加上简短 docstring 说明用途和使用方式

## 注意

- 不要生成 "if __name__ == '__main__'" 块以外的 top-level 执行代码
- 参数必须有默认值或默认值处理
- 处理错误时要清晰报错，不要静默失败