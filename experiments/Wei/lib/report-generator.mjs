import { createProvider } from './llm-provider.mjs';
import { getSurveyPrompt, getAutoTagPrompt, getDomainClassifyPrompt, getFollowUpPrompt, getSummarizePrompt } from './prompts.mjs';
import { markdownToHTML } from './markdown-to-html.mjs';
import { saveReport, loadReportMeta, loadReportMarkdown, updateReportMeta } from './storage.mjs';
import { getSkillsForTopic } from './feedback.mjs';
import { generatePptx } from './pptx-generator.mjs';
import crypto from 'crypto';
import path from 'path';

function generateMarpMarkdown(markdown, topic, tags) {
  const allTags = [...new Set([...(tags.user || []), ...(tags.auto || [])])];
  const frontmatter = `---
marp: true
theme: default
paginate: true
backgroundColor: #fff
style: |
  section { font-size: 22px; }
  h1 { font-size: 36px; }
  h2 { font-size: 28px; color: #2563eb; }
  h3 { font-size: 22px; }
  table { font-size: 16px; }
  ul, ol { font-size: 20px; }
  p { font-size: 20px; }
---

<!-- _class: lead -->

# ${topic}

**${allTags.join(' · ')}**

---

`;

  const sections = markdown.split(/\n## /).slice(1);
  const slides = [];

  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();

    if (body.includes('### ')) {
      const subs = body.split(/\n### /);
      const intro = subs[0].trim();
      if (intro) slides.push(`## ${title}\n\n${truncate(intro)}`);
      for (let i = 1; i < subs.length; i++) {
        const subLines = subs[i].split('\n');
        slides.push(`### ${subLines[0].trim()}\n\n${truncate(subLines.slice(1).join('\n').trim())}`);
      }
    } else if (body.includes('|')) {
      slides.push(...splitTable(title, body));
    } else {
      slides.push(`## ${title}\n\n${truncate(body)}`);
    }
  }

  return frontmatter + slides.join('\n\n---\n\n');
}

function truncate(text, maxChars = 600) {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSentence = cut.lastIndexOf('。');
  const lastPeriod = cut.lastIndexOf('. ');
  const breakAt = Math.max(lastSentence, lastPeriod);
  return (breakAt > maxChars * 0.3 ? cut.slice(0, breakAt + 1) : cut) + '\n\n*(...)*';
}

function splitTable(title, body) {
  const lines = body.split('\n');
  const tableStart = lines.findIndex(l => l.trim().startsWith('|'));
  if (tableStart < 0) return [`## ${title}\n\n${truncate(body)}`];

  const before = lines.slice(0, tableStart).join('\n').trim();
  const tableLines = [];
  for (let i = tableStart; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|')) tableLines.push(lines[i]);
    else break;
  }
  if (tableLines.length <= 2) return [`## ${title}\n\n${body}`];

  const header = tableLines[0], sep = tableLines[1], rows = tableLines.slice(2);
  const slides = [];
  if (before) slides.push(`## ${title}\n\n${truncate(before)}`);

  const PER = 3;
  for (let i = 0; i < rows.length; i += PER) {
    const chunk = rows.slice(i, i + PER);
    const pg = rows.length > PER ? ` (${Math.floor(i / PER) + 1}/${Math.ceil(rows.length / PER)})` : '';
    slides.push(`## ${title}${pg}\n\n${header}\n${sep}\n${chunk.join('\n')}`);
  }

  const after = lines.slice(tableStart + tableLines.length).join('\n').trim();
  if (after) slides.push(`## ${title}\n\n${truncate(after)}`);
  return slides;
}

function cleanLLMOutput(text) {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .replace(/<search_quality_reflection>[\s\S]*?<\/search_quality_reflection>/gi, '')
    .trim();
}

async function classifyDomain(llm, topic) {
  try {
    const res = await llm.generate(getDomainClassifyPrompt(topic), { maxTokens: 128 });
    const match = res.text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.domains || ['software-engineering'];
    }
  } catch (_) {}
  return ['software-engineering'];
}

