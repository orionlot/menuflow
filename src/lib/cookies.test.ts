import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COOKIE_REGISTRY,
  CONSENT_CATEGORIES,
  NON_NECESSARY,
  publicCookiesFor,
  parseConsent,
  hasConsent,
  defaultConsent,
  grantAll,
  serializeConsent,
  CONSENT_VERSION,
} from "./cookies";

const registeredNames = new Set(COOKIE_REGISTRY.map((c) => c.name));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("cookie registry integrity", () => {
  it("has unique names and valid categories", () => {
    const names = COOKIE_REGISTRY.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    const cats = new Set(CONSENT_CATEGORIES.map((c) => c.id));
    for (const c of COOKIE_REGISTRY) expect(cats.has(c.category)).toBe(true);
  });

  it("only 'necessari' is marked always-on", () => {
    for (const c of CONSENT_CATEGORIES) {
      expect(Boolean(c.sempre)).toBe(c.id === "necessari");
      expect(NON_NECESSARY.includes(c.id)).toBe(c.id !== "necessari");
    }
  });
});

describe("every cookie set in the source is registered", () => {
  // App cookies are mf_-prefixed by convention. Any `mf_…` literal anywhere in
  // the source must correspond to a registry entry — so a new cookie can't ship
  // without showing up in the consent banner.
  it("flags any unregistered mf_ cookie", () => {
    const files = walk(join(process.cwd(), "src"));
    const found = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/['"`](mf_[a-z0-9_]+)['"`]/g)) found.add(m[1]);
    }
    // Guard the guard: we must actually be finding the known cookies.
    expect(found.has("mf_consent")).toBe(true);
    expect(found.has("mf_tavolo")).toBe(true);
    const unregistered = [...found].filter((n) => !registeredNames.has(n));
    expect(unregistered, `unregistered cookies: ${unregistered.join(", ")}`).toEqual([]);
  });
});

describe("publicCookiesFor filters by tenant config", () => {
  it("hides feature/payment-gated cookies unless enabled, never dashboard cookies", () => {
    const base = publicCookiesFor({});
    const names = base.map((c) => c.name);
    expect(names).toContain("mf_consent");
    expect(names).toContain("mf_tavolo");
    expect(names).not.toContain("mf_ordini"); // tracking_ordine off
    expect(names).not.toContain("__stripe_mid"); // payments off
    expect(names).not.toContain("sb-"); // dashboard-only

    const withTracking = publicCookiesFor({ funzioni: { tracking_ordine: true } }).map((c) => c.name);
    expect(withTracking).toContain("mf_ordini");

    const withPay = publicCookiesFor({ pagamenti: true }).map((c) => c.name);
    expect(withPay).toContain("__stripe_mid");
    expect(withPay).toContain("__stripe_sid");
  });
});

describe("consent state", () => {
  it("defaults to deny for all non-necessary categories", () => {
    const d = defaultConsent();
    expect(hasConsent(d, "necessari")).toBe(true);
    expect(hasConsent(d, "funzionali")).toBe(false);
    expect(hasConsent(d, "statistiche")).toBe(false);
    expect(hasConsent(d, "marketing")).toBe(false);
  });

  it("treats a missing or malformed cookie as no-consent", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("not-json")).toBeNull();
    expect(hasConsent(parseConsent(undefined), "funzionali")).toBe(false);
  });

  it("re-asks when the consent version changes", () => {
    const stale = encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION + 1, funzionali: true }));
    expect(parseConsent(stale)).toBeNull();
  });

  it("round-trips a serialized consent", () => {
    const c = grantAll();
    const parsed = parseConsent(serializeConsent(c));
    expect(parsed).toEqual(c);
    expect(hasConsent(parsed, "funzionali")).toBe(true);
    expect(hasConsent(parsed, "marketing")).toBe(true);
  });
});
