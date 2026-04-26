import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import { generateSurvey, generateFollowUp } from './lib/report-generator.mjs';
import { loadFeedback, saveFeedback, saveSkill, loadSkills } from './lib/feedback.mjs';
import { generateBrief } from './lib/brief-generator.mjs';
import { fetchSource } from './lib/fetcher.mjs';
import { generatePptx } from './lib/pptx-generator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.join(__dirname, 'sources.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { schedule: { enabled: true, hour: 8, domains: ['software-engineering', 'cybersecurity'] }, history: [] };
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch (_) { return { schedule: {}, history: [] }; }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function addHistory(status, domains) {
  const cfg = loadConfig();
  cfg.history = cfg.history || [];
  cfg.history.push({ time: new Date().toISOString().replace('T', ' ').slice(0, 19), status, domains });
  if (cfg.history.length > 50) cfg.history = cfg.history.slice(-50);
  saveConfig(cfg);
}
const PORT = process.env.PORT || 3457;

// === 任务队列（内存） ===
const tasks = [];
let taskSeq = 0;
function createTask(type, title) {
  const t = { id: ++taskSeq, type, title, status: 'running', createdAt: new Date().toISOString(), finishedAt: null, error: null };
  tasks.push(t);
  if (tasks.length > 50) tasks.shift();
  return t;
}
function finishTask(t, err) {
  t.status = err ? 'failed' : 'success';
  t.finishedAt = new Date().toISOString();
  if (err) t.error = typeof err === 'string' ? err : err.message || String(err);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  let filePath = path.join(__dirname, decodeURIComponent(req.url === '/' ? '/index.html' : req.url));
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }
  if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

