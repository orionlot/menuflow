import { describe, it, expect } from "vitest";
import {
  priceLines,
  priceComposizione,
  computeCopertoCents,
  computeManciaCents,
  type PricedItem,
  type IngredientInfo,
} from "@/lib/pricing-core";
import type { CategoryAddon, ComposizioneGruppo, ItemOption } from "@/types/db";

function item(over: Partial<PricedItem> = {}): PricedItem {
  return { id: "i1", nome: "Pizza", prezzo: 8, disponibile: true, categoria: "Pizze", ...over };
}

const impasto: ItemOption = {
  id: "g1",
  nome: "Impasto",
  tipo: "single",
  obbligatorio: false,
  scelte: [
    { nome: "Normale", prezzo: 0 },
    { nome: "Integrale", prezzo: 1.5 },
  ],
};

describe("priceLines", () => {
  it("prices a simple line and multiplies by quantity", () => {
    const r = priceLines([item()], [{ item_id: "i1", qta: 2 }]);
    expect(r.itemsTotaleCents).toBe(1600);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ item_id: "i1", nome: "Pizza", qta: 2, prezzo: 8 });
    expect(r.lines[0].opzioni).toBeUndefined();
  });

  it("adds option price deltas to the unit price", () => {
    const r = priceLines(
      [item({ opzioni: [impasto] })],
      [{ item_id: "i1", qta: 1, opzioni: [{ gruppo: "Impasto", scelta: "Integrale" }] }],
    );
    expect(r.itemsTotaleCents).toBe(950);
    expect(r.lines[0].prezzo).toBe(9.5);
    expect(r.lines[0].opzioni).toEqual([{ gruppo: "Impasto", scelta: "Integrale", prezzo: 1.5 }]);
  });

  it("applies category add-ons targeting the item's category", () => {
    const aggiunta: CategoryAddon = {
      id: "a1",
      nome: "Extra",
      tipo: "multi",
      obbligatorio: false,
      scelte: [{ nome: "Bacon", prezzo: 1 }],
      categorie: ["Pizze"],
    };
    const r = priceLines(
      [item()],
      [{ item_id: "i1", qta: 1, opzioni: [{ gruppo: "Extra", scelta: "Bacon" }] }],
      [aggiunta],
    );
    expect(r.itemsTotaleCents).toBe(900);
  });

  it("rejects an unknown option group", () => {
    expect(() =>
      priceLines(
        [item({ opzioni: [impasto] })],
        [{ item_id: "i1", qta: 1, opzioni: [{ gruppo: "Salsa", scelta: "X" }] }],
      ),
    ).toThrow(/Opzione non valida/);
  });

  it("rejects an unknown choice within a valid group", () => {
    expect(() =>
      priceLines(
        [item({ opzioni: [impasto] })],
        [{ item_id: "i1", qta: 1, opzioni: [{ gruppo: "Impasto", scelta: "Boh" }] }],
      ),
    ).toThrow(/Scelta non valida/);
  });

  it("rejects more than one choice in a single-select group", () => {
    expect(() =>
      priceLines([item({ opzioni: [impasto] })], [
        {
          item_id: "i1",
          qta: 1,
          opzioni: [
            { gruppo: "Impasto", scelta: "Normale" },
            { gruppo: "Impasto", scelta: "Integrale" },
          ],
        },
      ]),
    ).toThrow(/Una sola scelta/);
  });

  it("requires a mandatory group to be chosen", () => {
    const req: ItemOption = { ...impasto, obbligatorio: true };
    expect(() => priceLines([item({ opzioni: [req] })], [{ item_id: "i1", qta: 1 }])).toThrow(
      /Selezione richiesta/,
    );
  });

  it("rejects sold-out items", () => {
    expect(() => priceLines([item({ disponibile: false })], [{ item_id: "i1", qta: 1 }])).toThrow(
      /Voce esaurita/,
    );
  });

  it("rejects items not on the menu", () => {
    expect(() => priceLines([item()], [{ item_id: "ghost", qta: 1 }])).toThrow(/Voce non trovata/);
  });

  it("rejects invalid quantities", () => {
    expect(() => priceLines([item()], [{ item_id: "i1", qta: 0 }])).toThrow(/Quantità non valida/);
    expect(() => priceLines([item()], [{ item_id: "i1", qta: 100 }])).toThrow(/Quantità non valida/);
  });

  it("enforces stock only when asked", () => {
    expect(() =>
      priceLines([item({ scorta: 1 })], [{ item_id: "i1", qta: 2 }], [], { enforceScorte: true }),
    ).toThrow(/Scorte insufficienti.*restano 1/);
    expect(() =>
      priceLines([item({ scorta: 0 })], [{ item_id: "i1", qta: 1 }], [], { enforceScorte: true }),
    ).toThrow(/Voce esaurita/);
    // Not enforced → stock is ignored.
    expect(priceLines([item({ scorta: 1 })], [{ item_id: "i1", qta: 5 }]).itemsTotaleCents).toBe(4000);
  });

  it("throws on an empty cart", () => {
    expect(() => priceLines([item()], [])).toThrow(/Carrello vuoto/);
  });

  it("sums multiple lines", () => {
    const r = priceLines(
      [item(), item({ id: "i2", nome: "Birra", prezzo: 5 })],
      [
        { item_id: "i1", qta: 1 },
        { item_id: "i2", qta: 2 },
      ],
    );
    expect(r.itemsTotaleCents).toBe(800 + 1000);
    expect(r.lines).toHaveLength(2);
  });
});

