import {
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  isRateLimitStoreConfigured,
} from "@/lib/env";

/**
 * Rate limiter for public endpoints (signup, orders, service calls, votes).
 * Returns true if the call is ALLOWED.
 *
 * - When Upstash Redis REST is configured (UPSTASH_REDIS_REST_URL/TOKEN) the
 *   counter is shared across ALL serverless instances — the correct behaviour on
 *   Vercel, where an in-memory map would reset on every cold start and never see
 *   the other instances' traffic.
 * - Otherwise it falls back to a per-instance in-memory sliding window — fine for
 *   local dev / a single instance, best-effort under horizontal scale.
 * - If the store is configured but unreachable, it degrades to the in-memory
 *   window rather than blocking everyone just because Redis is down.
 */

// ── In-memory sliding window (fallback / local) ──────────────────────────────
const buckets = new Map<string, number[]>();

function inMemoryHit(key: string, max: number, windowMs: number): boolean {
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

// ── Distributed fixed window (Upstash Redis REST) ────────────────────────────
// Atomic: INCR the window key, and set its TTL only on the first hit so the
// counter resets after `windowMs`. One round-trip, no race between INCR/EXPIRE.
const LUA =
  "local c=redis.call('INCR',KEYS[1]) if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end return c";

async function redisHit(key: string, max: number, windowMs: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / windowMs);
  const rkey = `rl:${key}:${bucket}`;
  const res = await fetch(UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["EVAL", LUA, "1", rkey, String(windowMs)]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const json = (await res.json()) as { result?: number; error?: string };
  if (json.error) throw new Error(json.error);
  return Number(json.result ?? 0) <= max;
}

export async function hitRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  if (isRateLimitStoreConfigured()) {
    try {
      return await redisHit(key, max, windowMs);
    } catch {
      // Store unreachable → degrade to the in-memory window, don't block traffic.
      return inMemoryHit(key, max, windowMs);
    }
  }
  return inMemoryHit(key, max, windowMs);
}

/**
 * Best-effort client IP for rate-limit keying. Uses the LEFTMOST `x-forwarded-for`
 * hop (the original client; on Vercel this header is set by the platform), else
 * `x-real-ip`, else "anon". Taking only the first hop — instead of the whole
 * header string — stops a varying multi-proxy chain from minting a fresh bucket
 * per request. Accepts any Headers-like object (Request.headers or next/headers).
 */
export function clientIp(h: { get(name: string): string | null }): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip")?.trim() || "anon";
}
