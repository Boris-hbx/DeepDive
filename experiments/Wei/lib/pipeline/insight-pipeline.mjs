import { fetchAllSources } from '../fetcher.mjs';
import { rankItems } from '../ranker.mjs';
import { createProvider } from '../llm-provider.mjs';
import { getDocAnalysisPrompt, getOutlinePrompt, getBodyGenerationPrompt, getModifyPrompt, getInitialThinkingPrompt, getBrainstormTaskPrompt, getTaskDecomposePrompt, getTaskExecutePrompt, getTaskReflectPrompt, getL1SummaryPrompt, getStructuredReportPrompt, getBrainstormUpdatePrompt, getOutlineFromChatPrompt, getOutlineModifyPrompt, getDeepResearchPlanPrompt, getDeepResearchBodyPrompt, getReflectPrompt } from '../prompts.mjs';
import { detectIntent, detectV3BrainstormIntent, detectV3ConfirmIntent } from './intent.mjs';
import { getInterestByKeyword } from '../memory/article-feedback.mjs';
import { getSession, createDeepResearchV3Session, pushSnapshot, popSnapshot } from '../session-manager.mjs';
import { searchBatch, searchWeb } from '../search-provider.mjs';
import { logError } from '../logger.mjs';
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

// Robustly extract the first valid JSON object from LLM output.
// Handles: markdown code fences, trailing garbage, nested braces.
function extractJSON(text) {
  // Strip markdown code fences
  const stripped = text.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1').trim();

  // Find the first '{' and walk forward counting braces to find the matching '}'
  const start = stripped.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(stripped.slice(start, i + 1)); } catch (_) { return null; }
      }
    }
  }
  return null;
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

export async function saveReportPipeline(sessionId, title, opts = {}) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const provider = createProvider();
  const reportId = session._reportId || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const finalTitle = title || session.topic;
  const reportType = opts.type || 'survey';

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
    type: reportType,
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

  const intent = detectIntent(message, session.stage, session._fromDeepResearch);
  const provider = createProvider();

  if (intent === 'brainstorm') {
    session.stage = 'brainstorming';

    // Lightweight search for up-to-date context (3 results, 5s timeout, silent fallback)
    let searchContext = [];
    try {
      const maxResults = 3;
      emit('reply', { text: '正在搜索最新信息辅助分析...' });
      searchContext = await Promise.race([
        searchWeb(message, maxResults),
        new Promise((_, reject) => setTimeout(() => reject(new Error('search_timeout')), 5000)),
      ]);
    } catch (_) {
      // Silent fallback — search is optional, don't block the user
    }

    // Enrich: fetch full content of top non-homepage search result for deeper context
    if (searchContext.length > 0) {
      try {
        // Pick the most promising result: skip conference homepages, prefer articles/analysis
        const candidates = searchContext.filter(s =>
          s.url && !s.url.includes('rsaconference.com/usa') && !s.url.includes('bing.com') && !s.url.includes('zhihu.com')
        );
        const toFetch = candidates.length > 0 ? candidates[0] : null;
        if (toFetch && toFetch.url) {
          const enrichPromise = (async () => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 4000);
            const resp = await fetch(toFetch.url, {
              signal: ctrl.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              },
            });
            clearTimeout(t);
            if (!resp.ok) return;
            const html = await resp.text();
            // Strip HTML tags, scripts, styles
            const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]*>/g, ' ')
              .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
              .replace(/&ensp;/g, ' ').replace(/&#?183;/g, '·').replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ').trim();
            if (text.length > 200) toFetch._fullText = text.slice(0, 3000);
          })();
          await Promise.race([enrichPromise, new Promise(r => setTimeout(r, 4000))]);
        }
      } catch (_) {
        // Enrichment is optional
      }
    }

    const prompt = getBrainstormUpdatePrompt(session.topic, session.chatHistory.slice(0, -1), session.analysisDoc, message, searchContext);
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

  } else if (intent === 'modify_report') {
    session.stage = 'modifying';
    emit('reply', { text: '正在根据您的修改指令更新报告...' });

    const prompt = getModifyPrompt(message, session.markdown);

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
    session.chatHistory.push({ role: 'assistant', content: '报告已按指令修改完成。' });
    emit('done', { type: 'modify', markdown, usage });
  }
}

