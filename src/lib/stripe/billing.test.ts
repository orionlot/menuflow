import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { planForPriceId, priceIdForPlan } from "@/lib/stripe/billing";

const SAVED = { ...process.env };
beforeEach(() => {
  process.env.STRIPE_PRICE_BASE = "price_base";
  process.env.STRIPE_PRICE_PLUS = "price_plus";
  process.env.STRIPE_PRICE_PRO = "price_pro";
});
afterEach(() => {
  process.env = { ...SAVED };
});

describe("planForPriceId", () => {
  it("maps each plan price id back to its PlanId", () => {
    expect(planForPriceId("price_base")).toBe("base");
    expect(planForPriceId("price_plus")).toBe("plus");
    expect(planForPriceId("price_pro")).toBe("pro");
  });
  it("returns null for unknown/missing ids (e.g. the multilingua add-on)", () => {
    expect(planForPriceId("price_multilingua")).toBeNull();
    expect(planForPriceId(null)).toBeNull();
    expect(planForPriceId(undefined)).toBeNull();
  });
  it("round-trips with priceIdForPlan", () => {
    expect(planForPriceId(priceIdForPlan("plus"))).toBe("plus");
  });
});
