import { describe, it, expect } from "vitest";
import { parseCsv, rowsToItemPatches } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("handles quotes, embedded commas and escaped quotes", () => {
    expect(parseCsv('a,b\n"x,y","z""z"')).toEqual([
      ["a", "b"],
      ["x,y", 'z"z'],
    ]);
  });
  it("supports the ; separator", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("ignores blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("rowsToItemPatches", () => {
  it("maps the header and skips rows without name or category", () => {
    const rows = parseCsv(
      "categoria,nome,prezzo,disponibile,allergeni\n" +
        "Pizze,Margherita,7.00,si,glutine|latte\n" +
        ",SoloNome,5,si,\n" +
        "Primi,,5,si,",
    );
    const { patches, skipped } = rowsToItemPatches(rows);
    expect(skipped).toBe(2);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      nome: "Margherita",
      categoria: "Pizze",
      prezzo: 7,
      disponibile: true,
      allergeni: ["glutine", "latte"],
    });
  });
  it("parses comma decimals and 'no' availability, drops unknown allergens", () => {
    const rows = parseCsv('categoria,nome,prezzo,disponibile,allergeni\nX,Y,"8,50",no,glutine|xxx');
    const { patches } = rowsToItemPatches(rows);
    expect(patches[0].prezzo).toBe(8.5);
    expect(patches[0].disponibile).toBe(false);
    expect(patches[0].allergeni).toEqual(["glutine"]);
  });
});
