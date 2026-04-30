import { fetchAllSources } from '../fetcher.mjs';
import { rankItems } from '../ranker.mjs';
import { createProvider } from '../llm-provider.mjs';
import { getDocAnalysisPrompt, getOutlinePrompt, getBodyGenerationPrompt, getModifyPrompt, getInitialThinkingPrompt, getBrainstormUpdatePrompt, getOutlineFromChatPrompt, getOutlineModifyPrompt } from '../prompts.mjs';
import { detectIntent } from './intent.mjs';
import { getInterestByKeyword } from '../memory/article-feedback.mjs';
import { getSession, pushSnapshot, popSnapshot } from '../session-manager.mjs';
import { saveReport } from '../storage.mjs';
import { markdownToHTML } from '../markdown-to-html.mjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.join(__dirname, '..', '..', 'sources.json');

function cleanLLM(text) {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .trim();
}

// Stage 0: LLM initial thinking based on own knowledge
async function initialThinking(session, provider) {
  console.log('[pipeline] initialThinking called');
  session.stage = 'thinking';
  session.events.emit('progress', { stage: 'thinking', detail: '正在基于已有知识进行初步分析...' });

  const prompt = getInitialThinkingPrompt(session.topic, session.domain, session.timeRange);
  console.log('[pipeline] calling LLM generate, prompt length:', prompt.length);

  try {
    console.log('[pipeline] awaiting LLM...');
    const result = await provider.generate(prompt, { maxTokens: 4096 });
    console.log('[pipeline] LLM returned, text length:', result.text.length);
    const thinking = cleanLLM(result.text);
    session._thinking = thinking;
    session.events.emit('thinking', { content: thinking });
    session.stage = 'awaiting_sources';
    session.events.emit('progress', { stage: 'awaiting_sources', detail: '初步分析完成。可添加更多信息源或点击"自动搜索"深化分析。' });
  } catch (err) {
    console.log(`  [thinking] 失败: ${err.message}`);
    session._thinking = '';
    session.stage = 'awaiting_sources';
    session.events.emit('error', { message: '初步分析失败: ' + err.message });
    session.events.emit('progress', { stage: 'awaiting_sources', detail: '初步分析失败，可手动添加信息源继续。' });
  }
}

// Stage 1: Fetch sources
async function fetchSources(session, sources) {
  session.stage = 'fetching';
  session.events.emit('progress', { stage: 'fetching', detail: `正在从 ${sources.length} 个信息源搜索...` });

  const allItems = await fetchAllSources(sources);
  session.items = allItems;
  session.events.emit('progress', { stage: 'fetching', detail: `搜索完成，共 ${allItems.length} 条结果` });

  // Send documents in batches of 10
  for (let i = 0; i < allItems.length; i += 10) {
    session.events.emit('documents', { items: allItems.slice(i, i + 10), hasMore: i + 10 < allItems.length });
  }
}

// Stage 2: Rank and filter
async function rankAndFilter(session, domainConfig) {
  session.stage = 'ranking';
  session.events.emit('progress', { stage: 'ranking', detail: '正在评估和排序信息源...' });

  const authMap = {};
  for (const src of (domainConfig.sources || [])) {
    authMap[src.name] = src.authority ?? 0.5;
  }
  const domainKeywords = new Set();
  for (const src of (domainConfig.sources || [])) {
    if (src.keywords) {
      for (const kw of src.keywords) domainKeywords.add(kw.toLowerCase());
    }
  }
  let interestKeywordMap = null;
  try {
    interestKeywordMap = getInterestByKeyword(domainConfig.domain || '');
  } catch (_) {}

  const rankingConfig = domainConfig.ranking || {};
  const ranked = rankItems(session.items, {
    authMap,
    domainKeywords: [...domainKeywords],
    now: new Date(),
    ranking: rankingConfig,
    interestKeywordMap,
  });

  session.items = ranked;
  session.events.emit('progress', { stage: 'ranking', detail: `排序完成，最高分: ${ranked[0]?._score?.toFixed(3) || 'N/A'}` });
}

