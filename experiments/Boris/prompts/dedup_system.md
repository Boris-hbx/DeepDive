# 去重 Prompt（已选定方案）

借鉴自：ninjaer/AI-Daily-Report，源位置 `src/summarizer/summarizer.ts` 的「去重规则」段。

## 选定方案：嵌入 summarize prompt（不另起一次 LLM 调用）

理由：

- Boris 第一周只接 RSS 一类源、~10 个 feed，量级在每日几十到 ~150 条之间，**单次 LLM 调用就能装完**，不需要 ninjaer 的"按来源分批 + 二次合并"
- spec.md 里 `dedup.ts` 已规划做 URL 规范化 + 标题 fuzzy（`fastest-levenshtein`），先掉明显重复，等同于 LLM 之前的廉价兜底
- 残留的"同一事件不同媒体报道"由 summarize prompt 顺手语义合并，**省一次 LLM 调用、省钱省时间**
- 如果以后量级涨到 200+ 条/天再切 ninjaer 的分批模式，迁移成本低

## 衔接点

```
fetch → dedup.ts (URL + 标题 fuzzy)  → rank.ts → summarize.ts ← 去重段拼这里
                                                  ↓
                                              critique.ts (蓝军)
                                                  ↓
                                              render.ts
```

`dedup.ts` 干掉 80% 显式重复（同一 URL、几乎同标题），剩下的语义合并交给下面这段拼进 `summarize_system.md`。

## 去重段（直接拷进 summarize 的 user prompt）

```
去重规则（最高优先级）：
- ⚠️ 输入数据来自多个源，同一事件经常被多条新闻重复报道，必须严格去重合并
- 判断为同一事件 → 合并：标题/内容指向同一具体事件（如同一模型发布、同一论文、同一公司公告）
- 判断为不同事件 → 分别保留：仅主题相似但事件不同（如 "Cursor 0.42 发布" vs "Aider 0.60 发布"）
- 合并操作：
  - sources 列出所有原始来源（保留每条的 name 和 url）
  - oneLiner 综合各来源关键信息，简述各信源的独特角度/细节
  - relevance 取所有合并条目中的最高值
  - publishedAt 取所有合并条目中的最早时间

⚠️ 链接准确性：sources 中的 url 必须从输入数据原样透传，绝不能由 LLM 编造或拼接（与 spec 「URL 不让 LLM 写」对齐）
```

## 输入数据格式（建议沿用 ninjaer 的字段压缩）

喂给 LLM 时把字段名缩写以省 token：

| 短字段 | 含义 |
|--------|------|
| `i` | 序号（仅 LLM 内部引用） |
| `t` | title |
| `c` | content（动态截断：>200 条用 150 字、>100 条用 300 字、否则 500 字；arXiv 至少 500 字） |
| `s` | sourceName |
| `u` | url |
| `d` | publishedAt（`YYYY-MM-DD HH:mm`） |

示例：

```json
[
  {"i":1,"t":"Cursor 0.42 发布","c":"...","s":"Latent Space","u":"https://...","d":"2026-04-26 14:30"},
  {"i":2,"t":"AI 编辑器 Cursor 推出新版","c":"...","s":"Hacker News Best","u":"https://...","d":"2026-04-26 16:00"}
]
```

LLM 输出的 `sources[].url` 必须就是输入里的 `u`，不允许新造。

## 调用参数

- `temperature`: 0.2（去重要稳定）
- `system`: 强制纯 JSON 输出，禁止任何工具调用 / 文件保存
- 失败重试 1 次（参考 ninjaer），仍失败则该批次降级（不报错阻塞 pipeline，与 spec 的 fail-soft 对齐）
