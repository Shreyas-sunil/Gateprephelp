/**
 * Simple sliding-window limiter kept in memory. On serverless hosts each instance has its own
 * window, so this is a guard against accidental loops, not a hard quota.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): { ok: boolean; retryAfter: number } {
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - list[0]!)) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return { ok: true, retryAfter: 0 };
}