// Stage 3: Analyze documents — batch LLM call for per-document summaries
async function analyzeDocuments(session, provider) {
  session.stage = 'analyzing';
  const topItems = session.items.slice(0, 20);
  session.events.emit('progress', { stage: 'analyzing', detail: `正在分析 ${topItems.length} 篇文档...` });

  // Batch analyze: 5 docs per LLM call
  const BATCH = 5;
  for (let i = 0; i < topItems.length; i += BATCH) {
    const batch = topItems.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(topItems.length / BATCH);
    session.events.emit('progress', { stage: 'analyzing', detail: `分析文档中 (${i + 1}-${Math.min(i + BATCH, topItems.length)}/${topItems.length})...` });

    try {
      const batchPrompt = `请分析以下 ${batch.length} 篇文章，对每篇输出一个 JSON 对象（含 summary 和 keyPoints），以 JSON 数组返回。

${batch.map((item, j) => `${i + j + 1}. [${item.source}] ${item.title}\n   原文摘要: ${item.snippet.slice(0, 300)}`).join('\n\n')}

只输出 JSON 数组，每个元素格式：{"index": 序号, "summary": "1-2 句话中文总结", "keyPoints": ["关键点1", "关键点2"]}`;

      const result = await provider.generate(batchPrompt, { maxTokens: 1024, maxRetries: 1 });
      const text = cleanLLM(result.text);

      // Parse JSON array
      const arrMatch = text.match(/\[[\s\S]*?\]/);
      if (arrMatch) {
        try {
          const parsed = JSON.parse(arrMatch[0]);
          for (const entry of parsed) {
            const idx = (entry.index || (i + 1)) - 1;
            if (idx >= 0 && idx < topItems.length) {
              topItems[idx]._summary = entry.summary || '';
              topItems[idx]._keyPoints = entry.keyPoints || [];
            }
          }
        } catch (_) {}
      }

      // Emit enriched documents
      session.events.emit('documents', {
        items: batch.map((item, j) => ({
          ...item,
          _summary: item._summary || '',
          _keyPoints: item._keyPoints || [],
        })),
        enriched: true,
        hasMore: i + BATCH < topItems.length,
      });
    } catch (err) {
      console.log(`  [analyze] 批次 ${batchNum}/${totalBatches} 失败: ${err.message}`);
      // Emit without summary on failure
      session.events.emit('documents', {
        items: batch.map(item => ({ ...item, _summary: '', _keyPoints: [] })),
        enriched: true,
        hasMore: i + BATCH < topItems.length,
      });
    }
  }

  session.events.emit('progress', { stage: 'analyzing', detail: '文档分析完成' });
}

// Stage 4: Generate outline
async function generateOutline(session, provider) {
  session.stage = 'outlining';
  session.events.emit('progress', { stage: 'outlining', detail: '正在生成洞察纲要...' });

  const topItems = session.items.slice(0, 20);
  const prompt = getOutlinePrompt(session.topic, topItems);

  try {
    const result = await provider.generate(prompt, { maxTokens: 2048 });
    const text = cleanLLM(result.text);
    const arrMatch = text.match(/\[[\s\S]*?\]/);
    if (arrMatch) {
      const outline = JSON.parse(arrMatch[0]);
      session.outline = outline;
      session.events.emit('outline', { outline });
      session.events.emit('progress', { stage: 'outlining', detail: '纲要生成完成，请确认或编辑后继续' });
    } else {
      throw new Error('无法解析纲要 JSON');
    }
  } catch (err) {
    console.log(`  [outline] 生成失败: ${err.message}，使用默认纲要`);
    // Default fallback outline
    const fallback = [
      { id: '1', title: '概述与背景', level: 1, keyPoints: ['该课题的核心问题域和行业背景'], materials: [], children: [
        { id: '1-1', title: '核心发现', level: 2, keyPoints: ['基于已有信息的关键发现'], materials: [] },
        { id: '1-2', title: '发展趋势', level: 2, keyPoints: ['当前的技术演进方向'], materials: [] },
      ]},
      { id: '2', title: '技术对比分析', level: 1, keyPoints: ['主要技术方案的优劣势对比'], materials: [] },
      { id: '3', title: '可行动建议', level: 1, keyPoints: ['针对技术团队的具体建议'], materials: [] },
    ];
    session.outline = fallback;
    session.events.emit('outline', { outline: fallback });
  }
}