// === Deep Research Pipeline ===
// Brainstorm → Plan → Search(RSS+Web) → Analyze → Reflect → (loop) → Synthesize(no outline)
export async function deepResearchPipeline(sessionId, domain, emit, analysisDoc) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  session.mode = 'deep';
  session.stage = 'planning';

  const provider = createProvider();
  const domainConfig = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8'));
  const domainKey = domain || 'software-engineering';
  const domainEntry = domainConfig.domains?.[domainKey];
  const sources = domainEntry?.sources || [];
  const MAX_ROUNDS = 3;

  // Stage 1: Plan — LLM decomposes topic into sub-questions (informed by brainstorm analysis)
  emit('progress', { stage: 'planning', detail: '正在结合 Brainstorm 分析拆解研究课题...' });

  let subQuestions = [];
  try {
    const planPrompt = getDeepResearchPlanPrompt(session.topic, domainKey, analysisDoc || session.analysisDoc);
    const planResult = await provider.generate(planPrompt, { maxTokens: 2048 });
    const planText = cleanLLM(planResult.text);
    const parsed = extractJSON(planText);
    if (parsed) {
      subQuestions = parsed.subQuestions || [];
    }
  } catch (err) {
    console.log('  [deep-research] plan 解析失败:', err.message);
    logError({ source: 'deepResearchPipeline.plan', message: err.message, sessionId: session.id });
  }

  if (subQuestions.length === 0) {
    subQuestions = [{ id: 'q1', question: session.topic, searchQuery: session.topic }];
  }

  session.subQuestions = subQuestions;
  emit('plan', { subQuestions });
  emit('progress', { stage: 'planning', detail: `拆解为 ${subQuestions.length} 个子问题，开始搜索...` });

  // Stage 2-4: Research loop — Search → Analyze → Reflect
  const allItems = [];
  const findingsByRound = [];
  let gapQueries = [];
  let lastReflection = null;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    session.stage = 'searching';
    emit('progress', { stage: 'searching', detail: `第 ${round}/${MAX_ROUNDS} 轮搜索中...`, round });

    // Determine search queries
    const searchQueries = round === 1
      ? subQuestions.map(q => q.searchQuery)
      : gapQueries;

    if (searchQueries.length === 0 && round > 1) {
      emit('progress', { stage: 'searching', detail: '无更多搜索方向，结束迭代', round });
      break;
    }

    // Parallel: Web search + RSS fetch (RSS only in round 1)
    const pending = [searchBatch(searchQueries, 5, session.id)];
    if (round === 1 && sources.length > 0) {
      pending.push(fetchAllSources(sources));
    }

    const searchResults = await Promise.all(pending);
    let roundItems = [];
    for (const items of searchResults) roundItems = roundItems.concat(items);

    // Dedup by URL across rounds
    const seenUrls = new Set(allItems.map(i => i.url));
    roundItems = roundItems.filter(i => {
      if (!i.url || seenUrls.has(i.url)) return false;
      seenUrls.add(i.url);
      return true;
    });

    emit('progress', {
      stage: 'searching', detail: `第 ${round} 轮搜索完成，新发现 ${roundItems.length} 条`,
      round, count: roundItems.length,
    });
    emit('search_results', { round, items: roundItems.slice(0, 15) });

    allItems.push(...roundItems);

    if (roundItems.length === 0) {
      findingsByRound.push([]);
      break;
    }

    // Analyze: batch LLM summaries for top items
    session.stage = 'analyzing';
    const topItems = roundItems.slice(0, 10);
    emit('progress', { stage: 'analyzing', detail: `正在分析第 ${round} 轮的 ${topItems.length} 条结果...`, round });

    const BATCH = 5;
    for (let i = 0; i < topItems.length; i += BATCH) {
      const batch = topItems.slice(i, i + BATCH);
      try {
        const batchPrompt = `请分析以下 ${batch.length} 篇文章，对每篇输出一个 JSON 对象（含 summary 和 keyPoints），以 JSON 数组返回。

${batch.map((item, j) => `${i + j + 1}. [${item.source}] ${item.title}\n   摘要: ${(item.snippet || '').slice(0, 300)}`).join('\n\n')}

只输出 JSON 数组，每个元素格式：{"index": 序号, "summary": "1-2 句话中文总结", "keyPoints": ["关键点1", "关键点2"]}`;

        const result = await provider.generate(batchPrompt, { maxTokens: 1024, maxRetries: 1 });
        const text = cleanLLM(result.text);
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
      } catch (err) {
        console.log(`  [deep-research] 分析批次失败: ${err.message}`);
      }
    }

    findingsByRound.push(topItems);

    // Reflect: LLM assesses information gaps
    session.stage = 'reflecting';
    emit('progress', { stage: 'reflecting', detail: `正在评估第 ${round} 轮信息充分度...`, round });

    try {
      const reflectPrompt = getReflectPrompt(session.topic, subQuestions, findingsByRound, round);
      const reflectResult = await provider.generate(reflectPrompt, { maxTokens: 1024 });
      const reflectText = cleanLLM(reflectResult.text);
      lastReflection = extractJSON(reflectText);
    } catch (err) {
      console.log('  [deep-research] reflect 解析失败:', err.message);
      logError({ source: 'deepResearchPipeline.reflect', message: err.message, sessionId: session.id });
    }

    if (!lastReflection) {
      lastReflection = { overallSufficient: true, gaps: [], summary: '无法评估，结束搜索' };
    }

    emit('reflect', { ...lastReflection, round });
    emit('progress', {
      stage: 'reflecting',
      detail: lastReflection.overallSufficient
        ? `信息充分 — ${lastReflection.summary || '开始综合'}`
        : `发现 ${(lastReflection.gaps || []).length} 个信息缺口`,
      round,
    });

    if (lastReflection.overallSufficient || round >= MAX_ROUNDS) break;

    gapQueries = (lastReflection.gaps || []).map(g => g.nextSearchQuery).filter(Boolean);
    if (gapQueries.length === 0) break;
  }

  // Stage 5: Synthesize — Directly generate report body (no outline step)
  session.stage = 'synthesizing';
  emit('progress', { stage: 'synthesizing', detail: '正在综合所有发现，生成报告正文...' });

  // Build enriched document context for synthesis
  const allAnalyzed = [];
  const seen = new Set();
  for (const round of findingsByRound) {
    for (const item of round) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        allAnalyzed.push(item);
      }
    }
  }
  session.items = allAnalyzed;

  // Generate report body via streaming — skip outline, use deep research body prompt
  session.stage = 'generating';
  let markdown = '';
  let usage = { input: 0, output: 0 };

  try {
    const bodyPrompt = getDeepResearchBodyPrompt(session.topic, subQuestions, allAnalyzed.slice(0, 20), lastReflection);
    for await (const event of provider.generateStream(bodyPrompt, { maxTokens: 8192 })) {
      if (event.chunk) {
        markdown += event.chunk;
        emit('content', { chunk: event.chunk });
      }
      if (event.done) usage = event.usage || usage;
    }
  } catch (err) {
    console.log('  [deep-research] 正文生成失败:', err.message);
    logError({ source: 'deepResearchPipeline.synthesize', message: err.message, sessionId: session.id });
    const fallback = await provider.generate(
      getDeepResearchBodyPrompt(session.topic, subQuestions, allAnalyzed.slice(0, 20), lastReflection),
      { maxTokens: 8192 }
    );
    markdown = cleanLLM(fallback.text);
    usage = fallback.usage;
    emit('content', { chunk: markdown });
  }

  markdown = cleanLLM(markdown);
  session.markdown = markdown;
  session._fromDeepResearch = true;
  session.stage = 'done';

  const reportId = crypto.randomUUID();
  session._reportId = reportId;
  emit('done', { type: 'report', reportId, markdown, usage });

  // Auto-save deep research report to disk
  let savedPath = '';
  try {
    const saved = await saveReportPipeline(sessionId, session.topic, { type: 'deep-research' });
    savedPath = saved.path;
    emit('progress', { stage: 'done', detail: `深度研究报告已保存到 ${savedPath}` });
  } catch (err) {
    console.log('  [deep-research] 自动保存失败:', err.message);
    logError({ source: 'deepResearchPipeline.saveReport', message: err.message, sessionId: session.id });
    emit('progress', { stage: 'done', detail: '深度研究报告生成完成（保存失败，可手动保存）' });
  }
}

