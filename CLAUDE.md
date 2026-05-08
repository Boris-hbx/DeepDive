# CLAUDE.md

本文件是团队与 Claude Code 协作的"宪法"。**所有人和所有 AI agent 都应先读这份**。
本文件本身也会随实践逐步迭代——不要把它当成静态文档。

## 项目

DeepDive 是一个洞察探索（Insight Exploration）应用。前期 Web，后续可能 app 化（Android / HarmonyOS / iOS）。
具体产品定义见 [`spec/product.md`](./spec/product.md)。

## 协作流程：spec-first

我们采用 **spec-first** 模式：

1. **写 spec**（人）— 复制 `spec/_template.md`，写清目标、验收条件、不做什么
2. **澄清**（人 + AI）— AI 读 spec 后提出疑问；人补充答复，更新 spec
3. **实现**（AI 主导，人监督）— 按 spec 实现，遇到 spec 没覆盖的判断点就停下来问
4. **Review**（人）— 检查代码 + 实际跑一遍验收条件
5. **复盘**（人）— 必要时把学到的东西回写到 `CLAUDE.md` 或 `spec/`

> ⚠️ **反模式**：不写 spec 直接让 AI 写代码。哪怕 5 分钟能想清楚的小功能，也先写 5 行 spec。
>
> 这条规则的目的不是繁琐，而是逼我们想清楚——多数返工源于"我以为 AI 懂我"。

## AI 行为边界

**可以自主决定（不必每次问）：**
- 实现细节：变量命名、函数拆分、代码组织
- 遵循已有风格写代码、写测试、写必要的注释
- 修自己刚写出来的明显 bug

**必须先问、得到确认再动：**
- 引入新依赖（库、框架、CLI 工具）
- 改动 spec 之外的代码或文件
- 任何破坏性操作：删文件、删分支、`git reset --hard`、`push --force`、改 CI 等
- 改动 `CLAUDE.md`、`spec/`、`docs/decisions.md`
- 架构层面的决定（数据结构、API 形态、目录结构、技术选型）

**通用准则：**
- 不会就问，不要瞎猜
- 改动前先读相关文件，不要凭印象改
- 对 spec 有疑问，先列出来问，不要边实现边猜
- 简洁优先：注释、抽象、文档都不要过度设计
- 拿不准是否属于"必须问"的事，就当成必须问

## 提交规范

- 提交粒度：一个 spec 任务对应一个或几个相关 commit
- 提交信息格式：`<type>: <做了什么>`，type ∈ {feat, fix, refactor, docs, chore, test}
- 例：`feat: add insight card rendering for text input`
- 一次提交不要混合无关改动（例如不要把"重命名"和"加新功能"放一起）

## 决策记录

非显然的决策（选了某个库、放弃某个方案、改了 spec 里的某条）写一行进 [`docs/decisions.md`](./docs/decisions.md)，包含日期和原因。
目的是让后来人（包括 AI）能查到"为什么是这样"。

## 待定 / 暂不引入

以下是有意推迟的事项。遇到再讨论，**不要**让 AI 自己拍板：

- 技术栈（前端框架、后端语言、数据库）
- 部署方式
- 团队成员分工
- 多 agent 协作 / 自定义 skill / 子 agent 编排等高级模式 — 建议先把基础 spec→实现→review 流程跑顺再说

## 给 AI 的额外提示

- 用中文与团队沟通；代码、commit message、标识符用英文
- 长回复前先想：用户是不是只需要一个简短答案？
- 完成任务后简要说"做了什么、下一步是什么"，不要复述 diff

## 工具使用约束（踩坑经验）

### 文件写入

- **超过 150 行或含大量 HTML/特殊字符的文件**：使用 `Bash` + heredoc 写入（`cat > file << 'EOF'`），不要用 Write 工具
- Write 工具适合中小文件（<150 行）和纯文本/代码文件
- 如果 Write 工具失败一次，立即切换到 heredoc 方式，不要重试

### Claude API 调用

- Opus 4.6 默认启用 extended thinking，返回的第一个 content block 是 ThinkingBlock 而非 TextBlock
- 必须过滤 content blocks：`text_blocks = [b for b in message.content if b.type == "text"]`
- 不要直接访问 `message.content[0].text`

### 通用

- 同一方法失败两次，换方法，不要继续重试
- 网络请求（git push、API 调用）失败一次可以重试，失败两次要排查原因
