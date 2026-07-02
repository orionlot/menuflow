import { describe, it, expect } from "vitest";
import { allowedForRole, homeForRole, parseRuolo } from "@/lib/ruoli";

describe("parseRuolo", () => {
  it("accepts only the three known roles", () => {
    expect(parseRuolo("all")).toBe("all");
    expect(parseRuolo("cameriere")).toBe("cameriere");
    expect(parseRuolo("cuoco")).toBe("cuoco");
  });
  it("returns null for anything else", () => {
    expect(parseRuolo("admin")).toBeNull();
    expect(parseRuolo("")).toBeNull();
    expect(parseRuolo(undefined)).toBeNull();
    expect(parseRuolo(null)).toBeNull();
  });
});

describe("homeForRole", () => {
  it("maps each role to its home", () => {
    expect(homeForRole("all")).toBe("/dashboard");
    expect(homeForRole("cameriere")).toBe("/dashboard/sala");
    expect(homeForRole("cuoco")).toBe("/dashboard/cucina");
  });
});

describe("allowedForRole", () => {
  it("all sees everything", () => {
    for (const p of ["/dashboard", "/dashboard/menu", "/dashboard/cucina", "/dashboard/statistiche"]) {
      expect(allowedForRole(p, "all")).toBe(true);
    }
  });

  it("cameriere sees sala/ordini/conti/prenotazioni/stampa (and subpaths)", () => {
    for (const p of [
      "/dashboard/sala",
      "/dashboard/ordini",
      "/dashboard/conti",
      "/dashboard/prenotazioni",
      "/dashboard/stampa/abc-123",
    ]) {
      expect(allowedForRole(p, "cameriere")).toBe(true);
    }
  });

  it("cameriere is blocked from the rest", () => {
    for (const p of ["/dashboard", "/dashboard/menu", "/dashboard/cucina", "/dashboard/statistiche", "/dashboard/funzionalita"]) {
      expect(allowedForRole(p, "cameriere")).toBe(false);
    }
  });

  it("cuoco sees only the kitchen", () => {
    expect(allowedForRole("/dashboard/cucina", "cuoco")).toBe(true);
    for (const p of ["/dashboard", "/dashboard/sala", "/dashboard/ordini", "/dashboard/menu"]) {
      expect(allowedForRole(p, "cuoco")).toBe(false);
    }
  });

  it("login and the picker are reachable for every role and for no-cookie", () => {
    for (const r of ["all", "cameriere", "cuoco", null] as const) {
      expect(allowedForRole("/dashboard/login", r)).toBe(true);
      expect(allowedForRole("/dashboard/ruolo", r)).toBe(true);
    }
  });

  it("no cookie → everything else is blocked (forces the picker)", () => {
    for (const p of ["/dashboard", "/dashboard/ordini", "/dashboard/cucina"]) {
      expect(allowedForRole(p, null)).toBe(false);
    }
  });

  it("prefix matching is segment-safe", () => {
    // "/dashboard/ordini-x" must NOT match the "/dashboard/ordini" prefix.
    expect(allowedForRole("/dashboard/ordini-x", "cameriere")).toBe(false);
    expect(allowedForRole("/dashboard/cucinario", "cuoco")).toBe(false);
  });
});
