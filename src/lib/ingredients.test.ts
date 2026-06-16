import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/types/db";
import { decrementIngredientStock, composableCategories } from "./ingredients";

/** Minimal stub of the bits of the admin client decrementIngredientStock uses:
 *  `from("menu_items").select(...).in("id", ids)` and `rpc("consume_ingredient")`. */
function stubAdmin(
  menuRows: {
    id: string;
    categoria: string;
    ingredienti: string[] | null;
    composizione?: unknown[];
  }[],
) {
  const rpcCalls: { p_id: string; p_n: number }[] = [];
  const inCalls: string[][] = [];
  const admin = {
    rpc: (_name: string, args: { p_id: string; p_n: number }) => {
      rpcCalls.push(args);
      return Promise.resolve({ data: null, error: null });
    },
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          inCalls.push(ids);
          return Promise.resolve({
            data: menuRows.filter((r) => ids.includes(r.id)),
            error: null,
          });
        },
      }),
    }),
  } as unknown as SupabaseClient;
  const consumed = () => Object.fromEntries(rpcCalls.map((c) => [c.p_id, c.p_n]));
  return { admin, rpcCalls, inCalls, consumed };
}

const line = (over: Partial<OrderItem>): OrderItem => ({
  item_id: "x",
  nome: "X",
  qta: 1,
  prezzo: 1,
  ...over,
});

describe("composableCategories", () => {
  it("is empty when componibili is off, even with groups", () => {
    expect(composableCategories([{ categorie: ["Poke"] }], false)).toEqual([]);
  });
  it("dedupes the union of group categories when componibili is on", () => {
    expect(
      composableCategories([{ categorie: ["Poke"] }, { categorie: ["Poke", "Bowl"] }], true).sort(),
    ).toEqual(["Bowl", "Poke"]);
  });
  it("tolerates null/undefined groups", () => {
    expect(composableCategories(null, true)).toEqual([]);
  });
});

describe("decrementIngredientStock — composizione (composable)", () => {
  it("aggregates per-ingredient qty × line qty and skips the menu_items fetch", async () => {
    const { admin, consumed, inCalls } = stubAdmin([]);
    await decrementIngredientStock(
      admin,
      [
        line({
          item_id: "poke",
          qta: 2,
          composizione: [
            { ingredient_id: "tonno", nome: "Tonno", qta: 2, prezzo: 2 },
            { ingredient_id: "riso", nome: "Riso", qta: 1, prezzo: 0 },
          ],
        }),
      ],
      { composizione: true },
    );
    // tonno: 2 per unit × 2 units = 4; riso: 1 × 2 = 2
    expect(consumed()).toEqual({ tonno: 4, riso: 2 });
    // no simple-ingredient pass requested → no menu_items query
    expect(inCalls).toHaveLength(0);
  });
});

