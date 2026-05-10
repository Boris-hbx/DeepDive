import RssParser from 'rss-parser';

const parser = new RssParser({ timeout: 15000 });

export async function fetchSource(source) {
  try {
    if (source.type === 'hn') return await fetchHN(source);
    if (source.type === 'rss') return await fetchRSS(source);
    if (source.type === 'x') return await fetchX(source);
    if (source.type === 'wechat') return await fetchWechat(source);
    console.log(`  未知源类型: ${source.type}，跳过`);
    return [];
  } catch (err) {
    console.log(`  抓取失败 [${source.name}]: ${err.message}`);
    return [];
  }
}

async function fetchRSS(source) {
  const feed = await parser.parseURL(source.url);
  return (feed.items || []).slice(0, 20).map(item => ({
    title: item.title || '',
    url: item.link || '',
    source: source.name,
    publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    snippet: stripHTML(item.contentSnippet || item.content || '').slice(0, 500),
    points: null,
    comments: null,
  }));
}

// Parse "Points: N / Comments: M" from hnrss.org content text
function parseHNPointsAndComments(text) {
  if (!text) return { points: null, comments: null };
  let points = null;
  let comments = null;
  const pMatch = text.match(/Points:?\s*(\d+)/i);
  if (pMatch) points = parseInt(pMatch[1], 10);
  const cMatch = text.match(/Comments:?\s*(\d+)/i);
  if (cMatch) comments = parseInt(cMatch[1], 10);
  return { points, comments };
}

// Extract HN item ID from URL like https://news.ycombinator.com/item?id=NNNNNN
function extractHNId(url) {
  if (!url) return null;
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

// Fallback: fetch single HN item from Firebase API
async function fetchHNItemById(id) {
  try {
    const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { score: data.score ?? null, descendants: data.descendants ?? null };
  } catch (_) {
    return null;
  }
}

async function fetchHN(source) {
  const keywords = (source.keywords || []).join('+OR+');
  const url = `https://hnrss.org/newest?q=${encodeURIComponent(keywords)}&count=20`;
  const feed = await parser.parseURL(url);
  const contentTexts = (feed.items || []).map(item => {
    const raw = item.contentSnippet || item.content || '';
    const { points, comments } = parseHNPointsAndComments(raw);
    const id = extractHNId(item.link || '');
    return { item, points, comments, id };
  });

  // For items without points, try Firebase API in parallel
  const missingIds = contentTexts.filter(c => c.points == null && c.id).map(c => c.id);
  const firebaseResults = new Map();
  if (missingIds.length > 0) {
    const fbCalls = await Promise.allSettled(missingIds.map(id => fetchHNItemById(id)));
    fbCalls.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) firebaseResults.set(missingIds[i], r.value);
    });
  }

  return contentTexts.map(({ item, points, comments, id }) => {
    let finalPoints = points;
    let finalComments = comments;
    if (finalPoints == null && id && firebaseResults.has(id)) {
      const fb = firebaseResults.get(id);
      finalPoints = fb.score;
      finalComments = fb.descendants;
    }
    return {
      title: item.title || '',
      url: item.link || '',
      source: 'Hacker News',
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      snippet: stripHTML(item.contentSnippet || item.content || '').slice(0, 500),
      points: finalPoints,
      comments: finalComments,
    };
  });
}

export async function fetchAllSources(sources) {
  const results = await Promise.allSettled(sources.map(s => fetchSource(s)));
  const items = [];
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

// X (Twitter) via Nitter RSS bridge — public, no API key required
// source.url should be like: https://nitter.net/{username}/rss
async function fetchX(source) {
  if (!source.url) {
    console.log(`  X 源缺少 url，跳过 [${source.name}]`);
    return [];
  }
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, 15).map(item => ({
      title: item.title || '',
      url: item.link || '',
      source: source.name,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      snippet: stripHTML(item.contentSnippet || item.content || '').slice(0, 500),
      points: null,
      comments: null,
    }));
  } catch (err) {
    console.log(`  X 源抓取失败 [${source.name}]: ${err.message}`);
    return [];
  }
}

// 微信公众号 via RSSHub or similar RSS bridge
// source.url should be like: https://rsshub.example.com/wechat/mp/xxx
async function fetchWechat(source) {
  if (!source.url) {
    console.log(`  微信公众号源缺少 url，跳过 [${source.name}]`);
    return [];
  }
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, 15).map(item => ({
      title: item.title || '',
      url: item.link || '',
      source: source.name,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
      snippet: stripHTML(item.contentSnippet || item.content || '').slice(0, 500),
      points: null,
      comments: null,
    }));
  } catch (err) {
    console.log(`  微信公众号源抓取失败 [${source.name}]: ${err.message}`);
    return [];
  }
}

function stripHTML(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
