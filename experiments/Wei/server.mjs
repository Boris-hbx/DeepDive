import dns from 'dns';

// Fix: nodemailer 内部 new dns.Resolver() 是独立实例，不受 dns.setServers() 影响。
// 此环境默认 DNS (114.114.114.114) 对 *.139.com/*.10086.cn 返回被污染地址 198.18.0.x。
// 代理 dns.Resolver 构造函数，让所有 Resolver 实例使用正确 DNS。
const OrigResolver = dns.Resolver;
dns.Resolver = new Proxy(OrigResolver, {
  construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget);
    instance.setServers(['223.5.5.5', '119.29.29.29']);
    return instance;
  }
});

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import nodemailer from 'nodemailer';
import { generateSurvey, generateFollowUp } from './lib/report-generator.mjs';
import { loadFeedback, saveFeedback, saveSkill } from './lib/feedback.mjs';
import { loadAllSkills, saveSkill as saveSkillNew, loadRegistry } from './lib/skills/index.mjs';
import { getMetrics } from './lib/evolution/index.mjs';
import { listReportMemories, recallContext } from './lib/memory/index.mjs';
import { generateBrief } from './lib/brief-generator.mjs';
import { fetchSource } from './lib/fetcher.mjs';
import { generatePptx } from './lib/pptx-generator.mjs';
import { createProvider } from './lib/llm-provider.mjs';
import { createSession, getSession, removeSession, createDeepResearchV3Session } from './lib/session-manager.mjs';
import { startPipeline, confirmOutlinePipeline, modifyReportPipeline, undoModifyPipeline, saveReportPipeline, addCustomSourcePipeline, autoSearchPipeline, skipSearchPipeline, chatPipeline, deepResearchPipeline, deepResearchV3BrainstormTurn, deepResearchV3Plan, deepResearchV3PlanL2, deepResearchV3PlanL3, deepResearchV3Execute, deepResearchV3Synthesize } from './lib/pipeline/insight-pipeline.mjs';
import { logEmail, logError } from './lib/logger.mjs';

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
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function serveStatic(req, res) {
  const decoded = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  let filePath = path.resolve(__dirname, '.' + decoded);
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }
  if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }
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

async function parseBody(req, res) {
  try {
    const raw = await readBody(req);
    return JSON.parse(raw || '{}');
  } catch (_) {
    jsonRes(res, 400, { error: '请求体不是合法的 JSON' });
    return null;
  }
}