// Stage 5: Generate body via streaming
async function generateBody(session, provider) {
  session.stage = 'generating';
  session.events.emit('progress', { stage: 'generating', detail: '正在生成报告正文...' });

  const topItems = session.items.slice(0, 20);
  const prompt = getBodyGenerationPrompt(session.topic, session.outline, topItems);

  let markdown = '';
  let usage = { input: 0, output: 0 };

  try {
    for await (const event of provider.generateStream(prompt, { maxTokens: 8192 })) {
      if (event.chunk) {
        markdown += event.chunk;
        session.events.emit('content', { chunk: event.chunk });
      }
      if (event.done) {
        usage = event.usage || usage;
      }
    }
  } catch (err) {
    console.log(`  [generate] streaming 失败: ${err.message}，fallback 到非流式`);
    const result = await provider.generate(prompt, { maxTokens: 8192 });
    markdown = cleanLLM(result.text);
    usage = result.usage;
    session.events.emit('content', { chunk: markdown });
  }

  markdown = cleanLLM(markdown);
  session.markdown = markdown;

  const reportId = crypto.randomUUID();
  session._reportId = reportId;
  session.events.emit('done', { reportId, markdown, usage });
  session.stage = 'modifying';
  session.events.emit('progress', { stage: 'done', detail: '报告生成完成，可在左侧继续修改' });
}

// Stage 6: Modify report based on natural language instruction
async function modifyReport(session, instruction, provider) {
  session.stage = 'modifying';

  const prompt = getModifyPrompt(instruction, session.markdown);
  const result = await provider.generate(prompt, { maxTokens: 8192 });
  const modified = cleanLLM(result.text);

  session.markdown = modified;
  return modified;
}

// === Public API ===

export async function startPipeline(sessionId) {
  console.log('[pipeline] startPipeline called, sessionId:', sessionId);
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  console.log('[pipeline] creating provider...');
  const provider = createProvider();
  console.log('[pipeline] provider created:', provider.name);

  // Stage 0: LLM initial thinking — runs immediately, no external sources
  await initialThinking(session, provider);
  console.log('[pipeline] startPipeline done, stage:', session.stage);
}

// Run the full fetch→rank→analyze→outline pipeline on current session.items
async function runSourcePipeline(session) {
  const provider = createProvider();
  const domainConfig = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8'));
  const domainKey = session.domain || 'software-engineering';
  const domainEntry = domainConfig.domains?.[domainKey];
  const sources = domainEntry?.sources || [];
  const rankingConfig = domainConfig.ranking || {};

  // If no items yet, skip
  if (session.items.length === 0) {
    session.events.emit('progress', { stage: 'analyzing', detail: '没有信息源可分析，请添加信息源或使用自动搜索' });
    // Still try to generate outline from thinking alone
    await generateOutlineFromThinking(session, provider);
    return;
  }

  // Rank
  await rankAndFilter(session, { sources, ranking: rankingConfig, domain: domainKey });

  // Analyze documents
  await analyzeDocuments(session, provider);

  // Generate outline
  await generateOutline(session, provider);
}

// Generate outline when we only have thinking (no external sources)
async function generateOutlineFromThinking(session, provider) {
  session.stage = 'outlining';
  session.events.emit('progress', { stage: 'outlining', detail: '正在基于 LLM 分析生成纲要...' });

  // Create synthetic document items from the thinking so outline prompt has context
  session.items = [{
    title: session.topic,
    source: 'LLM 知识库',
    snippet: session._thinking ? session._thinking.slice(0, 500) : session.topic,
    _summary: session._thinking || `课题: ${session.topic}`,
    _keyPoints: [],
    url: '',
    publishedAt: new Date().toISOString(),
    points: null,
    comments: null,
  }];

  await generateOutline(session, provider);
}

