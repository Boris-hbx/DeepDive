// Skill manifest schema and validation
// 新格式 skill 目录结构：skills/<category>/<name>/{manifest.json, prompt.md, hooks.mjs?}

import fs from 'fs';
import path from 'path';

const REQUIRED = ['name', 'version', 'type', 'keywords'];
const VALID_TYPES = ['insight', 'method', 'missing', 'error'];
const VALID_HOOKS = ['preFetch', 'postDedup', 'postRank', 'prePrompt', 'postRender'];

export function validate(manifest) {
  const errors = [];
  for (const key of REQUIRED) {
    if (!manifest[key]) errors.push(`缺少必填字段: ${key}`);
  }
  if (manifest.type && !VALID_TYPES.includes(manifest.type)) {
    errors.push(`无效 type: ${manifest.type}，可选值: ${VALID_TYPES.join(', ')}`);
  }
  if (manifest.hooks) {
    for (const h of manifest.hooks) {
      if (!VALID_HOOKS.includes(h)) errors.push(`无效 hook: ${h}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function loadManifest(skillDir) {
  const manifestPath = path.join(skillDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (_) { return null; }
}

export function loadPrompt(skillDir) {
  const promptPath = path.join(skillDir, 'prompt.md');
  if (!fs.existsSync(promptPath)) return null;
  try {
    return fs.readFileSync(promptPath, 'utf-8').trim();
  } catch (_) { return null; }
}

export function loadHooks(skillDir) {
  const hooksPath = path.join(skillDir, 'hooks.mjs');
  if (!fs.existsSync(hooksPath)) return {};
  try {
    // hooks.mjs exports named functions matching hook names
    return { _path: hooksPath };
  } catch (_) { return {}; }
}
