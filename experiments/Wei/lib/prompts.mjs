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

export function getDocAnalysisPrompt(item) {
  return `请用 1-2 句话总结以下文章的核心内容，并提取 2-3 个关键技术点。

文章标题：${item.title}
来源：${item.source}
摘要：${item.snippet.slice(0, 300)}

请按以下 JSON 格式输出（不要其他内容）：
{"summary": "1-2 句话中文总结", "keyPoints": ["关键点1", "关键点2", "关键点3"]}`;
}

export function getOutlinePrompt(topic, docSummaries) {
  const summariesBlock = docSummaries.map((item, i) =>
    `${i + 1}. [${item.source}] ${item.title}\n   摘要: ${item._summary || item.snippet.slice(0, 200)}\n   关键点: ${(item._keyPoints || []).join('; ') || '无'}`
  ).join('\n\n');

  return `你是一位资深技术分析师。基于以下从各信息源采集并分析过的文档，为洞察报告生成一份 1-3 级标题纲要。

**报告课题**：${topic}

**已分析的文档**：
${summariesBlock}

请生成一个 JSON 数组表示的纲要树，每个节点必须包含：
- id：唯一字符串
- title：标题文本
- level：1/2/3
- keyPoints：该章节的核心观点（1-3 条，字符串数组）
- materials：支撑该章节的关键素材/来源引用（1-3 条，字符串数组，格式如 "来源名称: 一句话说明"）
- children：子节点数组（可选）

纲要应覆盖该课题的核心维度，逻辑清晰、有层次，每个章节都有实质性的观点和素材支撑。

只输出 JSON 数组，不要其他内容：
[
  {"id": "1", "title": "一级标题", "level": 1, "keyPoints": ["核心观点1", "核心观点2"], "materials": ["OpenAI Blog: GPT-5.5 在代码生成上的突破", "Simon Willison: 关于 LLM 工具链的实践总结"], "children": [
    {"id": "1-1", "title": "二级标题", "level": 2, "keyPoints": ["具体发现"], "materials": ["Latent Space: AI Agent 在企业落地的案例"]}
  ]}
]`;
}

export function getBodyGenerationPrompt(topic, outline, docSummaries) {
  const outlineText = outlineToMarkdown(outline);
  const summariesBlock = docSummaries.map((item, i) =>
    `${i + 1}. [${item.source}] ${item.title}\n   摘要: ${item._summary || item.snippet.slice(0, 200)}\n   链接: ${item.url}`
  ).join('\n\n');

  return `你是一位资深技术分析师。请按照以下纲要以 Markdown 格式生成洞察报告正文。

**报告课题**：${topic}

**参考文档**：
${summariesBlock}

**报告纲要**：
${outlineText}

要求：
1. 严格按照上述纲要结构输出，每个标题都保留
2. 内容要有深度，每个观点都要有具体的技术细节或数据支撑
3. 对比分析要客观，列出各方案的真实优劣
4. 引用参考文档时使用 [来源名称](URL) 格式
5. 在报告末尾添加 ## 来源与参考 章节，列出所有引用的文档
6. 直接输出 Markdown，从 # 标题开始，不要包含 <thinking> 或任何 XML 标签`;

  function outlineToMarkdown(outline) {
    const lines = [];
    for (const node of outline) {
      const prefix = '#'.repeat(Math.min(node.level, 3) + 1);
      lines.push(`${prefix} ${node.title}`);
      if (node.children) {
        for (const child of node.children) {
          const cPrefix = '#'.repeat(Math.min(child.level, 3) + 1);
          lines.push(`${cPrefix} ${child.title}`);
          if (child.children) {
            for (const gc of child.children) {
              const gcPrefix = '#'.repeat(Math.min(gc.level, 3) + 1);
              lines.push(`${gcPrefix} ${gc.title}`);
            }
          }
        }
      }
    }
    return lines.join('\n');
  }
}

export function getModifyPrompt(instruction, currentMarkdown) {
  return `你是一位资深技术分析师。请根据以下指令修改报告。

**修改指令**：${instruction}

**当前报告**：
${currentMarkdown}

要求：
1. 只修改指令涉及的部分，保持其他内容和结构不变
2. 如果要调整章节顺序，请移动整个章节（包括其子章节）
3. 如果要合并章节，请保留两章的核心内容
4. 如果要添加内容，请保持与原文风格一致
5. 直接输出修改后的完整 Markdown 报告，不要包含 <thinking> 或任何 XML 标签`;
}

