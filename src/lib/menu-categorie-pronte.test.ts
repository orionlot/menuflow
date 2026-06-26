import { describe, it, expect } from "vitest";
import { markCategoriePronte, sanitizeCategoriePronte } from "@/lib/menu";

const NOW = "2026-06-25T12:00:00.000Z";
type L = {
  item_id: string;
  nome: string;
  a_seguire?: boolean;
  preparazione_at?: string | null;
  pronto_at?: string | null;
};
const lines: L[] = [
  { item_id: "a", nome: "Antipasto" },
  { item_id: "w", nome: "Acqua" },
  { item_id: "h", nome: "Vino", a_seguire: true },
];
const cat: Record<string, string> = { a: "Antipasti", w: "Bevande", h: "Bevande" };

describe("markCategoriePronte", () => {
  it("stamps preparazione_at + pronto_at only for items in a ready category", () => {
    const out = markCategoriePronte(lines, cat, ["Bevande"], NOW);
    expect(out[0]).toEqual(lines[0]); // Antipasto untouched
    expect(out[1].pronto_at).toBe(NOW);
    expect(out[1].preparazione_at).toBe(NOW);
  });

  it("never auto-readies held (a_seguire) lines even if their category is ready", () => {
    const out = markCategoriePronte(lines, cat, ["Bevande"], NOW);
    expect(out[2].pronto_at).toBeUndefined();
    expect(out[2].preparazione_at).toBeUndefined();
  });

  it("is a no-op when the list is empty", () => {
    expect(markCategoriePronte(lines, cat, [], NOW)).toBe(lines);
  });

  it("ignores items whose category is unknown / not in the list", () => {
    const out = markCategoriePronte(lines, {}, ["Bevande"], NOW);
    expect(out.every((l, i) => l.pronto_at === lines[i].pronto_at)).toBe(true);
  });
});

describe("sanitizeCategoriePronte", () => {
  it("trims, de-duplicates and drops empties", () => {
    expect(sanitizeCategoriePronte(["Bevande", " Bevande ", "", "Birre"])).toEqual(["Bevande", "Birre"]);
  });
  it("returns [] for non-arrays", () => {
    expect(sanitizeCategoriePronte("x")).toEqual([]);
    expect(sanitizeCategoriePronte(null)).toEqual([]);
  });
});