// === Deep Research V3 Pipeline ===
// Brainstorm(chat) → Plan(L1→L2→L3, user confirm each level) → Execute(per-leaf mini-reflect) → Synthesize

// Helper: persist intermediate artifact to disk, non-blocking
function persistV3(dataDir, filename, data) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2), 'utf-8');
  } catch (_) {}
}

// Helper: collect all leaf nodes (nodes with no children) from a task tree
function collectLeaves(nodes) {
  const leaves = [];
  function walk(node) {
    if (!node.children || node.children.length === 0) {
      leaves.push(node);
    } else {
      for (const child of node.children) walk(child);
    }
  }
  for (const n of nodes) walk(n);
  return leaves;
}

// Helper: find a node by id in the task tree
function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children && n.children.length > 0) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Brainstorm phase: one turn of the v3 brainstorm dialogue
// Returns { tasks, confirmed, reply }
export async function deepResearchV3BrainstormTurn(sessionId, message, emit) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  session.chatHistory.push({ role: 'user', content: message });

  // Lightweight search (3 results, 5s timeout)
  let searchContext = [];
  try {
    emit('progress', { stage: 'brainstorming', detail: '正在搜索最新信息辅助范围明确...' });
    searchContext = await Promise.race([
      searchWeb(message, 3),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch (_) {}

  const provider = createProvider();
  const prompt = getBrainstormTaskPrompt(
    session.topic,
    session.chatHistory.slice(0, -1),
    session.analysisTasks,
    message,
    searchContext,
  );

  const result = await provider.generate(prompt, { maxTokens: 2048 });
  const text = cleanLLM(result.text);

  let tasks = session.analysisTasks;
  let confirmed = false;
  let reply = '已更新分析任务清单，可继续补充或发送"确认"开始分解。';

  const parsed = extractJSON(text);
  if (parsed) {
    try {
      tasks = parsed.tasks || tasks;
      confirmed = !!parsed.confirmed;
      reply = parsed.reply || reply;
    } catch (_) {}
  }

  session.analysisTasks = tasks;
  session.chatHistory.push({ role: 'assistant', content: reply });

  emit('brainstorm_tasklist', { tasks, confirmed });
  emit('reply', { text: reply });

  // Persist brainstorm state
  const dataDir = path.join(__dirname, '..', '..', 'data', 'deep-research', sessionId);
  persistV3(dataDir, '01-brainstorm.json', {
    chatHistory: session.chatHistory,
    tasks,
    confirmed,
    updatedAt: new Date().toISOString(),
  });

  return { tasks, confirmed, reply };
}

// Plan phase: decompose confirmed tasks into L1→L2→L3 tree
// Emits plan_l1 / plan_l2 / plan_l3 events and waits for confirm via session.confirmMode
export async function deepResearchV3Plan(sessionId, emit) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const provider = createProvider();
  const dataDir = path.join(__dirname, '..', '..', 'data', 'deep-research', sessionId);

  // L1: each confirmed analysis task becomes an L1 node
  const l1Nodes = session.analysisTasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    level: 1,
    parentId: null,
    children: [],
  }));

  session.taskTree = l1Nodes;
  emit('plan_l1', { nodes: l1Nodes });
  emit('progress', { stage: 'plan_l1', detail: `L1 分解完成，共 ${l1Nodes.length} 个顶层任务` });
  persistV3(dataDir, '02-task-tree.json', { taskTree: session.taskTree, level: 1, updatedAt: new Date().toISOString() });

  if (session.confirmMode === 'manual') {
    // Signal frontend to wait for user confirmation
    emit('awaiting_confirm', { level: 1, nodes: l1Nodes });
    return { stage: 'awaiting_l1_confirm' };
  }

  // Auto mode: proceed to L2
  return await deepResearchV3PlanL2(sessionId, emit);
}

