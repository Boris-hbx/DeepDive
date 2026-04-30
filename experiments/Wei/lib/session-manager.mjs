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

export function createSession({ topic, domain, timeRange }) {
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
    analysisDoc: '',
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
