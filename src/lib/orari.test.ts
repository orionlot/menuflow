import { describe, it, expect } from "vitest";
import {
  sanitizeOrari,
  orariLabel,
  isOpenNow,
  isServiceOpen,
  activeChiusura,
  sanitizeChiusure,
} from "@/lib/orari";

describe("sanitizeOrari", () => {
  it("returns null when not configured", () => {
    expect(sanitizeOrari(null)).toBeNull();
    expect(sanitizeOrari({ giorni: [] })).toBeNull();
    expect(sanitizeOrari("x")).toBeNull();
  });
  it("keeps valid days (0–6, deduped) and times", () => {
    expect(sanitizeOrari({ giorni: [1, 2, 2, 9, -1], da: "12:00", a: "23:00" })).toEqual({
      giorni: [1, 2],
      da: "12:00",
      a: "23:00",
    });
  });
  it("falls back to default times when invalid", () => {
    expect(sanitizeOrari({ giorni: [1], da: "x", a: "y" })).toEqual({
      giorni: [1],
      da: "12:00",
      a: "23:00",
    });
  });
});

describe("orariLabel", () => {
  it("is null when not configured", () => {
    expect(orariLabel(null)).toBeNull();
  });
  it("formats days + range", () => {
    expect(orariLabel({ giorni: [2, 1], da: "12:00", a: "15:00" })).toBe("Lun Mar 12:00–15:00");
  });
});

describe("isOpenNow", () => {
  it("is always open when not configured", () => {
    expect(isOpenNow(null)).toBe(true);
    expect(isOpenNow({ giorni: [], da: "12:00", a: "15:00" })).toBe(true);
  });
});

describe("isServiceOpen — precedence (override > closure > hours)", () => {
  const always = [{ da: "2000-01-01", a: "2099-12-31" }]; // a closure covering today
  it("manual 'aperto' override forces open, even during a closure", () => {
    expect(isServiceOpen({ aperto_override: true, chiusure: always })).toBe(true);
  });
  it("manual 'chiuso' override forces closed", () => {
    expect(isServiceOpen({ aperto_override: false })).toBe(false);
  });
  it("an active scheduled closure closes when on auto", () => {
    expect(isServiceOpen({ aperto_override: null, chiusure: always })).toBe(false);
  });
  it("auto + no hours + no closure = open", () => {
    expect(isServiceOpen({})).toBe(true);
  });
});

describe("activeChiusura", () => {
  it("matches a date inside a range (inclusive)", () => {
    const c = [{ da: "2026-01-01", a: "2026-01-07", motivo: "Ferie" }];
    expect(activeChiusura(c, "2026-01-05")?.motivo).toBe("Ferie");
    expect(activeChiusura(c, "2026-01-07")).not.toBeNull();
    expect(activeChiusura(c, "2026-01-08")).toBeNull();
  });
  it("treats a missing end as a single day", () => {
    expect(activeChiusura([{ da: "2026-12-25" }], "2026-12-25")).not.toBeNull();
    expect(activeChiusura([{ da: "2026-12-25" }], "2026-12-26")).toBeNull();
  });
});

describe("sanitizeChiusure", () => {
  it("keeps valid rows, drops invalid, caps the reason", () => {
    const out = sanitizeChiusure([
      { da: "2026-08-15", a: "2026-08-20", motivo: "  Ferragosto  " },
      { da: "2026-12-25" },
      { da: "not-a-date" },
      { a: "2026-01-01" }, // no start → dropped
      { da: "2026-03-10", a: "2026-03-01" }, // end < start → end dropped
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ da: "2026-08-15", a: "2026-08-20", motivo: "Ferragosto" });
    expect(out[1]).toEqual({ da: "2026-12-25" });
    expect(out[2]).toEqual({ da: "2026-03-10" });
  });
  it("ignores non-array input", () => {
    expect(sanitizeChiusure(null)).toEqual([]);
  });
});