export function getInitialThinkingPrompt(topic, domain, timeRange) {
  const domainHint = domain ? `\n**领域**：${domain === 'cybersecurity' ? '网络安全' : '软件工程'}` : '';
  const timeHint = timeRange ? `\n**时间范围**：${timeRange}` : '';
  return `你是一位资深技术分析师。请对以下技术课题进行初步的系统性思考和分析，可以开放搜索，以及你已有的知识。

**课题**：${topic}${domainHint}${timeHint}

请按以下结构输出 Markdown：

## 课题理解
用 2-3 句话概括该课题的核心问题域。

## 当前技术格局
列出该领域当前的主流技术方案、框架或平台（至少 5 项），每项 1 句话说明。

## 关键趋势
列出该领域最近 1-2 年的重要发展趋势（3-5 条）。

## 主要挑战与争议
列出该领域面临的技术挑战或业界争议（3-5 条）。

## 值得深入的方向
列出你认为值得深入分析的子方向（5-8 个），这些将作为后续洞察报告纲要的候选。

## 建议关注的信息源类型
建议补充哪些类型的信息源（如学术论文、官方博客、行业报告、开源项目等）来深化分析。

要求：
1. 每个观点都要有具体的技术细节，不要泛泛而谈
2. 直接输出 Markdown，不要包含 <thinking> 标签或任何 XML 标签
3. 在你不确定的领域，标注"（待验证）"`;
}

export function getBrainstormUpdatePrompt(topic, chatHistory, currentAnalysis, newMessage) {
  const historyBlock = chatHistory.length > 0
    ? '\n**对话历史**：\n' + chatHistory.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n')
    : '';
  const analysisBlock = currentAnalysis
    ? `\n**当前分析文档**：\n${currentAnalysis}`
    : '';

  return `你是一位资深技术分析师，正在与用户进行洞察 brainstorm。

**洞察课题**：${topic}${historyBlock}${analysisBlock}

**用户新消息**：${newMessage}

请根据用户的新消息，更新分析文档（如果是首次则新建），并给出一句简短的 Chat 回复。

分析文档应包含以下结构（按需更新，不必每次全部重写）：
- ## 课题理解：核心问题域
- ## 关键方向：值得深入的子方向（随对话逐步丰富）
- ## 技术格局：主流方案/框架/工具
- ## 关键挑战：技术挑战或争议
- ## 洞察线索：用户补充的背景、约束、特殊视角

要求：
1. 分析文档是累积的——保留已有内容，在用户新消息的基础上增补或修订
2. Chat 回复简短（1-2 句），说明做了什么更新，并引导用户继续
3. 输出严格的 JSON，格式：{"analysis": "完整的 Markdown 分析文档", "reply": "一句话回复"}
4. 不要在 JSON 外输出任何内容`;
}

export function getOutlineFromChatPrompt(topic, chatHistory, analysisDoc) {
  const historyBlock = chatHistory.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n');

  return `你是一位资深技术分析师。基于以下 brainstorm 对话和分析文档，为洞察报告生成一份结构化纲要。

**洞察课题**：${topic}

**Brainstorm 对话**：
${historyBlock}

**分析文档**：
${analysisDoc}

请生成一个 JSON 数组表示的纲要树，每个节点包含：
- id：唯一字符串
- title：标题文本
- level：1/2/3
- keyPoints：该章节的核心观点（1-3 条，字符串数组）
- materials：支撑素材/来源引用（1-3 条，字符串数组）
- children：子节点数组（可选）

纲要应充分体现 brainstorm 中用户强调的方向和背景，逻辑清晰、有层次。

只输出 JSON 数组，不要其他内容：`;
}

export function getOutlineModifyPrompt(instruction, currentOutline) {
  return `你是一位资深技术分析师。请根据以下指令修改洞察报告纲要。

**修改指令**：${instruction}

**当前纲要**（JSON）：
${JSON.stringify(currentOutline, null, 2)}

要求：
1. 只修改指令涉及的部分，保持其他节点不变
2. 保持 JSON 格式，每个节点包含 id/title/level/keyPoints/materials
3. 只输出修改后的完整 JSON 数组，不要其他内容`;
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
