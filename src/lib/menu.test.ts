import { describe, it, expect } from "vitest";
import {
  sanitizeOpzioni,
  sanitizeAggiunte,
  sanitizeItemPatch,
  sanitizeComposizione,
} from "@/lib/menu";

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
