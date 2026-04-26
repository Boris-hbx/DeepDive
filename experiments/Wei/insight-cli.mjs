#!/usr/bin/env node
import { generateSurvey, generateFollowUp } from './lib/report-generator.mjs';

const args = process.argv.slice(2);

function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

const hasFlag = (name) => args.includes(`--${name}`);

const topic = getArg('topic');
const timeRange = getArg('time');
const tagsRaw = getArg('tags');
const provider = getArg('provider') || 'claude';
const domain = getArg('domain');
const template = getArg('template') || 'tech-blue';
const isBrief = hasFlag('brief');
const isFollowUp = hasFlag('follow-up');
const parentId = getArg('parent');
const question = getArg('question');

if (!topic && !isBrief && !isFollowUp) {
  console.log(`
DeepDive 洞察 Agent CLI

用法：
  node insight-cli.mjs --topic "课题名称" [选项]
  node insight-cli.mjs --brief [--domain <domain>]
  node insight-cli.mjs --follow-up --parent <reportId> --question "追问"

选项：
  --topic    技术课题（必填，综述模式）
  --domain   领域：software-engineering | cybersecurity（可选，自动判断）
  --time     时间范围，如 "2024-2026"
  --tags     用户标签，逗号分隔
  --provider LLM 后端，默认 claude
  --brief    生成每日 brief
  --follow-up 追问模式
  --parent   父报告 ID（追问模式必填）
  --question 追问问题（追问模式必填）

示例：
  node insight-cli.mjs --topic "零信任架构落地实践"
  node insight-cli.mjs --topic "AI Code Agent" --domain software-engineering --tags "LLM,Agent"
  node insight-cli.mjs --brief
  node insight-cli.mjs --follow-up --parent <id> --question "对比 SASE 和零信任"
`);
  process.exit(0);
}

console.log('');
console.log('DeepDive 洞察 Agent');
console.log('-'.repeat(40));

if (isBrief) {
  const { generateBrief } = await import('./lib/brief-generator.mjs');
  console.log(`  模式: 每日 Brief`);
  if (domain) console.log(`  领域: ${domain}`);
  console.log('');
  await generateBrief({ domain, provider }).catch(err => {
    console.error('生成失败:', err.message || err);
    process.exit(1);
  });
} else if (isFollowUp) {
  if (!parentId || !question) {
    console.error('追问模式需要 --parent 和 --question 参数');
    process.exit(1);
  }
  console.log(`  模式: 追问深挖`);
  console.log(`  父报告: ${parentId}`);
  console.log(`  问题: ${question}`);
  console.log('');
  await generateFollowUp({ parentReportId: parentId, question, provider }).catch(err => {
    console.error('生成失败:', err.message || err);
    process.exit(1);
  });
} else {
  const userTags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()) : [];
  console.log(`  课题: ${topic}`);
  if (domain) console.log(`  领域: ${domain}`);
  if (timeRange) console.log(`  时间: ${timeRange}`);
  if (userTags.length) console.log(`  标签: ${userTags.join(', ')}`);
  console.log(`  模型: ${provider}`);
  console.log('');
  await generateSurvey({ topic, timeRange, userTags, provider, domain }).catch(err => {
    console.error('生成失败:', err.message || err);
    process.exit(1);
  });
}
