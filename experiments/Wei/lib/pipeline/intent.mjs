// Intent detection for chat pipeline — keyword-based, no LLM call needed

const OUTLINE_TRIGGERS = ['生成概要', '生成纲要', '纲要', '可以了', '开始规划', '整理思路', 'outline'];
const REPORT_TRIGGERS = ['生成报告', '开始生成', '写报告', '生成正文', '确认生成', 'generate report'];

export function detectIntent(message, stage) {
  const msg = message.trim().toLowerCase();

  // Report generation — highest priority
  if (REPORT_TRIGGERS.some(t => msg.includes(t.toLowerCase()))) {
    return 'generate_report';
  }

  // Outline generation — only when in brainstorming or init stage
  if (OUTLINE_TRIGGERS.some(t => msg.includes(t.toLowerCase()))) {
    if (stage === 'init' || stage === 'brainstorming') return 'generate_outline';
    // In outline stage, treat as outline modification
    if (stage === 'outline') return 'modify_outline';
  }

  // Stage-based fallback
  if (stage === 'outline') return 'modify_outline';
  if (stage === 'done') return 'brainstorm'; // allow further chat after report

  return 'brainstorm';
}