// L2 decomposition (called after L1 confirmed)
export async function deepResearchV3PlanL2(sessionId, emit) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const provider = createProvider();
  const dataDir = path.join(__dirname, '..', '..', 'data', 'deep-research', sessionId);

  emit('progress', { stage: 'plan_l2', detail: '正在分解 L2 子任务...' });

  // Decompose each L1 node in parallel
  await Promise.all(session.taskTree.map(async l1 => {
    try {
      const prompt = getTaskDecomposePrompt(l1, 1, null);
      const result = await provider.generate(prompt, { maxTokens: 1024 });
      const text = cleanLLM(result.text);
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const children = JSON.parse(arrMatch[0]);
        l1.children = children.map(c => ({
          ...c,
          level: 2,
          parentId: l1.id,
          children: [],
        }));
      }
    } catch (err) {
      console.log(`  [v3-plan-l2] ${l1.id} 分解失败: ${err.message}`);
      // Fallback: single child same as parent
      l1.children = [{ id: `${l1.id}-1`, title: l1.title, description: l1.description, level: 2, parentId: l1.id, children: [] }];
    }
  }));

  emit('plan_l2', { tree: session.taskTree });
  emit('progress', { stage: 'plan_l2', detail: 'L2 分解完成' });
  persistV3(dataDir, '02-task-tree.json', { taskTree: session.taskTree, level: 2, updatedAt: new Date().toISOString() });

  if (session.confirmMode === 'manual') {
    emit('awaiting_confirm', { level: 2, tree: session.taskTree });
    return { stage: 'awaiting_l2_confirm' };
  }

  return await deepResearchV3PlanL3(sessionId, emit);
}

