import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const BRIEFS_DIR = path.join(__dirname, '..', 'briefs');
const INDEX_PATH = path.join(REPORTS_DIR, 'index.json');

// 简单 promise-chain 锁，序列化 index.json 写操作，避免竞态
let _indexLock = Promise.resolve();
function withIndexLock(fn) {
  const p = _indexLock.then(() => fn());
  _indexLock = p.catch(() => {});
  return p;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function saveReport(report) {
  const d = new Date(report.createdAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const slug = slugify(report.title);

  const dir = path.join(REPORTS_DIR, String(yyyy), mm, dd);
  ensureDir(dir);

  fs.writeFileSync(path.join(dir, `${slug}.md`), report.markdown, 'utf-8');
  fs.writeFileSync(path.join(dir, `${slug}.html`), report.html, 'utf-8');
  if (report.marpMarkdown) {
    fs.writeFileSync(path.join(dir, `${slug}.marp.md`), report.marpMarkdown, 'utf-8');
  }

  const meta = {
    id: report.id,
    title: report.title,
    createdAt: report.createdAt,
    type: report.type,
    domain: report.domain || null,
    parentReportId: report.parentReportId || null,
    tags: report.tags,
    metadata: report.metadata,
    conversationHistory: report.conversationHistory || [],
  };
  fs.writeFileSync(path.join(dir, `${slug}.meta.json`), JSON.stringify(meta, null, 2), 'utf-8');

  const relPath = `${yyyy}/${mm}/${dd}/${slug}`;
  updateIndex(report, relPath);

  return { dir, slug, relPath };
}

function updateIndex(report, relPath) {
  return withIndexLock(() => {
    ensureDir(REPORTS_DIR);
    let index = [];
    if (fs.existsSync(INDEX_PATH)) {
      try { index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')); } catch (_) {}
    }

    index = index.filter(e => e.id !== report.id);
    index.push({
      id: report.id,
      title: report.title,
      createdAt: report.createdAt,
      type: report.type,
      domain: report.domain || null,
      tags: report.tags,
      path: relPath,
    });

    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
  });
}

export function saveBrief(brief) {
  const d = new Date(brief.generatedAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  const dir = path.join(BRIEFS_DIR, String(yyyy), mm, dd);
  ensureDir(dir);

  const suffix = brief.domain ? `-${brief.domain}` : '';
  fs.writeFileSync(path.join(dir, `brief${suffix}.md`), brief.markdown, 'utf-8');
  fs.writeFileSync(path.join(dir, `brief${suffix}.html`), brief.html, 'utf-8');
  fs.writeFileSync(path.join(dir, `brief${suffix}.meta.json`), JSON.stringify({
    date: brief.date,
    domain: brief.domain,
    generatedAt: brief.generatedAt,
    llmProvider: brief.llmProvider,
    noNews: brief.noNews,
  }, null, 2), 'utf-8');

  const domainLabel = brief.domain === 'cybersecurity' ? '网络安全' : '软件工程';
  const reportDir = path.join(REPORTS_DIR, String(yyyy), mm, dd);
  ensureDir(reportDir);
  const slug = `brief${suffix}`;
  fs.writeFileSync(path.join(reportDir, `${slug}.md`), brief.markdown, 'utf-8');
  fs.writeFileSync(path.join(reportDir, `${slug}.html`), brief.html, 'utf-8');
  fs.writeFileSync(path.join(reportDir, `${slug}.meta.json`), JSON.stringify({
    date: brief.date,
    domain: brief.domain,
    generatedAt: brief.generatedAt,
    llmProvider: brief.llmProvider,
    noNews: brief.noNews,
  }, null, 2), 'utf-8');
  const relPath = `${yyyy}/${mm}/${dd}/${slug}`;
  const id = `brief-${brief.date}${suffix}`;
  updateIndex({
    id,
    title: `${domainLabel}每日 Brief — ${brief.date}`,
    createdAt: brief.generatedAt,
    type: 'daily-brief',
    domain: brief.domain || null,
    tags: { user: [], auto: [] },
  }, relPath);

  return { dir };
}

export function loadReportMeta(reportId) {
  if (!fs.existsSync(INDEX_PATH)) return null;
  let index = [];
  try { index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')); } catch (_) { return null; }

  const entry = index.find(e => e.id === reportId);
  if (!entry) return null;

  const metaPath = path.join(REPORTS_DIR, entry.path + '.meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try { return JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (_) { return null; }
}

export function loadReportMarkdown(reportId) {
  if (!fs.existsSync(INDEX_PATH)) return null;
  let index = [];
  try { index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')); } catch (_) { return null; }

  const entry = index.find(e => e.id === reportId);
  if (!entry) return null;

  const mdPath = path.join(REPORTS_DIR, entry.path + '.md');
  if (!fs.existsSync(mdPath)) return null;
  try { return fs.readFileSync(mdPath, 'utf-8'); } catch (_) { return null; }
}

export function updateReportMeta(reportId, updates) {
  if (!fs.existsSync(INDEX_PATH)) return;
  let index = [];
  try { index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')); } catch (_) { return; }

  const entry = index.find(e => e.id === reportId);
  if (!entry) return;

  const metaPath = path.join(REPORTS_DIR, entry.path + '.meta.json');
  if (!fs.existsSync(metaPath)) return;

  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (_) { return; }
  Object.assign(meta, updates);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}
