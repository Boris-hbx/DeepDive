export function getSurveyPrompt(topic, timeRange, domain) {
  const timeHint = timeRange ? `重点关注 ${timeRange} 时间段。` : '';
  const domainHint = domain ? `领域：${domain === 'cybersecurity' ? '网络安全' : '软件工程'}。` : '';
  return `你是一位资深技术分析师。请对以下技术课题进行全面的综述性洞察分析：

**课题**：${topic}
${domainHint}${timeHint}

请按以下结构输出 Markdown 格式报告：

# ${topic}

## TL;DR
用 3 句话概括最核心的发现。

## 关键发现

### 发现 1：{标题}
{详细分析，200-300 字}

### 发现 2：{标题}
{详细分析}

### 发现 3：{标题}
{详细分析}

## 技术对比

用 Markdown 表格对比该领域的主要技术方案/产品/框架（至少 3 个），维度包括：核心特点、优势、劣势、适用场景。

## 发展时间线

按时间顺序列出该领域的关键里程碑事件（至少 5 个），格式：
- **YYYY-MM** {事件描述}

## 趋势与展望

分析当前趋势和未来 1-2 年的发展方向（3-5 个要点）。

## 可行动建议

针对技术团队，给出 3-5 条具体可行动的建议。

## 来源与参考

列出你引用或参考的关键资料（论文、博客、官方文档等），格式：
- [{标题}]({URL}) — {一句话说明}

---

要求：
1. 内容要有深度，不要泛泛而谈
2. 每个观点都要有具体的技术细节支撑
3. 对比分析要客观，列出各方案的真实优劣
4. 时间线要准确，不确定的标注"约"
5. 来源尽量给出真实可访问的 URL
6. 直接输出 Markdown，不要包含 <thinking> 标签或任何 XML 标签

请直接输出 Markdown，从 # 标题开始：`;
}

export function getAutoTagPrompt(markdown) {
  return `分析以下技术报告，提取 3-8 个技术标签。

要求：
- 标签应反映报告涉及的核心技术领域
- 用中文，简短（2-4 个字）
- 按相关性从高到低排序
- 只输出 JSON 数组，如 ["标签1", "标签2", "标签3"]

报告内容：
${markdown.slice(0, 3000)}

只输出 JSON 数组，不要其他内容：`;
}

export function getDomainClassifyPrompt(topic) {
  return `判断以下技术课题属于哪个领域。只输出一个 JSON 对象。

课题：${topic}

可选领域：
- software-engineering（软件工程：软件开发、AI 编程、DevOps、架构设计、编程语言、框架工具等）
- cybersecurity（网络安全：漏洞、攻防、加密、合规、安全运营、威胁情报等）

如果课题跨两个领域，两个都输出。

只输出 JSON，格式：{"domains": ["software-engineering"]} 或 {"domains": ["software-engineering", "cybersecurity"]}`;
}

export function getBriefPrompt(domain, items) {
  const domainLabel = domain === 'cybersecurity' ? '网络安全' : '软件工程';
  const itemList = items.map((item, i) =>
    `${i + 1}. [${item.source}] ${item.title}\n   URL: ${item.url}\n   摘要: ${item.snippet.slice(0, 200)}`
  ).join('\n\n');

  return `你是一位资深技术分析师。以下是今天从各信息源抓取的 ${domainLabel} 领域相关内容。

请从中筛选出最值得关注的内容，生成每日 brief。

**规则**：
- 「最关注的事」：最多 3 条，每条 1 段话（50-100 字）+ 原文链接
- 「值得一看的事」：最多 5 条，每条 1 句话 + 原文链接
- 如果今天确实没有重要事件，直接输出"今日${domainLabel}领域无重要事件"，不要凑数
- 每条必须附带原文链接
- 只输出有来源支撑的内容，不编造

今日抓取内容：

${itemList}

请按以下 Markdown 格式输出：

# ${domainLabel}每日 Brief — {YYYY-MM-DD}

## 最关注的事

### 1. {标题}
{1 段话分析} [原文]({URL})

## 值得一看的事

- {一句话} [原文]({URL})

直接输出 Markdown：`;
}

export function getFollowUpPrompt(question, parentSummary, conversationHistory) {
  let contextBlock = `**原始报告摘要**：\n${parentSummary}\n`;

  if (conversationHistory && conversationHistory.length > 0) {
    contextBlock += '\n**历史追问**：\n';
    for (const turn of conversationHistory) {
      contextBlock += `- 问：${turn.question}\n  答（摘要）：${turn.answerSummary}\n`;
    }
  }

  return `你是一位资深技术分析师。用户在一份已有报告的基础上提出了追问。

${contextBlock}

**用户追问**：${question}

请基于上述上下文，针对追问生成补充分析报告。格式同综述报告（Markdown），但聚焦于追问的具体问题。
包含：关键发现、对比分析（如适用）、可行动建议、来源引用。

直接输出 Markdown，从 # 标题开始：`;
}

export function getSummarizePrompt(markdown) {
  return `将以下技术报告压缩为 300 字以内的摘要，保留核心发现和结论。只输出摘要文本，不要其他内容。

${markdown.slice(0, 6000)}`;
}

export function getImageKeywordsPrompt(sectionTitles) {
  const list = sectionTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
  return `为以下幻灯片章节标题各生成一个英文搜索关键词，用于在 Unsplash 图库搜索配图。

要求：
- 每个关键词 2-3 个英文单词，描述该章节适合的视觉意象
- 偏向抽象/科技/商务风格（如 "digital security", "data analytics", "cloud network"）
- 只输出 JSON 数组，如 ["keyword1", "keyword2", ...]
- 数组长度必须等于章节数量（${sectionTitles.length}）

章节标题：
${list}

只输出 JSON 数组：`;
}
