// Unified logging to disk — JSONL format under logs/YYYY/MM/DD/
// Categories: llm, search, email, error
// No external deps, append-only, auto-create directories.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_ROOT = path.join(__dirname, '..', 'logs');

function logDir() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return path.join(LOGS_ROOT, String(y), m, d);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeLine(category, entry) {
  const entryTs = { ts: new Date().toISOString(), type: category, ...entry };
  try {
    const dir = logDir();
    ensureDir(dir);
    const file = path.join(dir, `${category}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entryTs) + '\n', 'utf-8');
  } catch (_) {
    // Never let logging break the main flow
  }
}

// ── LLM call log ──────────────────────────────────────────────
export function logLLM({ provider, model, caller, sessionId, prompt, responseText, usage, durationMs, error }) {
  writeLine('llm', {
    provider: provider || '',
    model: model || '',
    caller: caller || '',
    sessionId: sessionId || '',
    promptLen: prompt ? prompt.length : 0,
    promptPreview: (prompt || '').slice(0, 500),
    responseLen: responseText ? responseText.length : 0,
    responsePreview: (responseText || '').slice(0, 500),
    usage: usage || { input: 0, output: 0 },
    durationMs: durationMs ?? 0,
    error: error || null,
  });
}

// ── Search call log ───────────────────────────────────────────
export function logSearch({ provider, queries, resultCount, durationMs, sessionId, error }) {
  writeLine('search', {
    provider: provider || '',
    queries: queries || [],
    resultCount: resultCount ?? 0,
    durationMs: durationMs ?? 0,
    sessionId: sessionId || '',
    error: error || null,
  });
}

// ── Email send log ────────────────────────────────────────────
export function logEmail({ to, subject, reportId, success, messageId, error }) {
  writeLine('email', {
    to: to || [],
    subject: subject || '',
    reportId: reportId || '',
    success: success ?? true,
    messageId: messageId || '',
    error: error || null,
  });
}

// ── Error log ─────────────────────────────────────────────────
export function logError({ source, message, stack, sessionId, context }) {
  writeLine('error', {
    source: source || '',
    message: message || '',
    stack: (stack || '').slice(0, 1000),
    sessionId: sessionId || '',
    context: context || {},
  });
}
