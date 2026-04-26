import RssParser from 'rss-parser';

const parser = new RssParser({ timeout: 15000 });

export async function fetchSource(source) {
  try {
    if (source.type === 'hn') return await fetchHN(source);
    if (source.type === 'rss') return await fetchRSS(source);
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
  }));
}

async function fetchHN(source) {
  const keywords = (source.keywords || []).join('+OR+');
  const url = `https://hnrss.org/newest?q=${encodeURIComponent(keywords)}&count=20`;
  const feed = await parser.parseURL(url);
  return (feed.items || []).map(item => ({
    title: item.title || '',
    url: item.link || '',
    source: 'Hacker News',
    publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    snippet: stripHTML(item.contentSnippet || item.content || '').slice(0, 500),
  }));
}

export async function fetchAllSources(sources) {
  const results = await Promise.allSettled(sources.map(s => fetchSource(s)));
  const items = [];
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value);
  }
  return items;
}

function stripHTML(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
