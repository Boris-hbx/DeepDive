import EventEmitter from 'events';
import crypto from 'crypto';

const sessions = new Map();
const TTL_MS = 60 * 60 * 1000; // 1 hour

// Garbage collect stale sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s._created > TTL_MS) {
      s.events.removeAllListeners();
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();

export function createSession({ topic, domain, timeRange, analysisDoc }) {
  const id = crypto.randomUUID();
  const session = {
    id,
    topic,
    domain: domain || '',
    timeRange: timeRange || '',
    stage: 'init',
    items: [],
    outline: [],
    markdown: '',
    snapshots: [],
    chatHistory: [],
    analysisDoc: analysisDoc || '',
    subQuestions: [],
    researchRounds: [],
    mode: 'chat',
    events: new EventEmitter(),
    _created: Date.now(),
  };
  sessions.set(id, session);
  return id;
}

// Create a v3 deep research session with task-tree specific fields
export function createDeepResearchV3Session({ topic, domain }) {
  const id = crypto.randomUUID();
  const session = {
    id,
    topic,
    domain: domain || '',
    stage: 'brainstorming',
    items: [],
    markdown: '',
    chatHistory: [],
    analysisDoc: '',
    mode: 'deep-v3',
    // v3 specific fields
    confirmMode: 'manual',          // 'manual' | 'auto'
    analysisTasks: [],              // Brainstorm 产出的任务清单 [{id, title, description}]
    taskTree: [],                   // 完整任务树 TaskNode[]
    currentExecPath: [],            // 当前执行路径（nodeId 列表）
    executeResults: {},             // { [nodeId]: TaskNode 执行结果 }
    l1Summaries: {},                // { [nodeId]: string } L1 小结
    events: new EventEmitter(),
    _created: Date.now(),
  };
  sessions.set(id, session);
  return id;
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

export function removeSession(sessionId) {
  const s = sessions.get(sessionId);
  if (s) {
    s.events.removeAllListeners();
    sessions.delete(sessionId);
  }
}

export function pushSnapshot(session, markdown) {
  if (session.snapshots.length >= 5) {
    session.snapshots.shift();
  }
  session.snapshots.push(markdown);
}

export function popSnapshot(session) {
  if (session.snapshots.length === 0) return null;
  return session.snapshots.pop();
}

export function hasSnapshots(session) {
  return session.snapshots.length > 0;
}
