import { describe, it, expect } from "vitest";
import { addLoad, capienzaFor, effectivePrep, waitMinutes, type RepartoLoad } from "@/lib/attesa";
import type { Reparto } from "@/types/db";

describe("effectivePrep", () => {
  it("prefers the item's own time", () => {
    expect(effectivePrep(12, "Pizze", { Pizze: 8 })).toBe(12);
  });
  it("falls back to the category average", () => {
    expect(effectivePrep(null, "Antipasti", { Antipasti: 10 })).toBe(10);
    expect(effectivePrep(0, "Antipasti", { Antipasti: 10 })).toBe(10);
  });
  it("is 0 when neither is set", () => {
    expect(effectivePrep(null, "X", {})).toBe(0);
    expect(effectivePrep(null, null, null)).toBe(0);
  });
});

describe("capienzaFor", () => {
  const reparti: Reparto[] = [{ id: "pizze", nome: "Pizze", capienza: 3 }];
  it("uses the reparto's own capacity", () => {
    expect(capienzaFor("pizze", reparti, 1)).toBe(3);
  });
  it("falls back to the kitchen default for unknown/unassigned stations", () => {
    expect(capienzaFor("", reparti, 2)).toBe(2);
    expect(capienzaFor("griglia", reparti, 2)).toBe(2);
  });
  it("never returns below 1", () => {
    expect(capienzaFor("", [], null)).toBe(1);
    expect(capienzaFor("", [], 0)).toBe(1);
  });
});

describe("waitMinutes — parallel batching", () => {
  it("is 0 for an empty kitchen", () => {
    expect(waitMinutes({})).toBe(0);
  });
  it("the pizzeria example: 3 ovens, 20-min pizzas", () => {
    // 3 pizzas fit one wave → 20 min; the 4th needs a second wave → 40.
    expect(waitMinutes({ pizze: { count: 3, prep: 20, capienza: 3 } })).toBe(20);
    expect(waitMinutes({ pizze: { count: 4, prep: 20, capienza: 3 } })).toBe(40);
    expect(waitMinutes({ pizze: { count: 6, prep: 20, capienza: 3 } })).toBe(40);
    expect(waitMinutes({ pizze: { count: 7, prep: 20, capienza: 3 } })).toBe(60);
  });
  it("takes the slowest station (parallel stations)", () => {
    const loads: Record<string, RepartoLoad> = {
      pizze: { count: 4, prep: 20, capienza: 3 }, // 40
      fritti: { count: 2, prep: 8, capienza: 5 }, // 8
    };
    expect(waitMinutes(loads)).toBe(40);
  });
  it("ignores stations with no prep estimate", () => {
    expect(waitMinutes({ x: { count: 5, prep: 0, capienza: 1 } })).toBe(0);
  });
});

describe("addLoad", () => {
  it("merges quantity and keeps the slowest dish as the batch time", () => {
    const loads: Record<string, RepartoLoad> = {};
    addLoad(loads, "pizze", 2, 20, 3);
    addLoad(loads, "pizze", 1, 25, 3);
    expect(loads.pizze).toEqual({ count: 3, prep: 25, capienza: 3 });
  });
  it("skips zero quantity or zero prep", () => {
    const loads: Record<string, RepartoLoad> = {};
    addLoad(loads, "pizze", 0, 20, 3);
    addLoad(loads, "pizze", 2, 0, 3);
    expect(loads).toEqual({});
  });
});
