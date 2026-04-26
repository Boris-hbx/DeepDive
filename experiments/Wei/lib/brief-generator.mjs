import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProvider } from './llm-provider.mjs';
import { fetchAllSources } from './fetcher.mjs';
import { dedup } from './dedup.mjs';
import { getBriefPrompt } from './prompts.mjs';
import { briefToHTML } from './markdown-to-html.mjs';
import { saveBrief } from './storage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSources() {
  const p = path.join(__dirname, '..', 'sources.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function generateDomainBrief(domainKey, domainConfig, provider) {
  const label = domainConfig.label;
  console.log(`\n[${label}] 抓取信息源 ...`);

  const items = await fetchAllSources(domainConfig.sources);
  console.log(`  抓取到 ${items.length} 条`);

  if (items.length === 0) {
    console.log(`  无内容，生成空 brief`);
    const date = new Date().toISOString().slice(0, 10);
    const markdown = `# ${label}每日 Brief — ${date}\n\n今日${label}领域无重要事件。`;
    const html = briefToHTML(markdown, domainKey, date);
    saveBrief({ date, domain: domainKey, generatedAt: new Date().toISOString(), llmProvider: provider, markdown, html, noNews: true });
    return;
  }

  const unique = dedup(items);
  console.log(`  去重后 ${unique.length} 条`);

  const llm = createProvider(provider);
  console.log(`  LLM 生成 brief ...`);

  const prompt = getBriefPrompt(domainKey, unique.slice(0, 30));
  const result = await llm.generate(prompt);
  let markdown = result.text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .trim();

  const date = new Date().toISOString().slice(0, 10);
  const noNews = markdown.includes('无重要事件');
  const html = briefToHTML(markdown, domainKey, date);

  saveBrief({ date, domain: domainKey, generatedAt: new Date().toISOString(), llmProvider: provider, markdown, html, noNews });

  console.log(`  Brief 生成完成 (token: ${result.usage.input} in / ${result.usage.output} out)`);
}

export async function generateBrief({ domain, provider = 'claude' }) {
  const config = loadSources();
  const domains = config.domains;

  if (domain) {
    if (!domains[domain]) throw new Error(`未知领域: ${domain}`);
    await generateDomainBrief(domain, domains[domain], provider);
  } else {
    for (const [key, cfg] of Object.entries(domains)) {
      await generateDomainBrief(key, cfg, provider);
    }
  }

  console.log('\n所有 Brief 生成完成');
}