function jsonRes(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// === SSE 辅助 ===
function setupSSE(req, res, sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    jsonRes(res, 404, { error: '会话不存在' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const onProgress = (data) => {
    res.write(`event: progress\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const onThinking = (data) => {
    res.write(`event: thinking\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const onDocuments = (data) => {
    res.write(`event: documents\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const onOutline = (data) => {
    res.write(`event: outline\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const onContent = (data) => {
    res.write(`event: content\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const onDone = (data) => {
    res.write(`event: done\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const onError = (data) => {
    res.write(`event: error\ndata: ${JSON.stringify(data)}\n\n`);
  };

  session.events.on('progress', onProgress);
  session.events.on('thinking', onThinking);
  session.events.on('documents', onDocuments);
  session.events.on('outline', onOutline);
  session.events.on('content', onContent);
  session.events.on('done', onDone);
  session.events.on('error', onError);

  // Send initial connected event
  res.write(`event: connected\ndata: {"sessionId":"${sessionId}"}\n\n`);

  // Replay already-emitted events (race condition: pipeline may finish before SSE connects)
  if (session._thinking) {
    res.write(`event: thinking\ndata: ${JSON.stringify({ content: session._thinking })}\n\n`);
  }
  if (session.items && session.items.length > 0) {
    for (let i = 0; i < session.items.length; i += 10) {
      res.write(`event: documents\ndata: ${JSON.stringify({ items: session.items.slice(i, i + 10), hasMore: i + 10 < session.items.length })}\n\n`);
    }
  }
  if (session.outline && session.outline.length > 0) {
    res.write(`event: outline\ndata: ${JSON.stringify({ outline: session.outline })}\n\n`);
  }
  if (session.markdown) {
    res.write(`event: content\ndata: ${JSON.stringify({ chunk: session.markdown })}\n\n`);
  }
  if (session.stage === 'awaiting_sources') {
    res.write(`event: progress\ndata: ${JSON.stringify({ stage: 'awaiting_sources', detail: '初步分析完成。可添加更多信息源或点击"自动搜索"深化分析。' })}\n\n`);
  }

  // Heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    session.events.off('progress', onProgress);
    session.events.off('thinking', onThinking);
    session.events.off('documents', onDocuments);
    session.events.off('outline', onOutline);
    session.events.off('content', onContent);
    session.events.off('done', onDone);
    session.events.off('error', onError);
  });
}

// === 路由表 ===
// 每个 handler 签名: async (req, res, url: URL) => void
const routes = [
  ['POST', '/api/generate', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { topic, userTags, timeRange, domain } = body;
    if (!topic) return jsonRes(res, 400, { error: '缺少 topic' });
    const cfg = loadConfig();
    const task = createTask('generate', topic);
    try {
      const report = await generateSurvey({ topic, timeRange, userTags: userTags || [], domain, template: cfg.defaultTemplate });
      finishTask(task);
      return jsonRes(res, 200, { ok: true, title: report.title, tags: report.tags, path: report.path, url: `/reports/${report.path}.html` });
    } catch (err) { finishTask(task, err); throw err; }
  }],
  ['POST', '/api/follow-up', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { parentReportId, question } = body;
    if (!parentReportId || !question) return jsonRes(res, 400, { error: '缺少 parentReportId 或 question' });
    const task = createTask('follow-up', question.slice(0, 60));
    try {
      const report = await generateFollowUp({ parentReportId, question });
      finishTask(task);
      return jsonRes(res, 200, { ok: true, title: report.title, path: report.path, url: `/reports/${report.path}.html` });
    } catch (err) { finishTask(task, err); throw err; }
  }],
  ['POST', '/api/brief', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { domain } = body;
    const task = createTask('brief', domain ? (domain === 'cybersecurity' ? '网络安全' : '软件工程') : '全部领域');
    try {
      await generateBrief({ domain });
      finishTask(task);
      return jsonRes(res, 200, { ok: true });
    } catch (err) { finishTask(task, err); throw err; }
  }],
  ['DELETE', '/api/reports', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { ids } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return jsonRes(res, 400, { error: '缺少 ids（报告 ID 数组）' });

    const indexPath = path.join(__dirname, 'reports', 'index.json');
    if (!fs.existsSync(indexPath)) return jsonRes(res, 404, { error: 'index.json 不存在' });

    let indexData;
    try { indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8')); } catch (_) { return jsonRes(res, 500, { error: 'index.json 解析失败' }); }

    const deleted = [];
    const notFound = [];

    for (const id of ids) {
      const entryIdx = indexData.findIndex(e => e.id === id);
      if (entryIdx === -1) { notFound.push(id); continue; }

      const entry = indexData[entryIdx];
      const reportDir = path.join(__dirname, 'reports', path.dirname(entry.path));

      // Delete all files matching the report's base name in reports/
      if (fs.existsSync(reportDir)) {
        const baseName = path.basename(entry.path);
        const files = fs.readdirSync(reportDir);
        for (const f of files) {
          if (f.startsWith(baseName + '.') || f.startsWith(baseName + '-')) {
            try { fs.unlinkSync(path.join(reportDir, f)); } catch (_) {}
          }
        }
      }

      // For daily-brief type, also delete from briefs/ directory
      if (entry.type === 'daily-brief') {
        const briefDir = path.join(__dirname, 'briefs', path.dirname(entry.path));
        if (fs.existsSync(briefDir)) {
          const baseName = path.basename(entry.path);
          const files = fs.readdirSync(briefDir);
          for (const f of files) {
            if (f.startsWith(baseName + '.') || f.startsWith(baseName + '-')) {
              try { fs.unlinkSync(path.join(briefDir, f)); } catch (_) {}
            }
          }
        }
      }

      indexData.splice(entryIdx, 1);
      deleted.push({ id: entry.id, title: entry.title });
    }

    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
    return jsonRes(res, 200, { ok: true, deleted, notFound });
  }],
  ['GET', '/api/feedback', async (req, res, url) => {
    const reportId = url.searchParams.get('reportId') || '';
    const all = loadFeedback();
    const filtered = reportId ? all.filter(f => f.reportId === reportId) : all;
    return jsonRes(res, 200, { feedback: filtered });
  }],
  ['POST', '/api/feedback', async (req, res) => {
    const data = await parseBody(req, res); if (data === null) return;
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
  }],
  ['GET', '/api/skills', async (_req, res) => {
    const skills = loadAllSkills();
    const registry = loadRegistry();
    return jsonRes(res, 200, { skills, registry });
  }],
  ['POST', '/api/regenerate', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { topic, feedback, domain } = body;
    if (!topic) return jsonRes(res, 400, { error: '缺少 topic' });
    const cfg = loadConfig();
    const task = createTask('regenerate', topic);
    try {
      const report = await generateSurvey({ topic, userTags: [], timeRange: '', domain, feedbackHint: feedback, template: cfg.defaultTemplate });
      finishTask(task);
      return jsonRes(res, 200, { ok: true, url: `/reports/${report.path}.html`, path: report.path });
    } catch (err) { finishTask(task, err); throw err; }
  }],
  ['POST', '/api/pptx', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { reportId, template } = body;
    if (!reportId) return jsonRes(res, 400, { error: '缺少 reportId' });
    const cfg = loadConfig();
    const tpl = template || cfg.defaultTemplate || 'tech-blue';
    const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, 'reports', 'index.json'), 'utf-8'));
    const entry = indexData.find(e => e.id === reportId);
    if (!entry) return jsonRes(res, 404, { error: '报告不存在' });
    const mdPath = path.join(__dirname, 'reports', entry.path + '.md');
    if (!fs.existsSync(mdPath)) return jsonRes(res, 404, { error: '报告 Markdown 文件不存在' });
    const md = fs.readFileSync(mdPath, 'utf-8');

    // 读取 meta（reports/ 优先，briefs/ 兜底）
    let metaPath = path.join(__dirname, 'reports', entry.path + '.meta.json');
    if (!fs.existsSync(metaPath) && entry.type === 'daily-brief') {
      metaPath = path.join(__dirname, 'briefs', entry.path + '.meta.json');
    }
    let meta = {};
    if (fs.existsSync(metaPath)) {
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch (_) {}
    }

    const pptxPath = path.join(__dirname, 'reports', entry.path + '-' + tpl + '.pptx');
    await generatePptx({
      markdown: md, title: entry.title, template: tpl,
      meta: {
        domain: meta.domain || entry.domain || '',
        tags: meta.tags || entry.tags || {},
        date: meta.createdAt?.slice(0, 10) || meta.date || '',
        llmProvider: meta.metadata?.llmProvider || meta.llmProvider || '',
        cost: meta.metadata?.cost || 0,
      },
      outputPath: pptxPath,
    });
    return jsonRes(res, 200, { ok: true, url: `/reports/${entry.path}-${tpl}.pptx` });
  }],
  ['GET', '/api/tasks', async (req, res, url) => {
    const typeFilter = url.searchParams.get('type') || '';
    const filtered = typeFilter ? tasks.filter(t => t.type === typeFilter) : tasks;
    return jsonRes(res, 200, { tasks: filtered.slice().reverse() });
  }],
  ['GET', '/api/sources', async (_req, res) => {
    const data = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf-8'));
    return jsonRes(res, 200, data);
  }],
  ['PUT', '/api/sources', async (req, res) => {
    const data = await parseBody(req, res); if (data === null) return;
    fs.writeFileSync(SOURCES_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return jsonRes(res, 200, { ok: true });
  }],
  ['POST', '/api/sources/test', async (req, res) => {
    const source = await parseBody(req, res); if (source === null) return;
    const items = await fetchSource(source);
    return jsonRes(res, 200, { ok: true, count: items.length, sample: items.slice(0, 3).map(i => i.title) });
  }],
  ['GET', '/api/schedule', async (_req, res) => {
    const cfg = loadConfig();
    return jsonRes(res, 200, { schedule: cfg.schedule, history: cfg.history || [], defaultTemplate: cfg.defaultTemplate || 'tech-blue', focusTopics: cfg.focusTopics || {} });
  }],
  ['PUT', '/api/schedule', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const cfg = loadConfig();
    if (body.schedule) cfg.schedule = body.schedule;
    if (body.defaultTemplate) cfg.defaultTemplate = body.defaultTemplate;
    if (body.focusTopics) cfg.focusTopics = body.focusTopics;
    saveConfig(cfg);
    return jsonRes(res, 200, { ok: true });
  }],
  ['GET', '/api/llm-config', async (_req, res) => {
    const cfg = loadConfig();
    const llm = cfg.llm || { preset: 'deepseek', baseURL: '', model: '', protocol: 'openai' };
    const hasKey = !!(process.env.LLM_API_KEY || '');
    return jsonRes(res, 200, { ...llm, apiKey: hasKey ? '***' : '' });
  }],
  ['PUT', '/api/llm-config', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const cfg = loadConfig();
    cfg.llm = {
      preset: body.preset || 'deepseek',
      baseURL: body.baseURL || '',
      model: body.model || '',
      protocol: body.protocol || 'openai',
    };
    saveConfig(cfg);
    if (body.apiKey && body.apiKey !== '***') {
      const envPath = path.join(__dirname, '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf-8');
      if (/^LLM_API_KEY=/m.test(envContent)) {
        envContent = envContent.replace(/^LLM_API_KEY=.*/m, `LLM_API_KEY=${body.apiKey}`);
      } else {
        envContent = envContent.trimEnd() + `\nLLM_API_KEY=${body.apiKey}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf-8');
      process.env.LLM_API_KEY = body.apiKey;
    }
    return jsonRes(res, 200, { ok: true });
  }],
  ['POST', '/api/llm-test', async (_req, res) => {
    const t0 = Date.now();
    const provider = createProvider();
    const { text } = await provider.generate('Reply with exactly: ok', { maxTokens: 16, timeout: 30000 });
    return jsonRes(res, 200, { ok: true, model: provider.name, latencyMs: Date.now() - t0, reply: text.trim() });
  }],
  // === 邮件配置 & 发送 API ===
  ['GET', '/api/email-config', async (_req, res) => {
    const cfg = loadConfig();
    const email = cfg.email || { smtp: { host: '', port: 465, secure: true }, from: '', recipients: [] };
    const hasUser = !!(process.env.SMTP_USER || '');
    const hasPass = !!(process.env.SMTP_PASS || '');
    return jsonRes(res, 200, { ...email, smtp: { ...email.smtp, hasUser, hasPass } });
  }],
  ['PUT', '/api/email-config', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const cfg = loadConfig();
    cfg.email = {
      smtp: {
        host: body.smtp?.host || '',
        port: body.smtp?.port || 465,
        secure: body.smtp?.secure !== false,
      },
      from: body.from || '',
      recipients: body.recipients || [],
    };
    saveConfig(cfg);

    // Write SMTP credentials to .env (never stored in config.json)
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf-8');

    if (body.smtp?.user && body.smtp.user !== '***') {
      process.env.SMTP_USER = body.smtp.user;
      if (/^SMTP_USER=/m.test(envContent)) {
        envContent = envContent.replace(/^SMTP_USER=.*/m, `SMTP_USER=${body.smtp.user}`);
      } else {
        envContent = envContent.trimEnd() + `\nSMTP_USER=${body.smtp.user}\n`;
      }
    }
    if (body.smtp?.password && body.smtp.password !== '***') {
      process.env.SMTP_PASS = body.smtp.password;
      if (/^SMTP_PASS=/m.test(envContent)) {
        envContent = envContent.replace(/^SMTP_PASS=.*/m, `SMTP_PASS=${body.smtp.password}`);
      } else {
        envContent = envContent.trimEnd() + `\nSMTP_PASS=${body.smtp.password}\n`;
      }
    }

    if (envContent) fs.writeFileSync(envPath, envContent, 'utf-8');
    return jsonRes(res, 200, { ok: true });
  }],
  ['POST', '/api/send-email', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { reportId, recipients } = body;
    if (!reportId) return jsonRes(res, 400, { error: '缺少 reportId' });
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) return jsonRes(res, 400, { error: '缺少 recipients' });

    const cfg = loadConfig();
    const emailCfg = cfg.email;
    if (!emailCfg || !emailCfg.smtp?.host) return jsonRes(res, 400, { error: '邮件服务未配置，请先在管理台配置 SMTP' });

    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    if (!smtpUser || !smtpPass) return jsonRes(res, 400, { error: 'SMTP 用户名或密码未配置，请在管理台→邮件配置中设置' });

    const transporter = nodemailer.createTransport({
      host: emailCfg.smtp.host,
      port: emailCfg.smtp.port,
      secure: emailCfg.smtp.secure !== false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const from = emailCfg.from || smtpUser;

    // Test email special case
    if (reportId === '__test__') {
      try {
        const info = await transporter.sendMail({
          from,
          to: recipients.join(', '),
          subject: '[DeepDive] 测试邮件',
          html: '<p>这是一封来自 DeepDive 的测试邮件。SMTP 配置正常。</p>',
        });
        console.log('[email] 测试邮件已发送:', info.messageId, 'accepted:', info.accepted, 'rejected:', info.rejected);
        logEmail({ to: recipients, subject: '[DeepDive] 测试邮件', reportId: '__test__', success: true, messageId: info.messageId });
        return jsonRes(res, 200, { ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
      } catch (err) {
        console.error('[email] 测试邮件发送失败:', err.message);
        logEmail({ to: recipients, subject: '[DeepDive] 测试邮件', reportId: '__test__', success: false, error: err.message });
        return jsonRes(res, 500, { error: '邮件发送失败: ' + (err.message || String(err)) });
      }
    }

    const indexPath = path.join(__dirname, 'reports', 'index.json');
    if (!fs.existsSync(indexPath)) return jsonRes(res, 404, { error: 'index.json 不存在' });
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const entry = indexData.find(e => e.id === reportId);
    if (!entry) return jsonRes(res, 404, { error: '报告不存在' });

    const htmlPath = path.join(__dirname, 'reports', entry.path + '.html');
    if (!fs.existsSync(htmlPath)) return jsonRes(res, 404, { error: '报告 HTML 文件不存在' });
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    try {
      const info = await transporter.sendMail({
        from,
        to: recipients.join(', '),
        subject: `[DeepDive] ${entry.title}`,
        html: htmlContent,
      });
      console.log('[email] 报告邮件已发送:', info.messageId, 'accepted:', info.accepted, 'rejected:', info.rejected);
      logEmail({ to: recipients, subject: `[DeepDive] ${entry.title}`, reportId, success: true, messageId: info.messageId });
      return jsonRes(res, 200, { ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
    } catch (err) {
      console.error('[email] 报告邮件发送失败:', err.message);
      logEmail({ to: recipients, subject: `[DeepDive] ${entry.title}`, reportId, success: false, error: err.message });
      return jsonRes(res, 500, { error: '邮件发送失败: ' + (err.message || String(err)) });
    }
  }],
  // === 演进 & 记忆 API ===
  ['GET', '/api/evolution/metrics', async (_req, res) => {
    return jsonRes(res, 200, getMetrics());
  }],
  ['GET', '/api/memory/reports', async (_req, res) => {
    return jsonRes(res, 200, { reports: listReportMemories() });
  }],
  ['POST', '/api/memory/recall', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { topic, domain } = body;
    const result = recallContext(topic || '', domain);
    return jsonRes(res, 200, result);
  }],
  // === 文章反馈 API ===
  ['POST', '/api/article-feedback', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { articleUrl, articleTitle, source, domain, interest } = body;
    if (!articleUrl || !interest) return jsonRes(res, 400, { error: '缺少 articleUrl 或 interest' });
    if (!['high', 'medium', 'low'].includes(interest)) return jsonRes(res, 400, { error: 'interest 必须为 high/medium/low' });
    try {
      const { saveArticleFeedback } = await import('./lib/memory/article-feedback.mjs');
      const { indexArticle } = await import('./lib/memory/inverted.mjs');
      const entry = saveArticleFeedback({ articleUrl, articleTitle: articleTitle || '', source: source || '', domain: domain || 'software-engineering', interest });
      const interestScore = { high: 1.0, medium: 0.5, low: 0.1 }[interest];
      indexArticle(articleUrl, articleTitle || '', domain || 'software-engineering', interestScore);
      return jsonRes(res, 200, { ok: true, id: entry.id });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  }],
  ['GET', '/api/article-feedback', async (req, res, url) => {
    const domain = url.searchParams.get('domain') || '';
    const { loadArticleFeedback } = await import('./lib/memory/article-feedback.mjs');
    try {
      const feedback = loadArticleFeedback(domain, 100);
      return jsonRes(res, 200, { feedback });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  }],
  // === Skill 管理 API ===
  ['GET', '/api/skills/registry', async (_req, res) => {
    return jsonRes(res, 200, loadRegistry());
  }],
  // === Chat 洞察 API (新交互模式) ===
  ['POST', '/api/insight/chat', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId: existingSessionId, message, domain } = body;
    if (!message) return jsonRes(res, 400, { error: '缺少 message' });

    // Create session on first message if no sessionId provided
    let sessionId = existingSessionId;
    if (!sessionId) {
      sessionId = createSession({ topic: message.slice(0, 100), domain: domain || '', timeRange: '' });
    }

    const session = getSession(sessionId);
    if (!session) return jsonRes(res, 404, { error: '会话不存在' });

    // Respond as SSE stream
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send sessionId immediately so frontend can store it
    res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    const emit = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await chatPipeline(sessionId, message, domain, emit);
    } catch (err) {
      console.error('[chat] pipeline error:', err.message);
      logError({ source: 'chatPipeline', message: err.message, stack: err.stack, sessionId });
      emit('error', { message: err.message || String(err) });
    }

    res.end();
  }],
  // === 深度研究 API (增强洞察：Plan → Search → Analyze → Reflect → Synthesize) ===
  ['POST', '/api/insight/deep-research', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { topic, domain, analysisDoc } = body;
    if (!topic) return jsonRes(res, 400, { error: '缺少 topic' });

    const sessionId = createSession({ topic, domain: domain || '', timeRange: '', analysisDoc: analysisDoc || '' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    const emit = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      await deepResearchPipeline(sessionId, domain, emit, analysisDoc);
    } catch (err) {
      console.error('[deep-research] pipeline error:', err.message);
      logError({ source: 'deepResearchPipeline', message: err.message, stack: err.stack, sessionId });
      emit('error', { message: err.message || String(err) });
    }

    res.end();
  }],
  // === 深度研究 V3 API ===
  // Brainstorm turn: one dialogue turn to refine analysis task list
  ['POST', '/api/insight/deep-research-v3/brainstorm', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId: existingSessionId, topic, message, domain } = body;
    if (!message) return jsonRes(res, 400, { error: '缺少 message' });

    let sessionId = existingSessionId;
    if (!sessionId) {
      if (!topic) return jsonRes(res, 400, { error: '首次请求需提供 topic' });
      sessionId = createDeepResearchV3Session({ topic, domain: domain || '' });
    }

    const session = getSession(sessionId);
    if (!session) return jsonRes(res, 404, { error: '会话不存在' });

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      const result = await deepResearchV3BrainstormTurn(sessionId, message, emit);
      emit('brainstorm_done', result);
    } catch (err) {
      console.error('[v3-brainstorm] error:', err.message);
      logError({ source: 'deepResearchV3BrainstormTurn', message: err.message, stack: err.stack, sessionId });
      emit('error', { message: err.message || String(err) });
    }
    res.end();
  }],
  // Plan: decompose confirmed tasks into L1 tree (and optionally L2/L3 in auto mode)
  ['POST', '/api/insight/deep-research-v3/plan', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId } = body;
    if (!sessionId) return jsonRes(res, 400, { error: '缺少 sessionId' });

    const session = getSession(sessionId);
    if (!session) return jsonRes(res, 404, { error: '会话不存在' });

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      const result = await deepResearchV3Plan(sessionId, emit);
      emit('plan_done', result);
    } catch (err) {
      console.error('[v3-plan] error:', err.message);
      logError({ source: 'deepResearchV3Plan', message: err.message, stack: err.stack, sessionId });
      emit('error', { message: err.message || String(err) });
    }
    res.end();
  }],
  // Confirm: user confirms a plan level and triggers next decomposition or execution
  ['POST', '/api/insight/deep-research-v3/confirm', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId, level, taskTree, autoAll } = body;
    if (!sessionId) return jsonRes(res, 400, { error: '缺少 sessionId' });

    const session = getSession(sessionId);
    if (!session) return jsonRes(res, 404, { error: '会话不存在' });

    // Apply user edits to task tree if provided
    if (taskTree) session.taskTree = taskTree;
    if (autoAll) session.confirmMode = 'auto';

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      let result;
      if (level === 1) {
        result = await deepResearchV3PlanL2(sessionId, emit);
      } else if (level === 2) {
        result = await deepResearchV3PlanL3(sessionId, emit);
      } else if (level === 3 || level === 'execute') {
        // User confirmed L3 (or chose to stop at L2) — start execution
        await deepResearchV3Execute(sessionId, emit);
        result = await deepResearchV3Synthesize(sessionId, emit);
      } else {
        result = { error: '未知 level' };
      }
      emit('confirm_done', result || {});
    } catch (err) {
      console.error('[v3-confirm] error:', err.message);
      logError({ source: 'deepResearchV3Confirm', message: err.message, stack: err.stack, sessionId });
      emit('error', { message: err.message || String(err) });
    }
    res.end();
  }],
  // === 交互式洞察工作台 API ===
  ['POST', '/api/insight/start', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { topic, domain, timeRange } = body;
    if (!topic) return jsonRes(res, 400, { error: '缺少 topic' });

    const sessionId = createSession({ topic, domain: domain || '', timeRange: timeRange || '' });

    // Start pipeline asynchronously (don't await — SSE will stream progress)
    startPipeline(sessionId).catch(err => {
      console.error('洞察流水线失败:', err.message || err);
      console.error('Stack:', err.stack);
      logError({ source: 'startPipeline', message: err.message, stack: err.stack, sessionId });
      const session = getSession(sessionId);
      if (session) {
        session.stage = 'error';
        session.events.emit('error', { message: err.message || String(err) });
      }
    });

    return jsonRes(res, 200, { sessionId });
  }],
  ['GET', '/api/insight/stream', async (req, res, url) => {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) return jsonRes(res, 400, { error: '缺少 sessionId' });
    setupSSE(req, res, sessionId);
  }],
  ['POST', '/api/insight/confirm-outline', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId, outline } = body;
    if (!sessionId || !outline) return jsonRes(res, 400, { error: '缺少 sessionId 或 outline' });

    // Run body generation asynchronously
    confirmOutlinePipeline(sessionId, outline).catch(err => {
      logError({ source: 'confirmOutlinePipeline', message: err.message, stack: err.stack, sessionId });
      const session = getSession(sessionId);
      if (session) {
        session.stage = 'error';
        session.events.emit('error', { message: err.message });
      }
      console.error('正文生成失败:', err);
    });

    return jsonRes(res, 200, { ok: true });
  }],
  ['POST', '/api/insight/add-source', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId, url } = body;
    if (!sessionId || !url) return jsonRes(res, 400, { error: '缺少 sessionId 或 url' });

    try {
      const item = await addCustomSourcePipeline(sessionId, url);
      return jsonRes(res, 200, { ok: true, item });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  }],
  ['POST', '/api/insight/auto-search', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId } = body;
    if (!sessionId) return jsonRes(res, 400, { error: '缺少 sessionId' });

    // Run auto-search asynchronously
    autoSearchPipeline(sessionId).catch(err => {
      logError({ source: 'autoSearchPipeline', message: err.message, stack: err.stack, sessionId });
      const session = getSession(sessionId);
      if (session) {
        session.stage = 'error';
        session.events.emit('error', { message: err.message });
      }
      console.error('自动搜索失败:', err);
    });

    return jsonRes(res, 200, { ok: true });
  }],
  ['POST', '/api/insight/skip-search', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId } = body;
    if (!sessionId) return jsonRes(res, 400, { error: '缺少 sessionId' });

    // Generate outline directly from LLM thinking
    skipSearchPipeline(sessionId).catch(err => {
      logError({ source: 'skipSearchPipeline', message: err.message, stack: err.stack, sessionId });
      const session = getSession(sessionId);
      if (session) {
        session.stage = 'error';
        session.events.emit('error', { message: err.message });
      }
      console.error('跳过搜索生成纲要失败:', err);
    });

    return jsonRes(res, 200, { ok: true });
  }],
  ['POST', '/api/insight/modify', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId, instruction } = body;
    if (!sessionId || !instruction) return jsonRes(res, 400, { error: '缺少 sessionId 或 instruction' });

    try {
      const result = await modifyReportPipeline(sessionId, instruction);
      return jsonRes(res, 200, { markdown: result.markdown, snapshotCount: result.snapshotCount });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  }],
  ['POST', '/api/insight/undo', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId } = body;
    if (!sessionId) return jsonRes(res, 400, { error: '缺少 sessionId' });

    try {
      const result = await undoModifyPipeline(sessionId);
      return jsonRes(res, 200, { markdown: result.markdown, snapshotCount: result.snapshotCount });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  }],
  ['POST', '/api/insight/save', async (req, res) => {
    const body = await parseBody(req, res); if (body === null) return;
    const { sessionId, title } = body;
    if (!sessionId) return jsonRes(res, 400, { error: '缺少 sessionId' });

    try {
      const session = getSession(sessionId);
      const opts = session && session.mode === 'deep' ? { type: 'deep-research' } : {};
      const result = await saveReportPipeline(sessionId, title, opts);
      return jsonRes(res, 200, { ok: true, ...result });
    } catch (err) {
      return jsonRes(res, 500, { error: err.message });
    }
  }],
];

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const p = parsedUrl.pathname;

  try {
    const matched = routes.find(r => r[0] === req.method && r[1] === p);
    if (matched) {
      await matched[2](req, res, parsedUrl);
      return;
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
