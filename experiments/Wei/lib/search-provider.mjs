// Web search abstraction — multiple backends via plain fetch(), no extra npm deps.
// Configure via env: SEARCH_PROVIDER=tavily|bing|duckduckgo, TAVILY_API_KEY=...

import https from 'https';
import { logSearch } from './logger.mjs';

const TAVILY_BASE = 'https://api.tavily.com/search';
const DDG_BASE = 'https://html.duckduckgo.com/html/';
const BING_HOST = 'cn.bing.com';

function getConfig() {
  return {
    provider: process.env.SEARCH_PROVIDER || 'tavily',
    tavilyKey: process.env.TAVILY_API_KEY || '',
  };
}

// Tavily Search API — purpose-built for AI agent research
async function searchTavily(query, maxResults = 5) {
  const { tavilyKey } = getConfig();
  if (!tavilyKey) throw new Error('缺少 TAVILY_API_KEY 环境变量');

  const resp = await fetch(TAVILY_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query,
      max_results: maxResults,
      search_depth: 'advanced',
      include_answer: false,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Tavily API ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  return (data.results || []).slice(0, maxResults).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: (r.content || '').slice(0, 500),
    source: 'Web Search',
    publishedAt: r.published_date || new Date().toISOString(),
    points: null,
    comments: null,
  }));
}

// DuckDuckGo HTML search — free, no API key (may be blocked in some regions)
async function searchDuckDuckGo(query, maxResults = 5) {
  const params = new URLSearchParams({ q: query });
  const resp = await fetch(DDG_BASE + '?' + params.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeepDiveBot/0.1)' },
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) throw new Error(`DuckDuckGo ${resp.status}`);

  const html = await resp.text();
  const results = [];

  const blockRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while (match = blockRe.exec(html)) {
    const url = match[1].replace(/&amp;/g, '&');
    const title = match[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const snippet = match[3].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
    if (title && url.startsWith('http')) {
      results.push({
        title,
        url,
        snippet: snippet.slice(0, 500),
        source: 'Web Search',
        publishedAt: new Date().toISOString(),
        points: null,
        comments: null,
      });
    }
  }

  return results.slice(0, maxResults);
}

// Custom agent — no keepAlive to avoid stale connection ECONNRESET
const bingAgent = new https.Agent({ keepAlive: false, timeout: 10000 });

// HTTPS fetch helper — uses http/1.1 ALPN (avoids HTTP/2 RESET on some CN hosts)
function fetchHttps(url, timeout = 10000, retries = 1) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = https.get(url, {
        agent: bingAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Connection': 'close',
        },
        timeout,
        ALPNProtocols: ['http/1.1'],
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          fetchHttps(res.headers.location, timeout).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ text: () => data }));
      });
      req.on('error', (err) => {
        if (n < retries && err.message?.includes('ECONNRESET')) {
          // Stale connection or transient reset — retry with new agent
          setTimeout(() => attempt(n + 1), 200 * (n + 1));
        } else {
          reject(err);
        }
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    };
    attempt(0);
  });
}