export async function addCustomSourcePipeline(sessionId, url) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');
  if (!url) throw new Error('缺少 URL');

  session.events.emit('progress', { stage: 'fetching', detail: `正在抓取自定信息源: ${url}...` });

  let item;
  try {
    // Simple fetch and extract
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const html = await resp.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Extract text content (simple: strip HTML tags)
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);

    item = {
      title,
      url,
      source: '用户自定义',
      publishedAt: new Date().toISOString(),
      snippet: text.slice(0, 500),
      _fullText: text,
      points: null,
      comments: null,
    };
  } catch (err) {
    // Fallback: add as placeholder item with just URL
    item = {
      title: url,
      url,
      source: '用户自定义',
      publishedAt: new Date().toISOString(),
      snippet: `用户添加的参考信息源: ${url}`,
      points: null,
      comments: null,
    };
  }

  // Analyze the custom source
  const provider = createProvider();
  try {
    const result = await provider.generate(
      `请分析以下来自用户的参考信息，输出 JSON：
{"summary": "1-2 句话中文总结", "keyPoints": ["关键点1", "关键点2", "关键点3"]}

信息源 URL: ${url}
标题: ${item.title}
内容: ${item.snippet.slice(0, 500)}

只输出 JSON 对象，不要其他内容。`,
      { maxTokens: 512, maxRetries: 1 }
    );
    const text = cleanLLM(result.text);
    const m = text.match(/\{[\s\S]*?\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        item._summary = parsed.summary || '';
        item._keyPoints = parsed.keyPoints || [];
      } catch (_) {}
    }
  } catch (_) {}

  session.items.push(item);
  session.events.emit('documents', { items: [item], enriched: true, hasMore: false });
  session.events.emit('progress', { stage: 'fetching', detail: `自定义信息源添加完成，共 ${session.items.length} 个信息源` });

  return item;
}

export async function autoSearchPipeline(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const domainConfig = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8'));
  const domainKey = session.domain || 'software-engineering';
  const domainEntry = domainConfig.domains?.[domainKey];
  const sources = domainEntry?.sources || [];

  // Stage 1: Fetch configured sources
  await fetchSources(session, sources);

  // Stage 2-4: Rank → Analyze → Outline
  await runSourcePipeline(session);
}

export async function skipSearchPipeline(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');
  const provider = createProvider();
  await generateOutlineFromThinking(session, provider);
}

export async function confirmOutlinePipeline(sessionId, outline) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  session.outline = outline;
  const provider = createProvider();

  // Stage 5: Generate body
  await generateBody(session, provider);
}

export async function modifyReportPipeline(sessionId, instruction) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  pushSnapshot(session, session.markdown);
  const provider = createProvider();
  const modified = await modifyReport(session, instruction, provider);

  return { markdown: modified, snapshotCount: session.snapshots.length };
}

export async function undoModifyPipeline(sessionId) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const previous = popSnapshot(session);
  if (previous) {
    session.markdown = previous;
  }
  return { markdown: session.markdown, snapshotCount: session.snapshots.length };
}

export async function saveReportPipeline(sessionId, title) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const provider = createProvider();
  const reportId = session._reportId || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const finalTitle = title || session.topic;

  // Extract tags from markdown (simple keyword approach)
  const tags = { user: [], auto: [] };

  const html = markdownToHTML(session.markdown, finalTitle, {
    createdAt,
    tags,
    cost: 0,
    llmProvider: provider.name,
    reportId,
    domain: session.domain || 'software-engineering',
  });

  const report = {
    id: reportId,
    title: finalTitle,
    createdAt,
    type: 'survey',
    domain: session.domain || 'software-engineering',
    tags,
    markdown: session.markdown,
    html,
    metadata: {
      llmProvider: provider.name,
    },
  };

  const result = saveReport(report);
  session.stage = 'done';

  return { reportId, title: finalTitle, path: result.relPath, url: `/reports/${result.relPath}.html` };
}

// === Chat Pipeline (new interaction model) ===