// L3 decomposition (called after L2 confirmed)
export async function deepResearchV3PlanL3(sessionId, emit) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const provider = createProvider();
  const dataDir = path.join(__dirname, '..', '..', 'data', 'deep-research', sessionId);

  emit('progress', { stage: 'plan_l3', detail: '正在分解 L3 子子任务...' });

  // Collect all L2 nodes
  const l2Nodes = [];
  for (const l1 of session.taskTree) {
    for (const l2 of (l1.children || [])) l2Nodes.push({ l2, l1 });
  }

  await Promise.all(l2Nodes.map(async ({ l2, l1 }) => {
    try {
      const prompt = getTaskDecomposePrompt(l2, 2, l1.description);
      const result = await provider.generate(prompt, { maxTokens: 1024 });
      const text = cleanLLM(result.text);
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const children = JSON.parse(arrMatch[0]);
        l2.children = children.map(c => ({
          ...c,
          level: 3,
          parentId: l2.id,
          children: [],
        }));
      }
    } catch (err) {
      console.log(`  [v3-plan-l3] ${l2.id} 分解失败: ${err.message}`);
      l2.children = [{ id: `${l2.id}-1`, title: l2.title, description: l2.description, level: 3, parentId: l2.id, children: [] }];
    }
  }));

  emit('plan_l3', { tree: session.taskTree });
  emit('progress', { stage: 'plan_l3', detail: 'L3 分解完成，任务树构建完毕' });
  persistV3(dataDir, '02-task-tree.json', { taskTree: session.taskTree, level: 3, updatedAt: new Date().toISOString() });

  if (session.confirmMode === 'manual') {
    emit('awaiting_confirm', { level: 3, tree: session.taskTree });
    return { stage: 'awaiting_l3_confirm' };
  }

  return { stage: 'ready_to_execute' };
}

