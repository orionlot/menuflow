import { describe, it, expect } from "vitest";
import { voceGrammi, kcalDaGrammi, dishNutrition, composedNutrition, type IngredientLite } from "./nutrition";

const ING: Record<string, IngredientLite> = {
  pomodoro: { peso: 80, kcal_per_100g: 18 }, // 80g → 14.4 kcal
  mozzarella: { peso: 100, kcal_per_100g: 280 }, // 100g → 280 kcal
  basilico: { peso: 5, kcal_per_100g: 23 }, // 5g → 1.15 kcal
  acqua: { peso: null, kcal_per_100g: null }, // no data
};
const lookup = (id: string) => ING[id];

describe("voceGrammi", () => {
  it("uses the explicit grams when set", () => {
    expect(voceGrammi(120, ING.pomodoro)).toBe(120);
  });
  it("falls back to the ingredient default portion when grams unset", () => {
    expect(voceGrammi(null, ING.pomodoro)).toBe(80);
  });
  it("is null when neither grams nor a default exist", () => {
    expect(voceGrammi(null, ING.acqua)).toBeNull();
    expect(voceGrammi(null, undefined)).toBeNull();
  });
});

describe("kcalDaGrammi", () => {
  it("computes grams/100 × kcal_per_100g", () => {
    expect(kcalDaGrammi(100, 280)).toBe(280);
    expect(kcalDaGrammi(50, 280)).toBe(140);
    expect(kcalDaGrammi(80, 18)).toBeCloseTo(14.4);
  });
  it("is null when grams or density is missing", () => {
    expect(kcalDaGrammi(null, 280)).toBeNull();
    expect(kcalDaGrammi(100, null)).toBeNull();
  });
});

describe("dishNutrition", () => {
  it("sums weight and calories from the recipe (estimate)", () => {
    // pomodoro 80g (default) + mozzarella 100g + basilico 5g
    const n = dishNutrition(
      [{ id: "pomodoro", grammi: null }, { id: "mozzarella", grammi: null }, { id: "basilico", grammi: null }],
      lookup,
      null,
      null,
    );
    expect(n.peso).toBe(185); // 80 + 100 + 5
    expect(n.pesoStima).toBe(true);
    expect(n.kcal).toBe(296); // round(14.4 + 280 + 1.15) = 296
    expect(n.kcalStima).toBe(true);
  });

  it("honors per-dish grams over the ingredient default", () => {
    const n = dishNutrition([{ id: "mozzarella", grammi: 50 }], lookup, null, null);
    expect(n.peso).toBe(50);
    expect(n.kcal).toBe(140); // 50/100 × 280
  });

  it("a manual override wins and is reported as exact (not an estimate)", () => {
    const n = dishNutrition([{ id: "mozzarella", grammi: null }], lookup, 250, 500);
    expect(n.peso).toBe(250);
    expect(n.pesoStima).toBe(false);
    expect(n.kcal).toBe(500);
    expect(n.kcalStima).toBe(false);
  });

  it("returns a partial estimate, skipping ingredients with missing data", () => {
    const n = dishNutrition(
      [{ id: "mozzarella", grammi: null }, { id: "acqua", grammi: null }],
      lookup,
      null,
      null,
    );
    expect(n.peso).toBe(100); // only mozzarella contributes
    expect(n.kcal).toBe(280);
    expect(n.kcalStima).toBe(true);
  });

  it("is null/false when the recipe is empty or all-unknown", () => {
    expect(dishNutrition([], lookup, null, null)).toEqual({ peso: null, pesoStima: false, kcal: null, kcalStima: false });
    const n = dishNutrition([{ id: "acqua", grammi: null }], lookup, null, null);
    expect(n.peso).toBeNull();
    expect(n.kcal).toBeNull();
  });
});

describe("composedNutrition", () => {
  it("scales each chosen portion by qta", () => {
    // 2× mozzarella (100g each) + 3× pomodoro (80g each)
    const n = composedNutrition(
      [{ ingredient_id: "mozzarella", qta: 2 }, { ingredient_id: "pomodoro", qta: 3 }],
      lookup,
    );
    expect(n.peso).toBe(440); // 200 + 240
    expect(n.kcal).toBe(603); // round(560 + 43.2)
  });
  it("is null when nothing has data", () => {
    expect(composedNutrition([{ ingredient_id: "acqua", qta: 2 }], lookup)).toEqual({ peso: null, kcal: null });
  });
});
