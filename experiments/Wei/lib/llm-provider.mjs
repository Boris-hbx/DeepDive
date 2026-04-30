import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// 从 config.json 读取运行时 LLM 配置，优先级高于 .env
function loadLlmConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return cfg.llm || {};
  } catch (_) { return {}; }
}

export const PROVIDER_PRESETS = {
  deepseek: {
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    protocol: 'openai',
    pricing: { input: 0.5, output: 2 },
  },
  claude: {
    label: 'Claude (Anthropic)',
    baseURL: '',
    model: 'claude-sonnet-4-20250514',
    protocol: 'anthropic',
    pricing: { input: 3, output: 15 },
  },
  openai: {
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    protocol: 'openai',
    pricing: { input: 2.5, output: 10 },
  },
  gemini: {
    label: 'Gemini (OpenAI compat)',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    protocol: 'openai',
    pricing: { input: 0.1, output: 0.4 },
  },
  custom: {
    label: '自定义',
    baseURL: '',
    model: '',
    protocol: 'openai',
    pricing: { input: 3, output: 15 },
  },
};

export function calcCost(providerName, inputTokens, outputTokens) {
  const preset = PROVIDER_PRESETS[providerName] || PROVIDER_PRESETS.custom;
  const p = preset.pricing || { input: 3, output: 15 };
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

async function callOpenAICompat({ apiKey, baseURL, model, prompt, maxTokens, timeout }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      const err = new Error(`HTTP ${resp.status}: ${errText}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};
    return { text, usage: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 } };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function* callOpenAICompatStream({ apiKey, baseURL, model, prompt, maxTokens, timeout }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  let reader;
  try {
    const resp = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }], stream: true }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      const err = new Error(`HTTP ${resp.status}: ${errText}`);
      err.status = resp.status;
      throw err;
    }
    reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let inputTokens = 0, outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          const choice = parsed.choices?.[0];
          const delta = choice?.delta;
          if (delta?.content) {
            yield { chunk: delta.content };
          }
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens || 0;
            outputTokens = parsed.usage.completion_tokens || 0;
          }
          // xai / grok-style: usage appears only in final chunk
          if (choice?.finish_reason) {
            // usage might be in this chunk
          }
        } catch (_) {
          // skip unparseable lines
        }
      }
    }
    // flush remaining buffer
    if (buffer.trim().startsWith('data:')) {
      const dataStr = buffer.trim().slice(5).trim();
      if (dataStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) yield { chunk: delta.content };
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens || 0;
            outputTokens = parsed.usage.completion_tokens || 0;
          }
        } catch (_) {}
      }
    }
    yield { done: true, usage: { input: inputTokens, output: outputTokens } };
  } finally {
    clearTimeout(timeoutId);
    reader?.releaseLock();
  }
}

function createOpenAICompatProvider(cfg) {
  const { apiKey, baseURL, model, label } = cfg;
  if (!apiKey) throw new Error('未找到 API Key，请在管理台「模型配置」中设置。');
  if (!baseURL) throw new Error('未设置 Base URL，请在管理台「模型配置」中设置。');

  return {
    name: label || 'openai-compat',
    async generate(prompt, options = {}) {
      const maxRetries = options.maxRetries || 3;
      const timeout = options.timeout || 120000;
      const maxTokens = options.maxTokens || 8192;
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await callOpenAICompat({ apiKey, baseURL, model, prompt, maxTokens, timeout });
        } catch (err) {
          lastError = err;
          const isRetryable = err.name === 'AbortError' || err.status === 429 || err.status === 500 || err.status === 503;
          if (!isRetryable || attempt === maxRetries) throw new Error(`LLM 调用失败 (尝试 ${attempt}/${maxRetries}): ${err.message}`);
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.log(`  重试 ${attempt}/${maxRetries}，等待 ${delay}ms ...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
      throw lastError;
    },
    async *generateStream(prompt, options = {}) {
      const timeout = options.timeout || 120000;
      const maxTokens = options.maxTokens || 8192;
      yield* callOpenAICompatStream({ apiKey, baseURL, model, prompt, maxTokens, timeout });
    },
  };
}

function createClaudeProvider(cfg = {}) {
  const apiKey = cfg.apiKey || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  const baseURL = cfg.baseURL || process.env.ANTHROPIC_BASE_URL;
  const model = cfg.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  if (!apiKey) throw new Error('未找到 API Key。请在管理台「模型配置」中设置，或在 .env 中设置 ANTHROPIC_API_KEY。');

  const opts = { apiKey };
  if (baseURL) opts.baseURL = baseURL;
  const client = new Anthropic(opts);

  return {
    name: cfg.label || 'Claude (Anthropic)',
    async generate(prompt, options = {}) {
      const maxRetries = options.maxRetries || 3;
      const timeout = options.timeout || 120000;
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          const res = await client.messages.create({
            model: options.model || model,
            max_tokens: options.maxTokens || 8192,
            messages: [{ role: 'user', content: prompt }],
          }, { signal: controller.signal });
          clearTimeout(timeoutId);
          const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
          return { text, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
        } catch (err) {
          lastError = err;
          const isRetryable = err.name === 'AbortError' || err.status === 429 || err.status === 500 || err.status === 503 || err.code === 'ECONNRESET';
          if (!isRetryable || attempt === maxRetries) throw new Error(`LLM 调用失败 (尝试 ${attempt}/${maxRetries}): ${err.message || err}`);
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.log(`  重试 ${attempt}/${maxRetries}，等待 ${delay}ms ...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
      throw lastError;
    },
    async *generateStream(prompt, options = {}) {
      // Claude protocol: no native streaming support yet, fallback to generate
      const result = await this.generate(prompt, options);
      yield { chunk: result.text };
      yield { done: true, usage: result.usage };
    },
  };
}

// 读取运行时配置并创建对应 provider（CLI --provider 参数 > config.json llm 字段 > 默认值）
export function createProvider(providerOverride) {
  const llmCfg = loadLlmConfig();
  const preset = providerOverride || llmCfg.preset || 'deepseek';
  const presetDef = PROVIDER_PRESETS[preset] || PROVIDER_PRESETS.deepseek;

  const apiKey = process.env.LLM_API_KEY || llmCfg.apiKey || '';
  const baseURL = llmCfg.baseURL || presetDef.baseURL;
  const model = llmCfg.model || presetDef.model;
  const protocol = llmCfg.protocol || presetDef.protocol;

  if (protocol === 'anthropic') {
    // Claude 使用独立的 Anthropic 凭证，不混用 LLM_API_KEY
    return createClaudeProvider({ baseURL, model, label: presetDef.label });
  }
  return createOpenAICompatProvider({ apiKey, baseURL, model, label: presetDef.label });
}