// Execute phase: depth-first traversal of leaf tasks, each with mini Reflect loop (max 2 rounds)
export async function deepResearchV3Execute(sessionId, emit) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const provider = createProvider();
  const dataDir = path.join(__dirname, '..', '..', 'data', 'deep-research', sessionId);
  const execDir = path.join(dataDir, '03-execute');

  const leaves = collectLeaves(session.taskTree);
  emit('progress', { stage: 'executing', detail: `开始执行 ${leaves.length} 个叶子任务...` });

  // Group leaves by L1 parent for L1 summary
  const l1Groups = {};
  for (const l1 of session.taskTree) {
    l1Groups[l1.id] = { l1, leaves: [] };
  }
  for (const leaf of leaves) {
    // Find L1 ancestor
    const l1Id = leaf.id.split('-')[0];
    if (l1Groups[l1Id]) l1Groups[l1Id].leaves.push(leaf);
    else {
      // Fallback: assign to first L1
      const firstL1 = session.taskTree[0];
      if (firstL1) {
        if (!l1Groups[firstL1.id]) l1Groups[firstL1.id] = { l1: firstL1, leaves: [] };
        l1Groups[firstL1.id].leaves.push(leaf);
      }
    }
  }

  // Execute leaves in order (depth-first = leaves array order)
  for (const leaf of leaves) {
    const nodeDir = path.join(execDir, leaf.id);
    const l1Id = leaf.id.split('-')[0];

    emit('task_start', { nodeId: leaf.id, title: leaf.title, level: leaf.level, path: leaf.id });
    emit('progress', { stage: 'executing', detail: `执行任务 [${leaf.id}] ${leaf.title}` });

    let prevAnalysis = null;
    let finalResult = null;

    for (let round = 1; round <= 2; round++) {
      // Search: 1-2 queries × 5 results
      const queries = round === 1
        ? [leaf.title, `${leaf.title} ${session.topic}`].slice(0, 2)
        : (leaf._gapQueries || []).slice(0, 2);

      let searchResults = [];
      try {
        if (queries.length > 0) {
          searchResults = await searchBatch(queries, 5, sessionId);
        }
      } catch (err) {
        console.log(`  [v3-exec] ${leaf.id} round${round} 搜索失败: ${err.message}`);
      }

      emit('task_search', { nodeId: leaf.id, round, results: searchResults.slice(0, 10) });
      persistV3(nodeDir, `round-${round}-search.json`, { queries, results: searchResults, timestamp: new Date().toISOString() });

      // LLM analysis
      let analysis = '';
      let keyFindings = [];
      let sources = [];

      try {
        const execPrompt = getTaskExecutePrompt(leaf, searchResults, round, prevAnalysis);
        const execResult = await provider.generate(execPrompt, { maxTokens: 2048 });
        const execText = cleanLLM(execResult.text);

        const execParsed = extractJSON(execText);
        if (execParsed) {
          analysis = execParsed.analysis || '';
          keyFindings = execParsed.keyFindings || [];
          sources = execParsed.sources || [];
        } else {
          analysis = execText.slice(0, 800);
        }
      } catch (err) {
        console.log(`  [v3-exec] ${leaf.id} round${round} 分析失败: ${err.message}`);
        analysis = `分析失败: ${err.message}`;
      }

      emit('task_analysis', { nodeId: leaf.id, round, analysis });
      persistV3(nodeDir, `round-${round}-analysis.json`, { analysis, keyFindings, sources, timestamp: new Date().toISOString() });

      // Reflect: assess if sufficient (only if round 1)
      let sufficient = true;
      let gaps = [];

      if (round === 1) {
        try {
          const reflectPrompt = getTaskReflectPrompt(leaf, analysis, keyFindings, sources, round);
          const reflectResult = await provider.generate(reflectPrompt, { maxTokens: 512 });
          const reflectText = cleanLLM(reflectResult.text);
          const reflectParsed = extractJSON(reflectText);
          if (reflectParsed) {
            sufficient = !!reflectParsed.sufficient;
            gaps = reflectParsed.gaps || [];
          }
        } catch (err) {
          console.log(`  [v3-exec] ${leaf.id} reflect 失败: ${err.message}`);
          sufficient = true;
        }

        emit('task_reflect', { nodeId: leaf.id, round, sufficient, gaps });
        persistV3(nodeDir, `round-${round}-reflect.json`, { sufficient, gaps, timestamp: new Date().toISOString() });

        if (sufficient || gaps.length === 0) {
          finalResult = { analysis, keyFindings, sources, rounds: round };
          break;
        }

        // Prepare round 2: use gap queries
        prevAnalysis = analysis;
        // Override queries for round 2 with gap search queries
        const gapQueries = gaps.map(g => g.nextSearchQuery).filter(Boolean);
        if (gapQueries.length > 0) {
          // Patch: store gap queries so round 2 uses them
          leaf._gapQueries = gapQueries;
        } else {
          finalResult = { analysis, keyFindings, sources, rounds: round };
          break;
        }
      } else {
        // Round 2: merge with previous
        finalResult = { analysis, keyFindings, sources, rounds: round };
      }
    }

    if (!finalResult) finalResult = { analysis: '', keyFindings: [], sources: [], rounds: 1 };

    // Store result in session
    session.executeResults[leaf.id] = { ...leaf, ...finalResult };
    persistV3(nodeDir, 'final.json', { ...finalResult, nodeId: leaf.id, title: leaf.title, timestamp: new Date().toISOString() });

    emit('task_done', { nodeId: leaf.id, result: session.executeResults[leaf.id] });
  }

  // L1 summaries
  for (const [l1Id, group] of Object.entries(l1Groups)) {
    if (group.leaves.length === 0) continue;

    const childrenResults = group.leaves.map(leaf => ({
      ...leaf,
      ...(session.executeResults[leaf.id] || {}),
    }));

    let l1Summary = '';
    try {
      const summaryPrompt = getL1SummaryPrompt(group.l1, childrenResults);
      const summaryResult = await provider.generate(summaryPrompt, { maxTokens: 1024 });
      l1Summary = cleanLLM(summaryResult.text);
    } catch (err) {
      console.log(`  [v3-exec] L1 ${l1Id} 小结失败: ${err.message}`);
      l1Summary = `${group.l1.title} 研究完成，共 ${group.leaves.length} 个子任务。`;
    }

    session.l1Summaries[l1Id] = l1Summary;
    persistV3(execDir, `l1-summary-${l1Id}.json`, { nodeId: l1Id, summary: l1Summary, timestamp: new Date().toISOString() });
    emit('l1_summary', { nodeId: l1Id, summary: l1Summary });
  }

  emit('progress', { stage: 'executing', detail: '所有任务执行完毕，开始综合报告...' });
}