describe("computeCopertoCents", () => {
  it("is 0 for 'nessuno' / unknown / null modes", () => {
    expect(computeCopertoCents("nessuno", 2, 3, 2000)).toBe(0);
    expect(computeCopertoCents(null, 2, 3, 2000)).toBe(0);
    expect(computeCopertoCents("boh", 2, 3, 2000)).toBe(0);
  });
  it("multiplies a fixed amount by covers for 'persona'", () => {
    expect(computeCopertoCents("persona", 2, 3, 2000)).toBe(600);
  });
  it("charges a fixed amount once for 'ordine'", () => {
    expect(computeCopertoCents("ordine", 2, 3, 2000)).toBe(200);
  });
  it("charges a percentage of the subtotal for 'servizio'", () => {
    expect(computeCopertoCents("servizio", 10, 0, 2000)).toBe(200);
  });
  it("clamps negative amounts to 0", () => {
    expect(computeCopertoCents("ordine", -5, 0, 0)).toBe(0);
  });
});

describe("computeManciaCents", () => {
  it("is 0 unless payments AND tips are both enabled", () => {
    expect(computeManciaCents(false, true, 5)).toBe(0);
    expect(computeManciaCents(true, false, 5)).toBe(0);
  });
  it("converts euros to cents when enabled", () => {
    expect(computeManciaCents(true, true, 2.5)).toBe(250);
  });
  it("ignores non-positive or invalid input", () => {
    expect(computeManciaCents(true, true, 0)).toBe(0);
    expect(computeManciaCents(true, true, -3)).toBe(0);
    expect(computeManciaCents(true, true, undefined)).toBe(0);
    expect(computeManciaCents(true, true, "x")).toBe(0);
  });
  it("caps the tip at €1000", () => {
    expect(computeManciaCents(true, true, 99999)).toBe(100000);
  });
});

const GRUPPI: ComposizioneGruppo[] = [
  {
    id: "prot",
    nome: "Proteine",
    categorie: ["Poke"],
    min: 1,
    max: 2,
    ingredienti: [{ ingredient_id: "tonno" }, { ingredient_id: "salmone", prezzo: 1.5 }],
  },
  { id: "base", nome: "Base", categorie: ["Poke"], min: 1, max: 1, ingredienti: [{ ingredient_id: "riso" }] },
];
const ING = (): Map<string, IngredientInfo> =>
  new Map([
    ["tonno", { nome: "Tonno", prezzo: 2, scorta: 3 }],
    ["salmone", { nome: "Salmone", prezzo: 1, scorta: null }],
    ["riso", { nome: "Riso", prezzo: 0, scorta: null }],
  ]);

describe("priceComposizione", () => {
  it("prices chosen ingredients and returns lines", () => {
    const r = priceComposizione("Poke", GRUPPI, ING(), [
      { ingredient_id: "tonno", qta: 2 },
      { ingredient_id: "riso", qta: 1 },
    ]);
    expect(r.deltaCents).toBe(400); // 2 × €2
    expect(r.lines).toEqual([
      { ingredient_id: "tonno", nome: "Tonno", qta: 2, prezzo: 2 },
      { ingredient_id: "riso", nome: "Riso", qta: 1, prezzo: 0 },
    ]);
  });
  it("uses the group's price override over the ingredient price", () => {
    const r = priceComposizione("Poke", GRUPPI, ING(), [
      { ingredient_id: "salmone", qta: 1 },
      { ingredient_id: "riso", qta: 1 },
    ]);
    expect(r.deltaCents).toBe(150); // override 1.5, not ingredient 1
  });
  it("rejects quantity over the ingredient stock", () => {
    expect(() =>
      priceComposizione("Poke", GRUPPI, ING(), [
        { ingredient_id: "tonno", qta: 4 },
        { ingredient_id: "riso", qta: 1 },
      ]),
    ).toThrow(/Scorte insufficienti.*restano 3/);
  });
  it("rejects a sold-out ingredient", () => {
    const ing = ING();
    ing.set("tonno", { nome: "Tonno", prezzo: 2, scorta: 0 });
    expect(() =>
      priceComposizione("Poke", GRUPPI, ing, [
        { ingredient_id: "tonno", qta: 1 },
        { ingredient_id: "riso", qta: 1 },
      ]),
    ).toThrow(/esaurito/i);
  });
  it("rejects an ingredient not in any group for the category", () => {
    expect(() =>
      priceComposizione("Poke", GRUPPI, ING(), [
        { ingredient_id: "ghost", qta: 1 },
        { ingredient_id: "riso", qta: 1 },
      ]),
    ).toThrow(/non valido/);
  });
  it("enforces group max and min", () => {
    expect(() =>
      priceComposizione("Poke", GRUPPI, ING(), [
        { ingredient_id: "tonno", qta: 2 },
        { ingredient_id: "salmone", qta: 1 },
        { ingredient_id: "riso", qta: 1 },
      ]),
    ).toThrow(/Massimo 2/);
    expect(() => priceComposizione("Poke", GRUPPI, ING(), [{ ingredient_id: "riso", qta: 1 }])).toThrow(
      /almeno 1/,
    );
  });
});

describe("priceLines + composizione", () => {
  it("adds the composition delta to the unit price and attaches the lines", () => {
    const r = priceLines(
      [item({ id: "poke", nome: "Poke", categoria: "Poke", prezzo: 9 })],
      [
        {
          item_id: "poke",
          qta: 1,
          composizione: [
            { ingredient_id: "tonno", qta: 2 },
            { ingredient_id: "riso", qta: 1 },
          ],
        },
      ],
      [],
      {},
      GRUPPI,
      ING(),
    );
    expect(r.itemsTotaleCents).toBe(900 + 400);
    expect(r.lines[0].composizione).toEqual([
      { ingredient_id: "tonno", nome: "Tonno", qta: 2, prezzo: 2 },
      { ingredient_id: "riso", nome: "Riso", qta: 1, prezzo: 0 },
    ]);
  });
});
