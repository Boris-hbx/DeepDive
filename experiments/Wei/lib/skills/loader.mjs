// Unified skill loader — loads from old JSON files + new manifest-based skills

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadManifest, loadPrompt, validate } from './manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(__dirname, '..', '..', 'skills');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// === Load old-format skills (single .json files in skills/) ===
function loadOldSkills() {
  if (!fs.existsSync(SKILLS_ROOT)) return [];
  const files = fs.readdirSync(SKILLS_ROOT).filter(f => f.endsWith('.json') && f !== 'index.json');
  return files.map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(SKILLS_ROOT, f), 'utf-8')); }
    catch (_) { return null; }
  }).filter(Boolean);
}

// === Load new-format skills (directory with manifest.json) ===
function loadNewSkills() {
  const skills = [];
  for (const category of ['builtin', 'custom']) {
    const catDir = path.join(SKILLS_ROOT, category);
    if (!fs.existsSync(catDir)) continue;
    const dirs = fs.readdirSync(catDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of dirs) {
      const skillDir = path.join(catDir, d.name);
      const manifest = loadManifest(skillDir);
      if (!manifest) continue;
      const { valid, errors } = validate(manifest);
      if (!valid) {
        console.log(`  [Skill] 跳过 ${d.name}: ${errors.join(', ')}`);
        continue;
      }
      const promptContent = loadPrompt(skillDir) || manifest.content || '';
      skills.push({
        id: manifest.id || `${category}/${d.name}`,
        name: manifest.name,
        type: manifest.type,
        content: promptContent,
        keywords: manifest.keywords || [],
        hooks: manifest.hooks || [],
        domain: manifest.domain || null,
        version: manifest.version,
        source: category,
        sourceReport: manifest.sourceReport || '',
        createdAt: manifest.createdAt || new Date().toISOString(),
        updatedAt: manifest.updatedAt || new Date().toISOString(),
      });
    }
  }
  return skills;
}

// === Unified API ===

export function loadAllSkills() {
  const old = loadOldSkills();
  const nu = loadNewSkills();
  return [...nu, ...old];
}

export function matchSkills(topic, domain) {
  const all = loadAllSkills();
  const t = topic.toLowerCase();
  return all.filter(s => {
    if (s.domain && domain && s.domain !== domain) return false;
    return s.keywords.some(k => t.includes(k.toLowerCase()));
  });
}

export function getHooksForStage(stage, topic, domain) {
  const skills = matchSkills(topic, domain);
  const hooks = [];
  for (const s of skills) {
    if (s.hooks && s.hooks.includes(stage)) {
      hooks.push({ skill: s.name, content: s.content, type: s.type });
    }
  }
  return hooks;
}

export function saveSkill(skill) {
  ensureDir(SKILLS_ROOT);
  const slug = skill.name.toLowerCase().replace(/[^\w一-鿿]+/g, '-').slice(0, 40);
  const filePath = path.join(SKILLS_ROOT, `${slug}.json`);
  const data = {
    ...skill,
    id: skill.id || crypto.randomUUID(),
    createdAt: skill.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

// === Registry (installed skills index) ===
const REGISTRY_PATH = path.join(SKILLS_ROOT, 'index.json');

export function loadRegistry() {
  ensureDir(SKILLS_ROOT);
  if (!fs.existsSync(REGISTRY_PATH)) {
    // seed with builtin skills
    const builtins = loadNewSkills().filter(s => s.source === 'builtin');
    const reg = builtins.map(s => ({ id: s.id, name: s.name, version: s.version, enabled: true, source: 'builtin' }));
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2), 'utf-8');
    return reg;
  }
  try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')); }
  catch (_) { return []; }
}

export function saveRegistry(registry) {
  ensureDir(SKILLS_ROOT);
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

export function installSkill(id, meta) {
  const reg = loadRegistry();
  const existing = reg.find(s => s.id === id);
  if (existing) {
    existing.version = meta.version;
    existing.enabled = true;
  } else {
    reg.push({ id, name: meta.name, version: meta.version, enabled: true, source: meta.source || 'custom' });
  }
  saveRegistry(reg);
}