// Synthesize phase: generate structured report from task tree + execution results
export async function deepResearchV3Synthesize(sessionId, emit) {
  const session = getSession(sessionId);
  if (!session) throw new Error('会话不存在');

  const provider = createProvider();
  const dataDir = path.join(__dirname, '..', '..', 'data', 'deep-research', sessionId);

  session.stage = 'synthesizing';
  emit('progress', { stage: 'synthesizing', detail: '正在按任务树层级生成结构化报告...' });

  const reportPrompt = getStructuredReportPrompt(
    session.topic,
    session.domain || 'software-engineering',
    session.taskTree,
    session.executeResults,
    session.l1Summaries,
  );

  persistV3(dataDir, '04-synthesize-prompt.json', { prompt: reportPrompt.slice(0, 2000), timestamp: new Date().toISOString() });

  let markdown = '';
  let usage = { input: 0, output: 0 };

  try {
    for await (const event of provider.generateStream(reportPrompt, { maxTokens: 8192 })) {
      if (event.chunk) {
        markdown += event.chunk;
        emit('content', { chunk: event.chunk });
      }
      if (event.done) usage = event.usage || usage;
    }
  } catch (err) {
    console.log('  [v3-synthesize] 流式生成失败，fallback:', err.message);
    const fallback = await provider.generate(reportPrompt, { maxTokens: 8192 });
    markdown = cleanLLM(fallback.text);
    usage = fallback.usage;
    emit('content', { chunk: markdown });
  }

  markdown = cleanLLM(markdown);
  session.markdown = markdown;
  session._fromDeepResearch = true;
  session.stage = 'done';

  persistV3(dataDir, '05-report.md', markdown);

  const reportId = crypto.randomUUID();
  session._reportId = reportId;
  emit('done', { type: 'report', reportId, markdown, usage });

  // Auto-save
  try {
    const saved = await saveReportPipeline(sessionId, session.topic, { type: 'deep-research-v3' });
    emit('progress', { stage: 'done', detail: `深度研究 v3 报告已保存到 ${saved.path}` });
  } catch (err) {
    console.log('  [v3-synthesize] 自动保存失败:', err.message);
    emit('progress', { stage: 'done', detail: '报告生成完成（保存失败，可手动保存）' });
  }
}
