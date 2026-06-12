/**
 * Best-effort in-memory rate limiter (per server instance). Not a substitute for
 * a distributed limiter (Upstash/Vercel) in a multi-instance deploy, but it
 * blunts abuse of public endpoints (signup, orders, service calls) with zero
 * dependencies. Returns true if the call is ALLOWED.
 */
const buckets = new Map<string, number[]>();

export function hitRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return true;
}