describe("decrementIngredientStock — ingredienti (simple)", () => {
  it("consumes each listed ingredient once per product unit", async () => {
    const { admin, consumed } = stubAdmin([
      { id: "pizza", categoria: "Pizze", ingredienti: ["pomodoro", "mozzarella"] },
    ]);
    await decrementIngredientStock(
      admin,
      [line({ item_id: "pizza", qta: 3 })],
      { ingredienti: true },
      [], // no composable categories
    );
    expect(consumed()).toEqual({ pomodoro: 3, mozzarella: 3 });
  });

  it("does NOT double-count: a composable-category item consumes only via composition", async () => {
    // poke is composable AND (hypothetically) has an ingredienti list — must
    // only decrement via composition, never via the display list.
    const { admin, consumed } = stubAdmin([
      { id: "poke", categoria: "Poke", ingredienti: ["tonno"] },
    ]);
    await decrementIngredientStock(
      admin,
      [
        line({
          item_id: "poke",
          qta: 1,
          composizione: [{ ingredient_id: "tonno", nome: "Tonno", qta: 1, prezzo: 2 }],
        }),
      ],
      { composizione: true, ingredienti: true },
      ["Poke"], // poke's category is composable
    );
    // tonno consumed exactly once (via composition), not twice
    expect(consumed()).toEqual({ tonno: 1 });
  });

  it("REGRESSION: config drift — a line with a frozen composizione never also consumes its display list, even if its category left the composable set", async () => {
    // Case B window: order priced as composable (frozen composizione), then the
    // owner removed the category from composition before the webhook fired, so
    // the live composable set no longer contains it. Must still consume once.
    const { admin, consumed } = stubAdmin([
      { id: "poke", categoria: "Poke", ingredienti: ["tonno"] },
    ]);
    await decrementIngredientStock(
      admin,
      [
        line({
          item_id: "poke",
          qta: 1,
          composizione: [{ ingredient_id: "tonno", nome: "Tonno", qta: 1, prezzo: 2 }],
        }),
      ],
      { composizione: true, ingredienti: true },
      [], // composable set no longer contains "Poke"
    );
    expect(consumed()).toEqual({ tonno: 1 });
  });

  it("REGRESSION: a PER-ITEM composable product (own groups) is not also decremented via its display list", async () => {
    // Item not in a composable category, but composable via its own groups, with
    // an empty chosen composition → must NOT consume its display `ingredienti`.
    const { admin, consumed } = stubAdmin([
      { id: "pizza", categoria: "Pizze", ingredienti: ["pomodoro", "mozzarella"], composizione: [{ id: "g" }] },
    ]);
    await decrementIngredientStock(
      admin,
      [line({ item_id: "pizza", qta: 2 })], // no frozen composizione on the line
      { composizione: true, ingredienti: true },
      [], // "Pizze" is not a category-level composable category
    );
    expect(consumed()).toEqual({});
  });

  it("REGRESSION: a composable item with an EMPTY composition consumes nothing from its display list", async () => {
    // All-optional groups (min:0) → customer picks nothing → priceLines omits
    // the composizione key. The item must still be treated as composable (by
    // category) and NOT decrement its display-only ingredient list.
    const { admin, consumed } = stubAdmin([
      { id: "poke", categoria: "Poke", ingredienti: ["tonno", "alga"] },
    ]);
    await decrementIngredientStock(
      admin,
      [line({ item_id: "poke", qta: 2 })], // no composizione key
      { composizione: true, ingredienti: true },
      ["Poke"],
    );
    expect(consumed()).toEqual({});
  });

  it("sums a shared ingredient across a composable and a simple line", async () => {
    const { admin, consumed } = stubAdmin([
      { id: "insalata", categoria: "Insalate", ingredienti: ["pomodoro"] },
    ]);
    await decrementIngredientStock(
      admin,
      [
        line({
          item_id: "poke",
          qta: 1,
          composizione: [{ ingredient_id: "pomodoro", nome: "Pomodoro", qta: 1, prezzo: 0 }],
        }),
        line({ item_id: "insalata", qta: 2 }),
      ],
      { composizione: true, ingredienti: true },
      ["Poke"], // poke composable; insalata is simple
    );
    // 1 (composition) + 2 (simple) = 3
    expect(consumed()).toEqual({ pomodoro: 3 });
  });

  it("treats a would-be composable category as simple when componibili is off (empty composable set)", async () => {
    const { admin, consumed } = stubAdmin([
      { id: "poke", categoria: "Poke", ingredienti: ["tonno"] },
    ]);
    await decrementIngredientStock(
      admin,
      [line({ item_id: "poke", qta: 1 })],
      { ingredienti: true },
      [], // componibili off → no composable categories → consume the list
    );
    expect(consumed()).toEqual({ tonno: 1 });
  });

  it("does nothing when the simple source is off", async () => {
    const { admin, rpcCalls, inCalls } = stubAdmin([
      { id: "pizza", categoria: "Pizze", ingredienti: ["pomodoro"] },
    ]);
    await decrementIngredientStock(admin, [line({ item_id: "pizza", qta: 1 })], {
      composizione: true, // composition only; this line has none
    });
    expect(rpcCalls).toHaveLength(0);
    expect(inCalls).toHaveLength(0);
  });

  it("ignores products with an empty ingredient list", async () => {
    const { admin, rpcCalls } = stubAdmin([
      { id: "acqua", categoria: "Bevande", ingredienti: [] },
    ]);
    await decrementIngredientStock(
      admin,
      [line({ item_id: "acqua", qta: 5 })],
      { ingredienti: true },
      [],
    );
    expect(rpcCalls).toHaveLength(0);
  });
});