export async function generateSurvey({ topic, timeRange, userTags = [], provider = 'claude', domain, feedbackHint, template = 'tech-blue' }) {
  const llm = createProvider(provider);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // 自动判断领域
  let resolvedDomain = domain;
  if (!resolvedDomain) {
    console.log(`[0/3] 自动判断课题领域 ...`);
    const domains = await classifyDomain(llm, topic);
    resolvedDomain = domains[0];
    console.log(`  领域: ${domains.join(', ')}`);
  }

  console.log(`[1/3] 生成综述报告：${topic} ...`);

  const skills = getSkillsForTopic(topic);
  let skillHint = '';
  if (skills.length > 0) {
    console.log(`  发现 ${skills.length} 个相关 Skill，注入 prompt`);
    skillHint = '\n\n请特别注意以下来自历史反馈的要求：\n' +
      skills.map(s => `- [${s.type}] ${s.content}`).join('\n');
  }

  const prompt = getSurveyPrompt(topic, timeRange, resolvedDomain) + skillHint +
    (feedbackHint ? `\n\n用户对上一版报告的反馈，请在本次生成中重点改进：\n${feedbackHint}` : '');
  const result = await llm.generate(prompt);
  let markdown = cleanLLMOutput(result.text);

  console.log(`[2/3] 自动提取标签 ...`);
  let autoTags = [];
  try {
    const tagResult = await llm.generate(getAutoTagPrompt(markdown), { maxTokens: 256 });
    const match = tagResult.text.match(/\[[\s\S]*?\]/);
    if (match) autoTags = JSON.parse(match[0]);
  } catch (_) {
    console.log('  标签提取失败，跳过');
  }

  const tags = { user: userTags, auto: autoTags };
  const inputCost = (result.usage.input / 1_000_000) * 3;
  const outputCost = (result.usage.output / 1_000_000) * 15;
  const metadata = {
    inputTokens: result.usage.input,
    outputTokens: result.usage.output,
    cost: inputCost + outputCost,
    llmProvider: provider,
  };

  console.log(`[3/3] 生成 HTML + Marp + 存储 ...`);
  const html = markdownToHTML(markdown, topic, { createdAt, tags, cost: metadata.cost, llmProvider: provider, reportId: id, domain: resolvedDomain });
  const marpMarkdown = generateMarpMarkdown(markdown, topic, tags);

  const report = { id, title: topic, createdAt, type: 'survey', domain: resolvedDomain, tags, markdown, html, marpMarkdown, metadata };
  const { dir, slug, relPath } = saveReport(report);

  // 生成可编辑 PPTX
  try {
    const pptxPath = path.join(dir, `${slug}.pptx`);
    await generatePptx({
      markdown, title: topic, template, provider,
      meta: { domain: resolvedDomain, tags, date: createdAt.slice(0, 10), llmProvider: provider, cost: metadata.cost },
      outputPath: pptxPath,
    });
    console.log(`  PPTX: ${pptxPath}`);
  } catch (err) {
    console.log(`  PPTX 生成失败: ${err.message}`);
  }

  console.log(`\n报告生成完成`);
  console.log(`  HTML: ${dir}/${slug}.html`);
  console.log(`  标签: [${[...userTags, ...autoTags].join(', ')}]`);
  console.log(`  Token: ${result.usage.input} in / ${result.usage.output} out`);
  console.log(`  成本: $${metadata.cost.toFixed(4)}`);

  return { ...report, path: relPath };
}

export async function generateFollowUp({ parentReportId, question, provider = 'claude' }) {
  const llm = createProvider(provider);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const parentMeta = loadReportMeta(parentReportId);
  if (!parentMeta) throw new Error(`找不到父报告: ${parentReportId}`);

  const parentMd = loadReportMarkdown(parentReportId);
  let parentSummary = parentMd ? parentMd.slice(0, 2000) : parentMeta.title;

  // 获取对话历史
  let history = parentMeta.conversationHistory || [];

  // 超过 5 轮，摘要压缩前文
  if (history.length >= 5) {
    console.log(`  对话历史超过 5 轮，自动摘要压缩 ...`);
    const summaryRes = await llm.generate(getSummarizePrompt(parentMd || ''), { maxTokens: 512 });
    parentSummary = cleanLLMOutput(summaryRes.text);
    history = history.slice(-3);
  }

  console.log(`[1/2] 生成追问报告：${question} ...`);
  const prompt = getFollowUpPrompt(question, parentSummary, history);
  const result = await llm.generate(prompt);
  let markdown = cleanLLMOutput(result.text);

  const tags = parentMeta.tags || { user: [], auto: [] };
  const metadata = {
    inputTokens: result.usage.input,
    outputTokens: result.usage.output,
    cost: (result.usage.input / 1_000_000) * 3 + (result.usage.output / 1_000_000) * 15,
    llmProvider: provider,
  };

  console.log(`[2/2] 生成 HTML + 存储 ...`);
  const title = `追问：${question.slice(0, 50)}`;
  const html = markdownToHTML(markdown, title, { createdAt, tags, cost: metadata.cost, llmProvider: provider, reportId: id, domain: parentMeta.domain });
  const marpMarkdown = generateMarpMarkdown(markdown, title, tags);

  // 更新对话历史
  const answerSummary = markdown.slice(0, 300);
  const newHistory = [...(parentMeta.conversationHistory || []), { question, answerSummary }];
  updateReportMeta(parentReportId, { conversationHistory: newHistory });

  const report = {
    id, title, createdAt, type: 'follow-up', domain: parentMeta.domain,
    parentReportId, tags, markdown, html, marpMarkdown, metadata,
    conversationHistory: newHistory,
  };
  const { dir, slug, relPath } = saveReport(report);

  console.log(`  追问报告: ${dir}/${slug}.html`);
  return { ...report, path: relPath };
}
