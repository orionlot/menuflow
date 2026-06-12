import { describe, it, expect } from "vitest";
import { hitRateLimit } from "@/lib/ratelimit";

// No Upstash env in tests → exercises the in-memory fallback (deterministic).
describe("hitRateLimit", () => {
  it("allows up to max within the window then blocks", async () => {
    const key = "ratelimit-unit-test-key";
    expect(await hitRateLimit(key, 2, 10_000)).toBe(true);
    expect(await hitRateLimit(key, 2, 10_000)).toBe(true);
    expect(await hitRateLimit(key, 2, 10_000)).toBe(false);
  });
  it("keeps separate counters per key", async () => {
    expect(await hitRateLimit("ratelimit-unit-test-key-b", 1, 10_000)).toBe(true);
    expect(await hitRateLimit("ratelimit-unit-test-key-b", 1, 10_000)).toBe(false);
  });
});
