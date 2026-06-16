import { describe, it, expect } from "vitest";
import { sanitizeUnita, UNITA_VALUES } from "./units";

describe("sanitizeUnita", () => {
  it("accepts whitelisted units", () => {
    for (const v of UNITA_VALUES) expect(sanitizeUnita(v)).toBe(v);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(sanitizeUnita("  kg  ")).toBe("kg");
  });

  it("rejects free text and arbitrary values", () => {
    expect(sanitizeUnita("scatoloni")).toBeNull();
    expect(sanitizeUnita("KG")).toBeNull(); // case-sensitive on purpose
    expect(sanitizeUnita("")).toBeNull();
  });

  it("returns null for non-strings", () => {
    expect(sanitizeUnita(null)).toBeNull();
    expect(sanitizeUnita(undefined)).toBeNull();
    expect(sanitizeUnita(42)).toBeNull();
  });
});
