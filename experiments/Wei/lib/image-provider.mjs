import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProvider } from './llm-provider.mjs';
import { getImageKeywordsPrompt } from './prompts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '.image-cache');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getUnsplashKey() {
  return process.env.UNSPLASH_ACCESS_KEY || '';
}

export async function searchUnsplash(keyword) {
  const key = getUnsplashKey();
  if (!key) return null;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      if (res.status === 403) console.log('  Unsplash API 限流，跳过配图');
      return null;
    }
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].urls.regular;
    }
  } catch (err) {
    console.log(`  Unsplash 搜索失败 [${keyword}]: ${err.message}`);
  }
  return null;
}

export async function downloadImage(imageUrl, filename) {
  ensureDir(CACHE_DIR);
  const dest = path.join(CACHE_DIR, filename);
  if (fs.existsSync(dest)) return dest;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    return dest;
  } catch (err) {
    console.log(`  图片下载失败: ${err.message}`);
    return null;
  }
}

export async function generateImageKeywords(sections, provider = 'claude') {
  const titles = sections.map(s => s.heading).filter(Boolean);
  if (titles.length === 0) return [];
  try {
    const llm = createProvider(provider);
    const prompt = getImageKeywordsPrompt(titles);
    const res = await llm.generate(prompt, { maxTokens: 256 });
    const match = res.text.match(/\[[\s\S]*?\]/);
    if (match) return JSON.parse(match[0]);
  } catch (err) {
    console.log(`  关键词生成失败: ${err.message}`);
  }
  return titles.map(t => t.replace(/[^\w\s]/g, '').slice(0, 30));
}

export async function getImagesForSections(sections, provider = 'claude') {
  const key = getUnsplashKey();
  if (!key) {
    console.log('  未配置 UNSPLASH_ACCESS_KEY，跳过配图');
    return sections.map(() => null);
  }

  console.log('  生成配图关键词 ...');
  const keywords = await generateImageKeywords(sections, provider);

  console.log(`  搜索 ${keywords.length} 张配图 ...`);
  const images = [];
  for (let i = 0; i < sections.length; i++) {
    const kw = keywords[i] || null;
    if (!kw) { images.push(null); continue; }
    const url = await searchUnsplash(kw);
    if (!url) { images.push(null); continue; }
    const filename = `img-${Date.now()}-${i}.jpg`;
    const localPath = await downloadImage(url, filename);
    images.push(localPath);
  }

  const found = images.filter(Boolean).length;
  console.log(`  配图完成: ${found}/${sections.length} 张`);
  return images;
}
