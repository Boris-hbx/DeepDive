// LLM-based content structurer: markdown → slide deck JSON
// Replaces fragile regex-based markdown parsing with semantic understanding

import { createProvider } from '../llm-provider.mjs';
import { matchSkills } from '../skills/index.mjs';
import { recallContext } from '../memory/index.mjs';

const STRUCTURE_PROMPT = (markdown, title, extraHints) => `你是一位 PPT 设计专家。请将以下技术报告的 Markdown 内容结构化为一组幻灯片定义。

## 输出格式

严格输出 JSON 数组，每项表示一页幻灯片：

\`\`\`json
[
  { "type": "cover", "title": "报告标题", "subtitle": "副标题或标签" },

  { "type": "tldr", "title": "TL;DR", "items": ["要点1", "要点2", "要点3"] },

  { "type": "content", "title": "小节标题", "body": "正文段落（保留关键数据和技术细节）", "imageHint": "英文配图关键词" },

  { "type": "bullets", "title": "要点列表", "items": ["项1", "项2"] },

  { "type": "table", "title": "对比表格", "headers": ["方案", "优势", "劣势"], "rows": [["A", "...", "..."], ["B", "...", "..."]] },

  { "type": "timeline", "title": "发展时间线", "items": ["2024-01 事件A", "2024-06 事件B"] },

  { "type": "quote", "text": "引用原文关键句", "attribution": "来源" },

  { "type": "code", "title": "代码示例", "code": "const x = 1;", "lang": "javascript" },

  { "type": "twoColumn", "title": "双栏", "left": "左侧内容", "right": "右侧内容" },

  { "type": "stats", "title": "关键数据", "stats": [{"label": "提升", "value": "40%"}, {"label": "延迟", "value": "<10ms"}] },

  { "type": "closing", "text": "谢谢" }
]
\`\`\`

## 规则

1. 每页幻灯片内容要精炼，正文不超过 200 字，要点不超过 6 条
2. 表格超过 4 行时分页（每页 4 行），标题加 "(1/2)" 后缀
3. 代码块标注语言类型；无合适代码则跳过
4. 时间线事件按时间排序，最多 8 条
5. 对比分析、趋势部分优先用 table 或 stats 类型，不要全用 content
6. 涉及数据对比的地方尽量提取为 stats 类型
7. 英文技术术语保留原文
8. 总共生成 8～20 页幻灯片
9. 只输出 JSON 数组，不要包含 markdown 代码块标记、不要 <thinking> 标签

${extraHints}

## 报告标题

${title}

## 报告内容

${markdown.slice(0, 8000)}

请只输出 JSON 数组：`;

export async function structureSlides(markdown, title, { provider = '', domain = '' } = {}) {
  const llm = createProvider(provider);

  // Gather extra hints from skills and memory
  let extraHints = '';

  // Skill hints for prePrompt hooks
  const skills = matchSkills(title, domain);
  const prePromptSkills = skills.filter(s => s.hooks && s.hooks.includes('prePrompt'));
  if (prePromptSkills.length > 0) {
    extraHints += '\n## Skill 建议\n';
    for (const s of prePromptSkills) {
      extraHints += `- ${s.content}\n`;
    }
  }

  // Memory hints
  const { memories } = recallContext(title, domain, 2);
  if (memories.length > 0) {
    extraHints += '\n## 历史参考\n';
    extraHints += '过往类似报告的幻灯片结构可参考：\n';
    for (const m of memories) {
      extraHints += `- ${m.title}: ${m.summary.slice(0, 100)}\n`;
    }
  }

  console.log(`  [PPT 结构化] LLM 分析内容生成幻灯片 ...`);

  try {
    const prompt = STRUCTURE_PROMPT(markdown, title, extraHints);
    const result = await llm.generate(prompt, { maxTokens: 4096 });

    // Clean and parse
    let raw = result.text.trim();
    // Remove any markdown code fences if LLM included them
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    // Try to find JSON array
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const slides = JSON.parse(match[0]);
      console.log(`  [PPT 结构化] 生成 ${slides.length} 页幻灯片`);
      return { slides, usage: result.usage };
    }
  } catch (err) {
    console.log(`  [PPT 结构化] LLM 结构化失败，降级为简单解析: ${err.message}`);
  }

  // Fallback: simple regex-based parsing
  return fallbackStructure(markdown, title);
}

// Fallback when LLM structuring fails
function fallbackStructure(markdown, title) {
  const slides = [{ type: 'cover', title }];

  const parts = markdown.split(/\n## /);
  for (let i = 1; i < parts.length; i++) {
    const lines = parts[i].split('\n');
    const heading = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();

    if (body.includes('|') && body.split('\n').filter(l => l.includes('|')).length > 2) {
      slides.push({ type: 'table', title: heading, body });
    } else {
      const bulletItems = body.split('\n').filter(l => /^[-*]\s/.test(l) || /^\d+\.\s/.test(l));
      if (bulletItems.length >= 3) {
        slides.push({ type: 'bullets', title: heading, items: bulletItems.map(b => b.replace(/^[-*\d.]+\s*/, '').trim()).slice(0, 6) });
      } else {
        slides.push({ type: 'content', title: heading, body: body.slice(0, 300) });
      }
    }
  }

  slides.push({ type: 'closing', text: '' });
  return { slides, usage: null };
}
