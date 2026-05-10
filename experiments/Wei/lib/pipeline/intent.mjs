// Intent detection for chat pipeline — keyword-based, no LLM call needed

const OUTLINE_TRIGGERS = ['生成概要', '生成纲要', '纲要', '可以了', '开始规划', '整理思路', 'outline'];
const REPORT_TRIGGERS = ['生成报告', '开始生成', '写报告', '生成正文', '确认生成', 'generate report'];
const DEEP_RESEARCH_TRIGGERS = ['开始深度研究', '启动深度研究', '开始研究', 'start research'];

// v3 deep research triggers
const CONFIRM_TASKS_TRIGGERS = ['确认任务', '确认', '没问题', '开始分解', '可以分解', '确认清单', 'ok', 'yes', 'confirm'];
const AUTO_ALL_TRIGGERS = ['全部自动', '自动执行', '全部确认', 'auto all', '自动'];
const CONFIRM_PLAN_TRIGGERS = ['确认分解', '确认计划', '开始执行', '执行', 'proceed', 'go ahead'];

// Detect intent for v3 deep research brainst stage
export function detectV3BrainstormIntent(message) {
  const msg = message.trim().toLowerCase();

  if (AUTO_ALL_TRIGGERS.some(t => msg.includes(t.toLowerCase()))) {
    return 'auto_all';
  }
  if (CONFIRM_TASKS_TRIGGERS.some(t => msg.includes(t.toLowerCase()))) {
    return 'confirm_tasks';
  }
  return 'brainstorm';
}

// Detect intent for v3 plan confirmation stage (L1/L2/L3 confirmation)
export function detectV3ConfirmIntent(message) {
  const msg = message.trim().toLowerCase();

  if (AUTO_ALL_TRIGGERS.some(t => msg.includes(t.toLowerCase()))) {
    return 'auto_all';
  }
  if (CONFIRM_PLAN_TRIGGERS.some(t => msg.includes(t.toLowerCase()))) {
    return 'confirm_plan';
  }
  if (msg.includes('编辑') || msg.includes('修改') || msg.includes('edit') || msg.includes('合并') || msg.includes('拆分')) {
    return 'edit_tasks';
  }
  if (msg.includes('到此为止') || msg.includes('够了') || msg.includes('stop') || msg.includes('结束')) {
    return 'stop_decompose';
  }
  return 'confirm_plan'; // default to confirm if user sends anything at confirm stage
}

export function detectIntent(message, stage, fromDeepResearch = false) {
  const msg = message.trim().toLowerCase();

  // Deep research trigger — transition from brainstorm to research
  if (DEEP_RESEARCH_TRIGGERS.some(t => msg.includes(t.toLowerCase()))) {
    return 'start_deep_research';
  }

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
  if (stage === 'done' && fromDeepResearch) return 'modify_report';
  if (stage === 'done') return 'brainstorm'; // allow further chat after report

  return 'brainstorm';
}
