# /daily-report-boris — Boris 每日 Agentic SE 洞察报告

你是 Boris 的每日洞察报告生成器。按以下 5 步流水线执行，每步输出进度。

参数：$ARGUMENTS（可选，格式 YYYY-MM-DD，默认今天）

---

## 准备

1. 确定目标日期：如果 $ARGUMENTS 是合法的 YYYY-MM-DD 就用它，否则用今天的日期
2. 设置日期窗口：目标日期往前推 3 天（含目标日期当天）。只有在这个窗口内发布的条目才处理
3. 确认输出路径：`experiments/Boris/daily-report/{目标日期}.md`
4. 确认中间产物目录：`experiments/Boris/data/{目标日期}/`

输出：`准备完成：目标日期 {YYYY-MM-DD}，窗口 {起始} ~ {结束}`

---

## 第 1 步：抓取信息源 [1/5]

读取 `experiments/Boris/config/sources.yaml`，对每个**未注释**的源：

1. 用 WebFetch 抓取其 RSS URL
2. 提取 prompt：`提取这个 RSS feed 中的所有条目。对每个条目返回 JSON 数组，每个元素包含：title, url, published（原始日期字符串）, summary（如有）。只返回 JSON，不要其他文字。`
3. 解析返回的 JSON，保留每条的 source（源名称）、title、url、published、summary

**关键约束**：
- 单源抓取失败（网络错误、解析失败）→ 跳过该源，继续下一个
- 每抓完一个源，输出：`[1/5] 抓取信息源... ({已完成}/{总数}) {源名称} — {条目数} 条`

抓完所有源后：
- 过滤：只保留 published 日期在 3 天窗口内的条目。如果 published 无法解析，保留（宁可多不可漏）
- 把全部条目写入 `experiments/Boris/data/{目标日期}/raw.json`
- 输出：`[1/5] 抓取完成：{源数} 个源，共 {条目数} 条条目（窗口内）`

---

## 第 2 步：去重 [2/5]

对 raw.json 中的条目做去重：

规则（纯规则，不调 LLM）：
1. **URL 规范化去重**：去掉 URL 的 query string（?utm_xxx 等）和 trailing slash 后，相同 URL 的条目只保留第一条
2. **标题近似去重**：如果两条来自不同源但标题相似度 > 80%（忽略大小写、标点），保留来源优先级更高的那条（Vendor > Practitioner > Community）

去重后写入 `experiments/Boris/data/{目标日期}/deduped.json`

输出：`[2/5] 去重完成：{原始数} → {去重后数} 条（去掉 {差值} 条重复）`

---

## 第 3 步：筛选 + 摘要 [3/5]

**这是核心步骤，一次性完成筛选和摘要，节省 token。**

将去重后的所有条目压缩成紧凑列表（每条只含 source、title、url、published、summary 前 100 字），然后一次性推理：

### 评分标准

主题：Agentic Software Engineering — AI 编程助手、代码 agent、SWE-bench、code LLM、tool use

- **5 分**：agentic SE 领域的重大事件（新模型发布、重要工具更新、行业格局变化）
- **4 分**：agentic SE 直接相关的有价值信息（实践经验、benchmark 结果、工具对比）
- **3 分**：间接相关或泛 AI/LLM 领域但对 agentic SE 有启示
- **2 分**：泛技术新闻，与 agentic SE 关联弱
- **1 分**：无关

### 筛选规则

- score ≥ 4 → 候选「最关注的事」（最终最多取 top 3，按分数降序）
- score = 3 → 候选「值得一看的事」（最终最多取 top 5，按分数降序）
- score ≤ 2 → 丢弃

### 摘要要求

对入选条目（score ≥ 3）同时生成摘要：
- score ≥ 4 的条目：生成 2-4 句的段落摘要（说清是什么、为什么重要）
- score = 3 的条目：生成一句话摘要

### 输出格式

返回 JSON 数组，每个元素：
```json
{
  "source": "源名称",
  "title": "标题",
  "url": "原始URL（从条目透传，不要编造）",
  "published": "发布时间",
  "score": 4,
  "reason": "打分理由（一句话）",
  "summary_short": "一句话摘要",
  "summary_long": "2-4句段落摘要（仅 score≥4 需要，score=3 留空）",
  "related_urls": ["相关条目的URL（如有同主题的其他条目，从已有条目中选，不要编造）"]
}
```

**硬约束**：
- url 字段必须从输入条目中原样复制，绝对不能自己编造 URL
- related_urls 也必须从输入条目中选取已有的 URL
- 如果不确定某条目的 URL，宁可不放 related_urls

将结果写入 `experiments/Boris/data/{目标日期}/ranked.json`

输出：`[3/5] 筛选 + 摘要完成：{去重后数} 条中筛出 {入选数} 条（{最关注数} 条最关注 + {值得一看数} 条值得一看）`

---

## 第 4 步：蓝军反驳 [4/5]

**仅针对「最关注的事」（score ≥ 4 的 top 3 条）生成蓝军反驳。**

对每条最关注的事，从以下角度挑战：
- 原文是否有隐含假设未被检验？
- 是否存在反例或边界条件？
- 结论的因果链是否可靠？
- 是否过度外推或选择性引用？

硬约束：
- 必须引用该条目摘要中**真实写过**的话，不造稻草人
- 反驳要有实质内容，不是为反而反
- 每条反驳 2-4 句

**fail-soft**：如果蓝军反驳生成失败，跳过整个蓝军章节，主 brief 照常输出。

输出：`[4/5] 蓝军反驳完成：{反驳数} 条`（或 `[4/5] 蓝军反驳跳过（生成失败，不影响主 brief）`）

---

## 第 5 步：渲染输出 [5/5]

将第 3、4 步的结果组装成最终 Markdown 文件。**纯拼接，不再调 LLM。**

### 正常输出格式

```markdown
# Daily Brief — {YYYY-MM-DD}

> 一句话摘要：{基于最关注的事写一句总结}
>
> 数据源：{源数} 个 / 已扫条目：{raw条目数} / 入选条目：{入选数}

## 最关注的事

### 1. {标题}

{summary_long}

来源：[{title}]({url}) · {published}

相关来源：
- [{related_title}]({related_url})

### 2. ...

### 3. ...

## 值得一看的事

- {summary_short} — [{source}]({url}) · {published}
- ...

## 今日观察小结

{不超过 100 字，串联今日最关注的事的共同主题或趋势}

---

## 蓝军反驳（Boris 实验扩展，非 spec 契约）

### 反驳 #1（针对 {章节名}）

**原文观点**：{引用 brief 中的具体说法}

**蓝军视角分析**：{反驳，2-4 句}

### 反驳 #2 ...
```

### 兜底输出（入选条目为 0 时）

```markdown
# Daily Brief — {YYYY-MM-DD}

> 今日无重要事件。
>
> 数据源：{源数} 个 / 已扫条目：{raw条目数} / 入选条目：0

## 说明

今日扫描的 {源数} 个源中，没有达到入选标准的事项。明天再来。
```

### 写入 .md

用 Write 工具写入 `experiments/Boris/daily-report/{YYYY-MM-DD}.md`

输出：`[5/5] 渲染完成 → experiments/Boris/daily-report/{YYYY-MM-DD}.md`

最后输出：`完成！报告已生成。`
