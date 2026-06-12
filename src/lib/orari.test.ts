import { describe, it, expect } from "vitest";
import { sanitizeOrari, orariLabel, isOpenNow } from "@/lib/orari";

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
