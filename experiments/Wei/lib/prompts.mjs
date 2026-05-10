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

export function getBriefPrompt(domain, items, globalTopItems = [], focusTopics = []) {
  const domainLabel = domain === 'cybersecurity' ? '网络安全' : '软件工程';
  const dateStr = new Date().toISOString().slice(0, 10);

  const domainList = items.map((item, i) =>
    `${i + 1}. [${item.source}] ${item.title}\n   URL: ${item.url}\n   摘要: ${item.snippet.slice(0, 200)}`
  ).join('\n\n');

  const globalList = globalTopItems.length > 0
    ? globalTopItems.map((item, i) =>
        `${i + 1}. [${item.source}] ${item.title}\n   URL: ${item.url}\n   摘要: ${item.snippet.slice(0, 200)}`
      ).join('\n\n')
    : '';

  let focusHint = '';
  if (focusTopics.length > 0) {
    focusHint = `\n**当前重点关注主题**：\n${focusTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`;
  }

  let globalSection = '';
  if (globalList) {
    globalSection = `
## 🌐 业界 TOP 科技新闻（不限领域）
以下为今日全球科技圈热度最高的新闻，不受领域限制，供交叉参考：

${globalList}
`;
  }

  return `你是一位资深技术分析师。以下是今天从各信息源抓取的 ${domainLabel} 领域相关内容。

请从中筛选出最值得关注的内容，生成每日 brief。
${focusHint}
**规则**：
- 「最关注的事」：最多 3 条，优先选择与上述"重点关注主题"高度相关的内容，其次选择领域内重要事件。每条 1 段话（50-100 字）+ 原文链接
- 「值得一看的事」：最多 8 条，混合以下内容（不作硬性分段）：
  - 业界 TOP 科技新闻（跨领域热度高、影响力大的事件）
  - 关注主题相关的次级动态
  - ${domainLabel}领域常规动态
- 如果今天确实没有重要事件，直接输出"今日${domainLabel}领域无重要事件"，不要凑数
- 每条必须附带原文链接
- 只输出有来源支撑的内容，不编造

${globalSection}
## 📋 ${domainLabel}领域抓取内容

${domainList}

请按以下 Markdown 格式输出：

# ${domainLabel}每日 Brief — ${dateStr}

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

export function getBrainstormUpdatePrompt(topic, chatHistory, currentAnalysis, newMessage, searchContext) {
  const historyBlock = chatHistory.length > 0
    ? '\n**对话历史**：\n' + chatHistory.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n')
    : '';
  const analysisBlock = currentAnalysis
    ? `\n**当前分析文档**：\n${currentAnalysis}`
    : '';
  const searchBlock = searchContext && searchContext.length > 0
    ? `\n\n**实时网络搜索结果**（系统刚刚从互联网搜索获取的最新信息，时间戳 ${new Date().toISOString()}）：\n${searchContext.map((s, i) => {
        const full = s._fullText ? `\n   **页面全文摘录**：${s._fullText.slice(0, 2000)}` : '';
        return `${i + 1}. [${s.source}] ${s.title}\n   ${(s.snippet || '').slice(0, 300)}${full}`;
      }).join('\n\n')}\n\n**重要**：以上是系统实时搜索返回的当前互联网信息（部分结果包含页面全文摘录）。请基于这些搜索结果中的具体事实、数据、产品名称、事件来构建和更新分析文档。如果搜索结果与你内部知识有冲突，以搜索结果为准——搜索结果是实时获取的，比你训练数据中的信息更新。绝对不要说"尚未公布"、"尚未发生"等基于过时知识的断言，除非搜索结果本身明确这样说明。`
    : '';

  return `你是一位资深技术分析师，正在与用户进行洞察 brainstorm。

**洞察课题**：${topic}${historyBlock}${analysisBlock}${searchBlock}

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

// === Deep Research Prompts ===

export function getDeepResearchPlanPrompt(topic, domain, analysisDoc) {
  const domainHint = domain ? `\n领域：${domain === 'cybersecurity' ? '网络安全' : '软件工程'}` : '';
  const analysisBlock = analysisDoc ? `\n\n**Brainstorm 分析文档**（基于初步讨论得出的理解，子问题应与此对齐）：\n${analysisDoc.slice(0, 1500)}` : '';
  return `你是一位资深技术分析师。请将以下研究课题拆解为可以独立研究的子问题，并为每个子问题生成最优的英文搜索关键词。

**课题**：${topic}${domainHint}${analysisBlock}

要求：
1. 拆解为 3-5 个子问题，每个子问题应该聚焦于课题的一个关键维度
2. 子问题应覆盖：技术方案对比、最新进展、安全/风险考量、落地实践、未来趋势
3. 每个子问题生成 1 个英文搜索 query（2-6 个词，适合搜索引擎）
4. 输出严格 JSON，不要其他内容

输出格式：
{
  "subQuestions": [
    {"id": "q1", "question": "子问题描述（中文）", "searchQuery": "English search query"}
  ]
}`;
}

export function getReflectPrompt(topic, subQuestions, findingsByRound, roundNum) {
  const sqList = subQuestions.map(q => `- [${q.id}] ${q.question}`).join('\n');
  const findingsBlock = findingsByRound.map((round, i) =>
    `### 第 ${i + 1} 轮发现\n${round.map(item =>
      `- [${item.source}] ${item.title}: ${(item._summary || item.snippet || '').slice(0, 200)}`
    ).join('\n')}`
  ).join('\n\n');

  return `你是一位资深技术分析师。你正在进行深度研究，当前已完成第 ${roundNum} 轮搜索和分析。请评估信息是否充分。

**研究课题**：${topic}

**待研究的子问题**：
${sqList}

**已发现的素材**：
${findingsBlock}

请评估每个子问题的信息充分度，如果某子问题尚无相关信息则标注为缺口，并为缺口生成新的搜索关键词。

输出严格 JSON：
{
  "overallSufficient": true或false,
  "gaps": [
    {"subQuestionId": "q2", "reason": "缺口说明", "nextSearchQuery": "新的英文搜索关键词"}
  ],
  "summary": "一句话总结当前研究进展"
}

规则：
- overallSufficient: 当每个子问题都有至少 1 条相关素材时为 true，否则为 false
- gaps: 仅列出确实没有信息覆盖的子问题，不要为了凑数制造缺口
- 如果所有子问题都有覆盖，gaps 为空数组
- 当前已是第 ${roundNum} 轮，如果已经比较充分（有核心发现覆盖主要子问题），建议 overallSufficient=true`;
}

export function getSearchQueryPrompt(topic, subQuestion) {
  return `为以下研究子问题生成一个最优的英文搜索引擎查询关键词（2-6 个词）。

研究课题：${topic}
子问题：${subQuestion}

要求：关键词应精准、具体，适合在 Google/搜索引擎中检索高质量技术文章。
只输出查询关键词，不要引号、不要其他内容。`;
}

export function getDeepResearchBodyPrompt(topic, subQuestions, allAnalyzed, lastReflection) {
  const sqBlock = subQuestions.map(q => `- ${q.question}`).join('\n');
  const summaryBlock = allAnalyzed.slice(0, 20).map((item, i) =>
    `${i + 1}. [${item.source}] ${item.title}\n   摘要: ${(item._summary || item.snippet || '').slice(0, 300)}\n   关键点: ${(item._keyPoints || []).join('; ') || '无'}\n   链接: ${item.url || '无'}`
  ).join('\n\n');
  const reflectBlock = lastReflection?.summary || '多轮搜索和分析完成';

  const noMaterials = allAnalyzed.length === 0;

  return `你是一位资深技术分析师。系统刚刚为你执行了多轮网络搜索和内容分析，以下是搜索结果。

**研究课题**：${topic}

**研究覆盖的子问题**：
${sqBlock}

**网络搜索获取的素材**：
${noMaterials ? '（本轮搜索未获取到有效素材，请基于你的内部知识撰写报告，并明确标注哪些信息需要进一步验证。）' : summaryBlock}

**研究反思**：${reflectBlock}

**重要指令 — 请严格遵守**：
- 上述素材是系统通过网络搜索引擎实时获取的，你就是搜索的执行者和使用者
- **绝对不能说**"我无法搜索"、"我无法访问网络"、"我的知识截止于"、"建议您访问XX官网"等推脱用语
- 你拥有完整的网络搜索结果，必须基于这些素材（${noMaterials ? '并结合你的内部知识' : ''}）撰写报告
- 如果素材中没有覆盖到某个子问题的具体信息，在报告中说明"当前搜索未找到该方面信息"，并基于已有材料和相关知识给出分析框架
- 不要引用你自己的"知识截止日期"或"训练数据"——你现在是一个具备搜索能力的分析师

报告要求：
1. 标题用"# ${topic}"，后续章节按逻辑组织（## 二级标题）
2. 报告应涵盖：核心发现、技术对比分析、关键洞察、落地建议、未来展望
3. 引用素材时注明来源（如"[[来源名称]](https://...)"）
4. 正文应有深度和可操作性，避免空泛
5. 直接输出 Markdown，不要其他包装内容。`;
}

// === Deep Research v3 Prompts ===

// Brainstorm prompt for v3: goal is to produce a confirmed analysis task list, not general analysis doc.
// Accumulates tasks across dialogue turns. Search results injected for real-time context.
export function getBrainstormTaskPrompt(topic, chatHistory, currentTasks, newMessage, searchContext) {
  const historyBlock = chatHistory.length > 0
    ? '\n**对话历史**：\n' + chatHistory.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n')
    : '';
  const tasksBlock = currentTasks && currentTasks.length > 0
    ? `\n**当前已梳理的分析任务清单**：\n${currentTasks.map((t, i) => `${i + 1}. [${t.id}] ${t.title} — ${t.description}`).join('\n')}`
    : '';
  const searchBlock = searchContext && searchContext.length > 0
    ? `\n\n**实时网络搜索结果**（系统刚刚从互联网搜索获取，时间戳 ${new Date().toISOString()}）：\n${searchContext.map((s, i) => {
        const full = s._fullText ? `\n   **页面全文摘录**：${s._fullText.slice(0, 2000)}` : '';
        return `${i + 1}. [${s.source}] ${s.title}\n   ${(s.snippet || '').slice(0, 300)}${full}`;
      }).join('\n\n')}\n\n**重要**：搜索结果是实时获取的当前互联网信息。如果搜索结果与你内部知识有冲突，以搜索结果为准。利用搜索结果中的具体事实、数据、产品名称来佐证或修正任务方向。`
    : '';

  return `你是一位资深技术分析师，正在与用户协作明确一项深度研究的分析任务范围。

**研究课题**：${topic}${historyBlock}${tasksBlock}${searchBlock}

**用户新消息**：${newMessage}

你的核心目标是帮助用户**明确和细化分析任务清单**——不是泛泛分析课题，而是产出可执行的研究任务。

请根据用户的新消息，更新分析任务清单，并给出一句简短的对话回复。

**分析任务清单规则**：
- 每个任务应有明确的分析角度和可验证的产出
- 任务之间应有区分度，不重叠
- 随对话逐步积累和细化——用户可以补充、合并、拆分、删除任务
- 任务数量没有硬性限制，但每个任务都应"值得独立研究"
- 如果用户发送"确认"、"没问题"、"开始分解"等确认类指令，将当前任务清单标记为已确认（不再追加新任务，只做最终整理）

**输出格式**（严格 JSON，不要其他内容）：
{
  "tasks": [
    {"id": "t1", "title": "任务标题（简洁，5-10字）", "description": "一句话描述该任务要分析什么"}
  ],
  "confirmed": false,
  "reply": "一句话告诉用户做了什么更新，并引导继续补充或确认"
}

规则：
1. tasks 是累积的——保留已有任务，根据新消息增补、合并或修订
2. 首次对话时 tasks 应有 3-5 个初始任务
3. confirmed 仅在用户明确确认时为 true
4. reply 简短（1-2 句），说明更新了什么`;
}

// Decompose a single task into next-level subtasks.
// level: 1 (decompose to L2) or 2 (decompose to L3)
export function getTaskDecomposePrompt(task, level, parentContext) {
  const contextBlock = parentContext
    ? `\n**父任务背景**：${parentContext}`
    : '';
  const depthHint = level === 2
    ? '这是第 2 层分解（L2→L3），子任务应更加具体、聚焦于单一技术点或案例。每个子任务应该可以通过 1-2 次搜索获得充分信息。'
    : '这是第 1 层分解（L1→L2），子任务应覆盖该顶层任务的不同维度。每个子任务应是一个可独立研究的方向。';

  return `你是一位资深技术分析师。请将以下分析任务分解为更细粒度的子任务。

**待分解任务**：[${task.id}] ${task.title}
**任务描述**：${task.description}${contextBlock}

${depthHint}

要求：
1. 分解为 2-4 个子任务，每个聚焦于该任务的一个关键方面
2. 子任务标题简洁（5-10 字），描述一句话说清要研究什么
3. 每个子任务应独立可执行——可以单独搜索、分析、产出结论
4. 输出严格 JSON 数组，不要其他内容

输出格式：
[
  {"id": "${task.id}-1", "title": "子任务标题", "description": "一句话描述"},
  {"id": "${task.id}-2", "title": "子任务标题", "description": "一句话描述"}
]`;
}

// Execute a single leaf task: analyze search results and produce structured findings.
// round: 1 or 2 (if round 2, previousAnalysis is provided for gap-filling)
export function getTaskExecutePrompt(task, searchResults, round, previousAnalysis) {
  const taskBlock = `**研究任务**：[${task.id}] ${task.title}\n**任务描述**：${task.description}`;
  const resultsBlock = searchResults.length > 0
    ? searchResults.map((r, i) =>
        `${i + 1}. [${r.source}] ${r.title}\n   URL: ${r.url || '无'}\n   摘要: ${(r.snippet || '').slice(0, 300)}`
      ).join('\n\n')
    : '（本轮搜索未获取到有效结果）';
  const prevBlock = previousAnalysis
    ? `\n**上一轮分析结果**：\n${previousAnalysis}\n\n这是第 2 轮补搜，请重点针对上一轮的缺口进行补充分析，并将新发现合并到已有分析中。`
    : '';

  return `你是一位资深技术分析师。系统已为你执行了网络搜索，请基于搜索结果对以下任务进行分析。

${taskBlock}

**搜索结果**（系统实时搜索获取）：
${resultsBlock}${prevBlock}

**重要指令**：
- 搜索结果是通过网络搜索引擎实时获取的，你就是搜索的执行者和使用者
- 如果搜索结果与你内部知识有冲突，以搜索结果为准
- **绝对不要说**"我无法搜索"、"我的知识截止于"、"建议您访问XX官网"等推脱用语
- 如果搜索结果不包含某方面信息，在分析中如实说明"搜索未覆盖该方面"，并基于已有材料给出分析框架

要求：
1. analysis: 200-400 字的分析，覆盖任务核心问题
2. keyFindings: 3-5 条关键发现，每条一句话，有具体数据或事实支撑
3. sources: 列出支撑分析的关键来源（1-3 条），每条包含 title、url、relevance（为什么相关）

输出严格 JSON：
{
  "analysis": "200-400 字的综合分析",
  "keyFindings": ["发现1", "发现2", "发现3"],
  "sources": [
    {"title": "来源标题", "url": "https://...", "relevance": "为什么与此任务相关"}
  ]
}`;
}

// Per-task Reflect: assess if a single leaf task has sufficient information.
// More focused than v2's global reflect — only for one task, max 2 rounds.
export function getTaskReflectPrompt(task, analysis, keyFindings, sources, round) {
  return `你是一位资深技术分析师。请评估以下研究任务的信息充分度。

**研究任务**：[${task.id}] ${task.title}
**任务描述**：${task.description}

**第 ${round} 轮分析结果**：
${analysis}

**关键发现**：
${(keyFindings || []).map(f => `- ${f}`).join('\n')}

**已有来源**（${(sources || []).length} 条）：
${(sources || []).map(s => `- ${s.title}: ${s.relevance}`).join('\n')}

请评估该任务的信息是否已经充分，是否需要补充搜索。

输出严格 JSON：
{
  "sufficient": true或false,
  "gaps": [
    {"reason": "缺口说明（如缺少具体数据/案例/对比）", "nextSearchQuery": "英文搜索关键词（2-6词）"}
  ],
  "summary": "一句话评估"
}

规则：
- sufficient: 当分析覆盖了任务描述中的核心问题，且有至少 2 条具体来源支撑时为 true
- 当前已是第 ${round} 轮，最多只做 1 轮补搜，建议充分度标准适当放宽
- gaps 最多 2 条，只列确实关键的信息缺口
- summary 一句话概括当前充分度`;
}

// L1 summary: after all subtasks of an L1 task complete, synthesize a concise summary.
export function getL1SummaryPrompt(l1Task, childrenResults) {
  const childrenBlock = childrenResults.map((c, i) =>
    `${i + 1}. **${c.title}**\n   关键发现: ${(c.keyFindings || []).join('; ') || '无'}\n   分析: ${(c.analysis || c.summary || '').slice(0, 200)}`
  ).join('\n\n');

  return `你是一位资深技术分析师。请基于以下子任务的研究结果，对顶层任务进行综合小结。

**顶层任务**：[${l1Task.id}] ${l1Task.title}
**任务描述**：${l1Task.description}

**子任务研究结果**：
${childrenBlock}

请输出 2-3 段话的小结（约 200 字），涵盖：
1. 该任务的总体研究发现
2. 跨子任务的共性和差异
3. 值得关注的关键洞察或趋势

直接输出小结文本，不要 JSON 包裹。`;
}

// Generate structured report from the complete task tree and execution results.
export function getStructuredReportPrompt(topic, domain, taskTree, allResults, l1Summaries) {
  const domainLabel = domain === 'cybersecurity' ? '网络安全' : '软件工程';
  const dateStr = new Date().toISOString().slice(0, 10);

  // Build task tree outline
  function buildTreeOutline(nodes, depth = 0) {
    let out = '';
    for (const node of nodes) {
      const prefix = '  '.repeat(depth) + '- ';
      out += `${prefix}[${node.id}] ${node.title}`;
      const result = allResults[node.id];
      if (result) {
        out += ` → 已研究 (${(result.keyFindings || []).length} 条发现, ${(result.sources || []).length} 条来源)`;
      }
      out += '\n';
      if (node.children && node.children.length > 0) {
        out += buildTreeOutline(node.children, depth + 1);
      }
    }
    return out;
  }

  const treeOutline = buildTreeOutline(taskTree);

  // Build results detail block
  const resultsBlock = Object.entries(allResults).map(([id, r]) => {
    const task = findTaskById(taskTree, id);
    const taskTitle = task ? task.title : id;
    return `### ${taskTitle} [${id}]
**关键发现**：
${(r.keyFindings || []).map(f => `- ${f}`).join('\n')}
**分析**：${(r.analysis || r.summary || '').slice(0, 500)}
**来源**：
${(r.sources || []).map(s => `- [${s.title}](${s.url || '#'}) — ${s.relevance}`).join('\n')}`;
  }).join('\n\n');

  // L1 summaries block
  const summaryBlock = Object.entries(l1Summaries || {}).map(([id, s]) =>
    `**${id} 小结**：${s}`
  ).join('\n\n');

  return `你是一位资深技术分析师。请基于以下结构化深度研究的结果，撰写最终报告。

**研究课题**：${topic}
**领域**：${domainLabel}
**日期**：${dateStr}

**研究任务树**：
${treeOutline}

**L1 任务小结**：
${summaryBlock || '无'}

**各叶子任务研究详情**：
${resultsBlock || '无'}

**报告要求**：
1. 标题用 "# ${topic}"，副标题 "深度研究报告 — ${dateStr}"
2. 按任务树层级组织章节：
   - ## 一级标题 = L1 任务
   - ### 二级标题 = L2 子任务（如有）
   - #### 三级标题 = L3 叶子任务（如有）
3. 每个叶子任务节点应包含：关键发现 + 支撑来源（带链接）
4. 在报告末尾添加"## 研究覆盖范围"章节，列出任务树全貌和每个任务的搜索覆盖情况
5. 来源引用使用 [[来源名称]](URL) 格式
6. 正文应有深度和可操作性，避免空泛
7. 直接输出 Markdown，不要包含 <thinking> 或任何 XML 标签

**重要**：上述研究结果是系统通过多轮网络搜索和分析获得的。你就是搜索的执行者。绝对不要说"我无法搜索"、"我的知识截止于"等推脱用语。`;
}

// Helper: find a task node in the tree by ID
function findTaskById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findTaskById(node.children, id);
      if (found) return found;
    }
  }
  return null;
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
