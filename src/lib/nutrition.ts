import type { PublicIngredient, RicettaVoce } from "@/types/db";

/**
 * Nutrition math for the menu. Weight and calories both derive from GRAMS:
 *  - an ingredient carries `peso` (grams of one standard portion) and
 *    `kcal_per_100g` (a stable nutritional constant);
 *  - a dish recipe (`RicettaVoce[]`) carries the grams of each ingredient
 *    (falling back to the ingredient's `peso` when not specified).
 *
 * Dish weight = Σ grams; dish calories = Σ (grams / 100 × kcal_per_100g).
 * Pure module (usable on the server and in client components).
 */

/** The only ingredient fields the math needs. */
export type IngredientLite = Pick<PublicIngredient, "peso" | "kcal_per_100g">;

/** Grams of an ingredient used in a recipe entry: the explicit per-dish amount
 *  if set, else the ingredient's default portion weight (`peso`); null if neither. */
export function voceGrammi(grammi: number | null, ing: IngredientLite | undefined): number | null {
  if (grammi != null) return grammi;
  return ing?.peso ?? null;
}

/** Calories from grams + density (kcal per 100g). null when either is unknown. */
export function kcalDaGrammi(grammi: number | null, kcalPer100g: number | null | undefined): number | null {
  if (grammi == null || kcalPer100g == null) return null;
  return (grammi / 100) * kcalPer100g;
}

export interface DishNutrition {
  peso: number | null;
  /** true when `peso` is auto-computed from the recipe (an estimate), false when it's a manual override. */
  pesoStima: boolean;
  kcal: number | null;
  /** true when `kcal` is auto-computed from the recipe (an estimate), false when it's a manual override. */
  kcalStima: boolean;
}

/**
 * Weight + calories for a fixed-recipe dish. A manual override (`itemPeso` /
 * `itemKcal`) wins and is reported as exact (stima=false); otherwise the value
 * is summed from the recipe and reported as an estimate (stima=true). Ingredients
 * with missing data are skipped — the total is still returned (partial estimate).
 */
export function dishNutrition(
  recipe: RicettaVoce[] | null | undefined,
  lookup: (id: string) => IngredientLite | undefined,
  itemPeso: number | null,
  itemKcal: number | null,
): DishNutrition {
  let gTot = 0;
  let gAny = false;
  let kTot = 0;
  let kAny = false;
  for (const voce of recipe ?? []) {
    const ing = lookup(voce.id);
    const grammi = voceGrammi(voce.grammi, ing);
    if (grammi != null) {
      gTot += grammi;
      gAny = true;
    }
    const k = kcalDaGrammi(grammi, ing?.kcal_per_100g);
    if (k != null) {
      kTot += k;
      kAny = true;
    }
  }
  const autoPeso = gAny ? Math.round(gTot) : null;
  const autoKcal = kAny ? Math.round(kTot) : null;
  return {
    peso: itemPeso != null ? itemPeso : autoPeso,
    pesoStima: itemPeso == null && autoPeso != null,
    kcal: itemKcal != null ? itemKcal : autoKcal,
    kcalStima: itemKcal == null && autoKcal != null,
  };
}

/**
 * Live weight + calories for a composable selection: each chosen portion
 * contributes qta × ingredient.peso grams. Always an estimate.
 */
export function composedNutrition(
  composed: { ingredient_id: string; qta: number }[],
  lookup: (id: string) => IngredientLite | undefined,
): { peso: number | null; kcal: number | null } {
  let gTot = 0;
  let gAny = false;
  let kTot = 0;
  let kAny = false;
  for (const c of composed) {
    const ing = lookup(c.ingredient_id);
    const grammi = ing?.peso ?? null;
    if (grammi != null) {
      gTot += grammi * c.qta;
      gAny = true;
    }
    const k = kcalDaGrammi(grammi, ing?.kcal_per_100g);
    if (k != null) {
      kTot += k * c.qta;
      kAny = true;
    }
  }
  return { peso: gAny ? Math.round(gTot) : null, kcal: kAny ? Math.round(kTot) : null };
}
