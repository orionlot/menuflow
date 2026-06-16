import { describe, it, expect } from "vitest";
import {
  sanitizeOpzioni,
  sanitizeAggiunte,
  sanitizeItemPatch,
  sanitizeComposizione,
  sanitizeReparti,
  sanitizeSale,
} from "@/lib/menu";

describe("sanitizeSale", () => {
  it("keeps room + table ids, clamps x/y to 0–100, keeps valid posti", () => {
    const out = sanitizeSale([
      { id: "sala-1", nome: "Interno", tavoli: [{ id: "tav-1", nome: "1", x: 150, y: -5, posti: 4 }] },
    ]);
    expect(out).toEqual([
      { id: "sala-1", nome: "Interno", tavoli: [{ id: "tav-1", nome: "1", x: 100, y: 0, posti: 4 }] },
    ]);
  });

  it("derives ids from names, drops nameless rooms/tables, defaults bad x/y to 50", () => {
    const out = sanitizeSale([
      { nome: "Dehors", tavoli: [{ nome: "A" }, { nome: "  " }] },
      { nome: "  " },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("dehors");
    expect(out[0].tavoli).toEqual([{ id: "a", nome: "A", x: 50, y: 50 }]);
  });

  it("ignores non-arrays and drops out-of-range posti", () => {
    expect(sanitizeSale("nope")).toEqual([]);
    const out = sanitizeSale([{ nome: "S", tavoli: [{ nome: "1", x: 10, y: 10, posti: 999 }] }]);
    expect(out[0].tavoli[0].posti).toBeUndefined();
  });

  it("keeps up to 5 trimmed notes, drops empties", () => {
    const out = sanitizeSale([
      { nome: "S", tavoli: [{ nome: "1", x: 0, y: 0, note: [" a ", "", "b", "c", "d", "e", "f"] }] },
    ]);
    expect(out[0].tavoli[0].note).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("folds a legacy single `nota` string into the note array", () => {
    const out = sanitizeSale([{ nome: "S", tavoli: [{ nome: "1", x: 0, y: 0, nota: "Riservato" }] }]);
    expect(out[0].tavoli[0].note).toEqual(["Riservato"]);
  });

  it("keeps valid table shapes and drops invalid/default ones", () => {
    const out = sanitizeSale([
      {
        nome: "S",
        tavoli: [
          { nome: "1", x: 0, y: 0, forma: "rotondo" },
          { nome: "2", x: 0, y: 0, forma: "rettangolare" },
          { nome: "3", x: 0, y: 0, forma: "quadrato" },
          { nome: "4", x: 0, y: 0, forma: "triangolo" },
        ],
      },
    ]);
    expect(out[0].tavoli.map((t) => t.forma)).toEqual(["rotondo", "rettangolare", undefined, undefined]);
  });
});

describe("sanitizeReparti", () => {
  it("keeps an existing id stable (so dish references don't break)", () => {
    const out = sanitizeReparti([{ id: "pizzeria", nome: "Pizzeria", colore: "#ef4444" }]);
    expect(out).toEqual([{ id: "pizzeria", nome: "Pizzeria", colore: "#ef4444" }]);
  });

  it("derives a slug id from the name when none is given", () => {
    const out = sanitizeReparti([{ nome: "Banco Sushi" }]);
    expect(out[0].id).toBe("banco-sushi");
    expect(out[0].nome).toBe("Banco Sushi");
  });

  it("de-duplicates generated ids", () => {
    const out = sanitizeReparti([{ nome: "Bar" }, { nome: "Bar" }]);
    expect(out.map((r) => r.id)).toEqual(["bar", "bar-2"]);
  });

  it("drops entries without a name and defaults a bad colour", () => {
    const out = sanitizeReparti([{ nome: "  " }, { nome: "Griglia", colore: "notacolor" }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ id: "griglia", nome: "Griglia", colore: "#64748b" });
  });

  it("ignores non-arrays and caps the list at 20", () => {
    expect(sanitizeReparti("nope")).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => ({ nome: `R${i}` }));
    expect(sanitizeReparti(many)).toHaveLength(20);
  });
});

describe("sanitizeOpzioni", () => {
  it("returns [] for non-arrays", () => {
    expect(sanitizeOpzioni("x")).toEqual([]);
    expect(sanitizeOpzioni(null)).toEqual([]);
  });
  it("normalises a valid group and drops empty/negative-priced choices", () => {
    expect(
      sanitizeOpzioni([
        {
          nome: "  Impasto  ",
          tipo: "single",
          obbligatorio: 1,
          scelte: [
            { nome: "Normale", prezzo: 0 },
            { nome: "", prezzo: 5 },
            { nome: "Integrale", prezzo: -2 },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "g0",
        nome: "Impasto",
        tipo: "single",
        obbligatorio: true,
        scelte: [
          { nome: "Normale", prezzo: 0 },
          { nome: "Integrale", prezzo: 0 },
        ],
      },
    ]);
  });
  it("defaults an unknown tipo to multi and drops groups without name or choices", () => {
    expect(sanitizeOpzioni([{ nome: "G", tipo: "weird", scelte: [{ nome: "A", prezzo: 1 }] }])[0].tipo).toBe(
      "multi",
    );
    expect(sanitizeOpzioni([{ nome: "", scelte: [{ nome: "A", prezzo: 1 }] }])).toEqual([]);
    expect(sanitizeOpzioni([{ nome: "G", scelte: [] }])).toEqual([]);
  });
});

describe("sanitizeAggiunte", () => {
  it("normalises categories and drops groups without categories", () => {
    expect(
      sanitizeAggiunte([
        { nome: "Extra", tipo: "multi", scelte: [{ nome: "Bacon", prezzo: 1 }], categorie: ["Pizze", " "] },
      ]),
    ).toEqual([
      {
        id: "a0",
        nome: "Extra",
        tipo: "multi",
        obbligatorio: false,
        scelte: [{ nome: "Bacon", prezzo: 1 }],
        categorie: ["Pizze"],
      },
    ]);
    expect(
      sanitizeAggiunte([{ nome: "X", scelte: [{ nome: "A", prezzo: 1 }], categorie: [] }]),
    ).toEqual([]);
  });
});

describe("sanitizeItemPatch", () => {
  it("trims/sizes strings and only keeps a non-negative price", () => {
    expect(sanitizeItemPatch({ nome: "  Pizza  ", prezzo: 8.5 })).toMatchObject({
      nome: "Pizza",
      prezzo: 8.5,
    });
    expect(sanitizeItemPatch({ prezzo: -3 }).prezzo).toBeUndefined();
  });
  it("normalises descrizione (empty → null) and only boolean disponibile", () => {
    expect(sanitizeItemPatch({ descrizione: "" }).descrizione).toBeNull();
    expect(sanitizeItemPatch({ descrizione: "Buona" }).descrizione).toBe("Buona");
    expect(sanitizeItemPatch({ disponibile: "yes" as unknown as boolean }).disponibile).toBeUndefined();
    expect(sanitizeItemPatch({ disponibile: false }).disponibile).toBe(false);
  });
  it("whitelists allergens to known ids", () => {
    expect(sanitizeItemPatch({ allergeni: ["glutine", "xxx", "latte"] }).allergeni).toEqual([
      "glutine",
      "latte",
    ]);
  });
  it("floors stock and supports clearing it with null", () => {
    expect(sanitizeItemPatch({ scorta: 3.9 }).scorta).toBe(3);
    expect(sanitizeItemPatch({ scorta: -2 }).scorta).toBe(0);
    expect(sanitizeItemPatch({ scorta: null }).scorta).toBeNull();
  });
});

describe("sanitizeComposizione", () => {
  it("returns [] for non-arrays", () => {
    expect(sanitizeComposizione(null)).toEqual([]);
    expect(sanitizeComposizione("x")).toEqual([]);
  });
  it("keeps a valid group, trims, drops empty ingredients/categories", () => {
    expect(
      sanitizeComposizione([
        {
          id: "g",
          nome: "  Proteine  ",
          categorie: ["Poke", ""],
          min: 1,
          max: 2,
          ingredienti: [
            { ingredient_id: "i1", prezzo: 2 },
            { ingredient_id: "", prezzo: 1 },
          ],
        },
        { nome: "NoCat", categorie: [], ingredienti: [{ ingredient_id: "x" }] },
        { nome: "", categorie: ["Poke"], ingredienti: [{ ingredient_id: "x" }] },
      ]),
    ).toEqual([
      {
        id: "g",
        nome: "Proteine",
        categorie: ["Poke"],
        min: 1,
        max: 2,
        ingredienti: [{ ingredient_id: "i1", prezzo: 2 }],
      },
    ]);
  });
  it("clamps min down to max and floors numbers", () => {
    const [g] = sanitizeComposizione([
      { nome: "G", categorie: ["C"], min: 9, max: 3, ingredienti: [{ ingredient_id: "i" }] },
    ]);
    expect(g.max).toBe(3);
    expect(g.min).toBe(3);
  });
});
