import { describe, it, expect } from "vitest";
import {
  planAllows,
  isEntitled,
  isFeatureOn,
  funzioniAttive,
  sanitizeFunzionalita,
} from "@/lib/config/features";

describe("planAllows", () => {
  it("includes base features for every plan", () => {
    expect(planAllows("base", "piatto_consigliato")).toBe(true);
    expect(planAllows("pro", "stampa")).toBe(true);
  });
  it("gates plus-only features below plus", () => {
    expect(planAllows("base", "feedback")).toBe(false);
    expect(planAllows("plus", "feedback")).toBe(true);
    expect(planAllows("pro", "scorte")).toBe(true);
  });
});

describe("isEntitled", () => {
  it("follows the plan by default", () => {
    expect(isEntitled({ piano: "base" }, "feedback")).toBe(false);
    expect(isEntitled({ piano: "plus" }, "feedback")).toBe(true);
  });
  it("lets an admin override grant above the plan", () => {
    expect(isEntitled({ piano: "base", funzionalita_admin: { feedback: true } }, "feedback")).toBe(
      true,
    );
  });
  it("lets an admin override revoke a plan default", () => {
    expect(isEntitled({ piano: "pro", funzionalita_admin: { stampa: false } }, "stampa")).toBe(
      false,
    );
  });
});

describe("isFeatureOn", () => {
  it("is off when not entitled, even if the owner switched it on", () => {
    expect(isFeatureOn({ piano: "base", funzionalita: { feedback: true } }, "feedback")).toBe(false);
  });
  it("respects the owner switch when entitled", () => {
    expect(isFeatureOn({ piano: "plus", funzionalita: { feedback: true } }, "feedback")).toBe(true);
    expect(isFeatureOn({ piano: "plus", funzionalita: { feedback: false } }, "feedback")).toBe(false);
  });
  it("falls back to the feature's defaultOn when the owner hasn't chosen", () => {
    expect(isFeatureOn({ piano: "base" }, "piatto_consigliato")).toBe(true); // defaultOn
    expect(isFeatureOn({ piano: "base" }, "recensioni")).toBe(false); // default off
  });
});

describe("funzioniAttive", () => {
  it("returns every feature id with a boolean", () => {
    const m = funzioniAttive({ piano: "base" });
    expect(Object.keys(m).sort()).toEqual(
      [
        "asporto",
        "componibili",
        "descrizione",
        "etichette",
        "fasce_orarie",
        "feedback",
        "ingredienti",
        "orari",
        "piatto_consigliato",
        "prezzo_asporto",
        "profilo_allergie",
        "recensioni",
        "reparto",
        "riepilogo",
        "scorte",
        "stampa",
      ].sort(),
    );
    expect(m.piatto_consigliato).toBe(true);
    expect(m.stampa).toBe(true);
    expect(m.feedback).toBe(false); // plus-only, base tenant
  });
});

describe("sanitizeFunzionalita", () => {
  it("keeps only known ids with boolean values", () => {
    expect(
      sanitizeFunzionalita({
        piatto_consigliato: true,
        recensioni: "yes",
        feedback: false,
        bogus: true,
      }),
    ).toEqual({ piatto_consigliato: true, feedback: false });
  });
  it("returns an empty object for non-objects", () => {
    expect(sanitizeFunzionalita(null)).toEqual({});
    expect(sanitizeFunzionalita("x")).toEqual({});
  });
});