export async function chatPipeline(sessionId, message, domain, emit) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  if (domain && !session.domain) session.domain = domain;
  if (!session.topic) session.topic = message.slice(0, 100);

  session.chatHistory.push({ role: 'user', content: message });

  const intent = detectIntent(message, session.stage);
  const provider = createProvider();

  if (intent === 'brainstorm') {
    session.stage = 'brainstorming';
    const prompt = getBrainstormUpdatePrompt(session.topic, session.chatHistory.slice(0, -1), session.analysisDoc, message);
    const result = await provider.generate(prompt, { maxTokens: 4096 });
    const text = cleanLLM(result.text);

    let analysis = session.analysisDoc;
    let reply = '分析已更新，右侧可查看。可继续补充背景或发送"生成概要"。';

    const jsonMatch = text.match(/\{[\s\S]*"analysis"[\s\S]*"reply"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        analysis = parsed.analysis || analysis;
        reply = parsed.reply || reply;
      } catch (_) {
        analysis = text;
      }
    } else {
      analysis = text;
    }

    session.analysisDoc = analysis;
    session.chatHistory.push({ role: 'assistant', content: reply });
    emit('analysis_update', { markdown: analysis });
    emit('reply', { text: reply });
    emit('done', { type: 'analysis' });

  } else if (intent === 'generate_outline') {
    session.stage = 'outline';
    emit('reply', { text: '正在基于 brainstorm 内容生成概要...' });

    const prompt = getOutlineFromChatPrompt(session.topic, session.chatHistory, session.analysisDoc);
    const result = await provider.generate(prompt, { maxTokens: 2048 });
    const text = cleanLLM(result.text);

    let outline = [];
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { outline = JSON.parse(arrMatch[0]); } catch (_) {}
    }

    if (outline.length === 0) {
      outline = [
        { id: '1', title: '概述与背景', level: 1, keyPoints: ['核心问题域'], materials: [], children: [
          { id: '1-1', title: '核心发现', level: 2, keyPoints: ['关键发现'], materials: [] },
        ]},
        { id: '2', title: '技术分析', level: 1, keyPoints: ['主要技术方案对比'], materials: [] },
        { id: '3', title: '可行动建议', level: 1, keyPoints: ['具体建议'], materials: [] },
      ];
    }

    session.outline = outline;
    const replyText = '概要已生成，右侧可查看。可继续修改概要，或发送"生成报告"开始生成正文。';
    session.chatHistory.push({ role: 'assistant', content: replyText });
    emit('outline_update', { outline });
    emit('reply', { text: replyText });
    emit('done', { type: 'outline' });

  } else if (intent === 'modify_outline') {
    const prompt = getOutlineModifyPrompt(message, session.outline);
    const result = await provider.generate(prompt, { maxTokens: 2048 });
    const text = cleanLLM(result.text);

    let outline = session.outline;
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { outline = JSON.parse(arrMatch[0]); } catch (_) {}
    }

    session.outline = outline;
    const replyText = '概要已更新。可继续修改，或发送"生成报告"开始生成正文。';
    session.chatHistory.push({ role: 'assistant', content: replyText });
    emit('outline_update', { outline });
    emit('reply', { text: replyText });
    emit('done', { type: 'outline' });

  } else if (intent === 'generate_report') {
    session.stage = 'generating';
    emit('reply', { text: '开始生成报告正文，请稍候...' });

    // Use analysisDoc as synthetic document context if no real items
    if (session.items.length === 0 && session.analysisDoc) {
      session.items = [{
        title: session.topic,
        source: 'LLM 分析',
        snippet: session.analysisDoc.slice(0, 500),
        _summary: session.analysisDoc.slice(0, 300),
        _keyPoints: [],
        url: '',
        publishedAt: new Date().toISOString(),
        points: null,
        comments: null,
      }];
    }

    const topItems = session.items.slice(0, 20);
    const prompt = getBodyGenerationPrompt(session.topic, session.outline, topItems);

    let markdown = '';
    let usage = { input: 0, output: 0 };

    try {
      for await (const event of provider.generateStream(prompt, { maxTokens: 8192 })) {
        if (event.chunk) {
          markdown += event.chunk;
          emit('content', { chunk: event.chunk });
        }
        if (event.done) usage = event.usage || usage;
      }
    } catch (err) {
      const result = await provider.generate(prompt, { maxTokens: 8192 });
      markdown = cleanLLM(result.text);
      usage = result.usage;
      emit('content', { chunk: markdown });
    }

    markdown = cleanLLM(markdown);
    session.markdown = markdown;
    session.stage = 'done';

    const reportId = crypto.randomUUID();
    session._reportId = reportId;
    session.chatHistory.push({ role: 'assistant', content: '报告正文已生成，可点击"保存报告"保存。' });
    emit('done', { type: 'report', reportId, markdown, usage });
  }
}