// Parse Bing HTML into result items
function parseBingResults(html) {
  const results = [];
  const algoRe = /<li class="b_algo"[\s\S]*?<div class="b_caption"/gi;
  let blockMatch;
  while ((blockMatch = algoRe.exec(html)) !== null) {
    const block = blockMatch[0];
    const linkMatch = block.match(/<a\s+target="_blank"[^>]*href="(https?:\/\/[^\"]*)"[^>]*h="ID=SERP[^\"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const url = linkMatch[1].replace(/&amp;/g, '&');
    if (url.includes('bing.com') || url.includes('microsoft.com/bing')) continue;
    const title = linkMatch[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (!title) continue;

    const afterLink = html.slice(algoRe.lastIndex);
    const snippetMatch = afterLink.match(/<p class="b_lineclamp2"[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]*>/g, '').replace(/&ensp;/g, ' ').replace(/&#0?183;/g, '·').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      : '';

    results.push({
      title,
      url,
      snippet: snippet.slice(0, 500),
      source: 'Web Search',
      publishedAt: new Date().toISOString(),
      points: null,
      comments: null,
    });
  }
  return results;
}

// Bing HTML search — three parallel queries for maximum coverage:
// 1. cn.bing.com (no setmkt): best for Chinese queries
// 2. cn.bing.com (setmkt=en-US): helps some English queries
// 3. www.bing.com (setmkt=zh-CN): international index with Chinese market preference — often
//    returns different/better results than cn.bing.com for specific content (e.g. RSAC finalists)
// All three parsed with the same b_algo parser, merged and deduplicated by URL.
async function searchBing(query, maxResults = 5) {
  const cnBase = `https://${BING_HOST}/search?q=${encodeURIComponent(query)}`;
  const intlUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setmkt=zh-CN`;

  const [htmlA, htmlB, htmlC] = await Promise.allSettled([
    fetchHttps(cnBase).then(r => r.text()),
    fetchHttps(cnBase + '&setmkt=en-US').then(r => r.text()),
    fetch(intlUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(10000),
    }).then(r => r.text()),
  ]);

  const resultsA = htmlA.status === 'fulfilled' ? parseBingResults(htmlA.value) : [];
  const resultsB = htmlB.status === 'fulfilled' ? parseBingResults(htmlB.value) : [];
  const resultsC = htmlC.status === 'fulfilled' ? parseBingResults(htmlC.value) : [];

  // Merge and deduplicate by URL, interleave for diversity
  const seen = new Set();
  const merged = [];
  const maxLen = Math.max(resultsA.length, resultsB.length, resultsC.length);
  for (let i = 0; i < maxLen; i++) {
    for (const r of [resultsA[i], resultsB[i], resultsC[i]]) {
      if (!r) continue;
      const key = r.url;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
  }

  return merged.slice(0, maxResults);
}

// Main entry: search a single query, returns standardized items
export async function searchWeb(query, maxResults = 5) {
  const { provider } = getConfig();
  const start = Date.now();
  let result = [];
  let error = null;
  let usedProvider = provider;

  try {
    if (provider === 'duckduckgo') { result = await searchDuckDuckGo(query, maxResults); return result; }
    if (provider === 'bing') { result = await searchBing(query, maxResults); return result; }
    result = await searchTavily(query, maxResults);
    return result;
  } catch (err) {
    console.log(`  [search] ${provider} 失败: ${err.message}`);
    error = err.message;
    // Smart fallback chain
    if (provider === 'tavily') {
      console.log(`  [search] 尝试 Bing fallback...`);
      try { usedProvider = 'bing'; result = await searchBing(query, maxResults); error = null; } catch (_) {}
    }
    if (provider === 'duckduckgo') {
      console.log(`  [search] 尝试 Bing fallback...`);
      try { usedProvider = 'bing'; result = await searchBing(query, maxResults); error = null; } catch (_) {}
    }
    if (provider === 'bing') {
      console.log(`  [search] 尝试 DuckDuckGo fallback...`);
      try { usedProvider = 'duckduckgo'; result = await searchDuckDuckGo(query, maxResults); error = null; } catch (_) {}
    }
  } finally {
    logSearch({
      provider: usedProvider,
      queries: [query],
      resultCount: result.length,
      durationMs: Date.now() - start,
      error,
    });
  }
  return result;
}

// Batch search: parallel search for multiple queries
export async function searchBatch(queries, maxResultsPerQuery = 5, sessionId = '') {
  const { provider } = getConfig();
  const start = Date.now();
  const results = await Promise.allSettled(
    queries.map(q => searchWeb(q, maxResultsPerQuery))
  );
  const items = [];
  const errors = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      items.push(...r.value);
    } else {
      errors.push({ query: queries[i], error: r.reason?.message || String(r.reason) });
    }
  }
  logSearch({
    provider,
    queries,
    resultCount: items.length,
    durationMs: Date.now() - start,
    sessionId,
    error: errors.length > 0 ? errors.map(e => `${e.query}: ${e.error}`).join('; ') : null,
  });
  return items;
}