function jsonRes(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const p = parsedUrl.pathname;

  try {
    if (req.method === 'POST' && p === '/api/generate') {
      const { topic, userTags, timeRange, domain } = JSON.parse(await readBody(req));
      if (!topic) return jsonRes(res, 400, { error: '缺少 topic' });
      const task = createTask('generate', topic);
      try {
        const report = await generateSurvey({ topic, timeRange, userTags: userTags || [], domain });
        finishTask(task);
        return jsonRes(res, 200, { ok: true, title: report.title, tags: report.tags, path: report.path, url: `/reports/${report.path}.html` });
      } catch (err) { finishTask(task, err); throw err; }
    }

    if (req.method === 'POST' && p === '/api/follow-up') {
      const { parentReportId, question } = JSON.parse(await readBody(req));
      if (!parentReportId || !question) return jsonRes(res, 400, { error: '缺少 parentReportId 或 question' });
      const task = createTask('follow-up', question.slice(0, 60));
      try {
        const report = await generateFollowUp({ parentReportId, question });
        finishTask(task);
        return jsonRes(res, 200, { ok: true, title: report.title, path: report.path, url: `/reports/${report.path}.html` });
      } catch (err) { finishTask(task, err); throw err; }
    }

    if (req.method === 'POST' && p === '/api/brief') {
      const { domain } = JSON.parse(await readBody(req) || '{}');
      const task = createTask('brief', domain ? (domain === 'cybersecurity' ? '网络安全' : '软件工程') : '全部领域');
      try {
        await generateBrief({ domain });
        finishTask(task);
        return jsonRes(res, 200, { ok: true });
      } catch (err) { finishTask(task, err); throw err; }
    }

    if (req.method === 'GET' && p === '/api/feedback') {
      const reportId = parsedUrl.searchParams.get('reportId') || '';
      const all = loadFeedback();
      const filtered = reportId ? all.filter(f => f.reportId === reportId) : all;
      return jsonRes(res, 200, { feedback: filtered });
    }

    if (req.method === 'POST' && p === '/api/feedback') {
      const data = JSON.parse(await readBody(req));
      saveFeedback(data);
      if (data.saveAsSkill && data.content) {
        const typeLabel = { insight: '洞察思路', method: '分析方法', missing: '补充内容', error: '纠正' };
        saveSkill({
          name: `${typeLabel[data.type] || data.type}：${data.content.slice(0, 30)}`,
          type: data.type, content: data.content,
          keywords: data.keywords || [], sourceReport: data.reportTitle || '',
        });
      }
      return jsonRes(res, 200, { ok: true });
    }

    if (req.method === 'GET' && p === '/api/skills') {
      return jsonRes(res, 200, { skills: loadSkills() });
    }

    if (req.method === 'POST' && p === '/api/regenerate') {
      const { topic, feedback, domain } = JSON.parse(await readBody(req));
      if (!topic) return jsonRes(res, 400, { error: '缺少 topic' });
      const task = createTask('regenerate', topic);
      try {
        const report = await generateSurvey({ topic, userTags: [], timeRange: '', domain, feedbackHint: feedback });
        finishTask(task);
        return jsonRes(res, 200, { ok: true, url: `/reports/${report.path}.html`, path: report.path });
      } catch (err) { finishTask(task, err); throw err; }
    }

    // === PPTX API ===
    if (req.method === 'POST' && p === '/api/pptx') {
      const { reportId, template } = JSON.parse(await readBody(req));
      if (!reportId) return jsonRes(res, 400, { error: '缺少 reportId' });
      const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, 'reports', 'index.json'), 'utf-8'));
      const entry = indexData.find(e => e.id === reportId);
      if (!entry) return jsonRes(res, 404, { error: '报告不存在' });
      const mdPath = path.join(__dirname, 'reports', entry.path + '.md');
      const metaPath = path.join(__dirname, 'reports', entry.path + '.meta.json');
      const md = fs.readFileSync(mdPath, 'utf-8');
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const pptxPath = path.join(__dirname, 'reports', entry.path + '-' + (template || 'tech-blue') + '.pptx');
      await generatePptx({
        markdown: md, title: entry.title, template: template || 'tech-blue',
        meta: { domain: meta.domain, tags: meta.tags, date: meta.createdAt?.slice(0, 10), llmProvider: meta.metadata?.llmProvider, cost: meta.metadata?.cost },
        outputPath: pptxPath,
      });
      return jsonRes(res, 200, { ok: true, url: `/reports/${entry.path}-${template || 'tech-blue'}.pptx` });
    }

    if (req.method === 'GET' && p === '/api/tasks') {
      const typeFilter = parsedUrl.searchParams.get('type') || '';
      const filtered = typeFilter ? tasks.filter(t => t.type === typeFilter) : tasks;
      return jsonRes(res, 200, { tasks: filtered.slice().reverse() });
    }

    // === 管理台 API ===
    if (req.method === 'GET' && p === '/api/sources') {
      const data = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8'));
      return jsonRes(res, 200, data);
    }

    if (req.method === 'PUT' && p === '/api/sources') {
      const data = JSON.parse(await readBody(req));
      fs.writeFileSync(SOURCES_PATH, JSON.stringify(data, null, 2), 'utf-8');
      return jsonRes(res, 200, { ok: true });
    }

    if (req.method === 'POST' && p === '/api/sources/test') {
      const source = JSON.parse(await readBody(req));
      const items = await fetchSource(source);
      return jsonRes(res, 200, { ok: true, count: items.length, sample: items.slice(0, 3).map(i => i.title) });
    }

    if (req.method === 'GET' && p === '/api/schedule') {
      const cfg = loadConfig();
      return jsonRes(res, 200, { schedule: cfg.schedule, history: cfg.history || [], defaultTemplate: cfg.defaultTemplate || 'tech-blue' });
    }

    if (req.method === 'PUT' && p === '/api/schedule') {
      const body = JSON.parse(await readBody(req));
      const cfg = loadConfig();
      if (body.schedule) cfg.schedule = body.schedule;
      if (body.defaultTemplate) cfg.defaultTemplate = body.defaultTemplate;
      saveConfig(cfg);
      return jsonRes(res, 200, { ok: true });
    }

    serveStatic(req, res);
  } catch (err) {
    console.error(err);
    jsonRes(res, 500, { error: err.message });
  }
});

// 定时 brief（读取 config.json 配置）
let lastBriefDate = '';
setInterval(async () => {
  const cfg = loadConfig();
  const sch = cfg.schedule || {};
  if (!sch.enabled) return;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hour = sch.hour ?? 8;

  if (now.getHours() >= hour && lastBriefDate !== today) {
    lastBriefDate = today;
    const domains = sch.domains || ['software-engineering', 'cybersecurity'];
    console.log(`\n[定时] 自动生成每日 Brief: ${today} (领域: ${domains.join(', ')})`);
    try {
      for (const d of domains) {
        await generateBrief({ domain: d });
      }
      addHistory('success', domains);
    } catch (err) {
      console.error('定时 Brief 失败:', err.message);
      addHistory('failed', domains);
    }
  }
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`DeepDive 洞察 Agent 服务已启动：http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止');
});
