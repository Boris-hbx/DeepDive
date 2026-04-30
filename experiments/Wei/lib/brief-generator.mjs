import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPipeline } from './pipeline/runner.mjs';
import { fetchStage, dedupStage, rankStage, briefSummarizeStage } from './pipeline/stages.mjs';
import { createLLMScoreStage } from './llm-scorer.mjs';
import { briefToHTML } from './markdown-to-html.mjs';
import { saveBrief } from './storage.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSources() {
  const p = path.join(__dirname, '..', 'sources.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadAppConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch (_) { return {}; }
}

function dateDir() {
  return new Date().toISOString().slice(0, 10);
}

function saveArtifact(stage, domainKey, data) {
  const dir = path.join(DATA_DIR, dateDir());
  ensureDir(dir);
  const file = path.join(dir, `${domainKey}_${stage}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  [落盘] ${file} (${Array.isArray(data) ? data.length + ' 条' : 'ok'})`);
}

async function generateDomainBrief(domainKey, domainConfig, provider) {
  const label = domainConfig.label;
  console.log(`\n[${label}] Pipeline 开始`);

  // Merge ranking config from sources.json into domainConfig
  const sourcesConfig = loadSources();
  const mergedConfig = {
    ...domainConfig,
    ranking: sourcesConfig.ranking || {},
  };

  // Build stages list
  const stages = [
    fetchStage(mergedConfig.sources),
    { name: 'persist-fetched', run: async (state) => {
      saveArtifact('fetched', domainKey, state.items);
      return state;
    }},
    dedupStage,
    { name: 'persist-deduped', run: async (state) => {
      saveArtifact('deduped', domainKey, state.items);
      return state;
    }},
    rankStage(mergedConfig),
    { name: 'persist-ranked', run: async (state) => {
      saveArtifact('ranked', domainKey, state.items);
      return state;
    }},
  ];

  // Conditionally inject LLM scoring stage
  const appConfig = loadAppConfig();
  if (appConfig.llmScoring?.enabled) {
    stages.push(createLLMScoreStage(appConfig.llmScoring));
    stages.push({ name: 'persist-llm-scored', run: async (state) => {
      saveArtifact('llm-scored', domainKey, state.items);
      return state;
    }});
  }

  stages.push(briefSummarizeStage(domainKey, label));

  const run = createPipeline(stages, { provider, domain: domainKey });

  const result = await run({ items: [], domain: domainKey });
  return result;
}

export async function generateBrief({ domain, provider = '' }) {
  const config = loadSources();
  const domains = config.domains;

  if (domain) {
    if (!domains[domain]) throw new Error(`未知领域: ${domain}`);
    await generateDomainBrief(domain, domains[domain], provider);
  } else {
    for (const [key, cfg] of Object.entries(domains)) {
      try {
        await generateDomainBrief(key, cfg, provider);
      } catch (err) {
        console.error(`  [${cfg.label}] Brief 生成失败: ${err.message}`);
      }
    }
  }

  console.log('\n所有 Brief 生成完成');
}
