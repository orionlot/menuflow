import { describe, it, expect } from "vitest";
import { hitRateLimit } from "@/lib/ratelimit";

describe("hitRateLimit", () => {
  it("allows up to max within the window then blocks", () => {
    const key = "ratelimit-unit-test-key";
    expect(hitRateLimit(key, 2, 10_000)).toBe(true);
    expect(hitRateLimit(key, 2, 10_000)).toBe(true);
    expect(hitRateLimit(key, 2, 10_000)).toBe(false);
  });
  it("keeps separate counters per key", () => {
    expect(hitRateLimit("ratelimit-unit-test-key-b", 1, 10_000)).toBe(true);
    expect(hitRateLimit("ratelimit-unit-test-key-b", 1, 10_000)).toBe(false);
  });
});
