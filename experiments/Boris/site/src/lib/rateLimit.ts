// In-memory token bucket per IP + global concurrency.
// Single fly machine is the assumed deploy target; if we ever scale to >1
// machine, swap this for redis or move to fly's managed rate limiting.

type Bucket = { tokens: number; refilledAt: number };

const PER_IP_LIMIT = 5;
const PER_IP_WINDOW_MS = 60_000;
const GLOBAL_CONCURRENCY = 3;

const buckets = new Map<string, Bucket>();
let inFlight = 0;

export type RateCheck = { ok: true } | { ok: false; reason: string; status: number };

export function checkPerIp(ip: string): RateCheck {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    b = { tokens: PER_IP_LIMIT, refilledAt: now };
    buckets.set(ip, b);
  }
  if (now - b.refilledAt >= PER_IP_WINDOW_MS) {
    b.tokens = PER_IP_LIMIT;
    b.refilledAt = now;
  }
  if (b.tokens <= 0) {
    return {
      ok: false,
      reason: `IP 限流：每分钟最多 ${PER_IP_LIMIT} 次，请稍后再试`,
      status: 429
    };
  }
  b.tokens -= 1;
  return { ok: true };
}

export function tryAcquireGlobal(): RateCheck {
  if (inFlight >= GLOBAL_CONCURRENCY) {
    return {
      ok: false,
      reason: `服务繁忙：当前并发已达 ${GLOBAL_CONCURRENCY}，请稍后再试`,
      status: 503
    };
  }
  inFlight += 1;
  return { ok: true };
}

export function releaseGlobal(): void {
  inFlight = Math.max(0, inFlight - 1);
}

export async function withGlobalConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    releaseGlobal();
  }
}
