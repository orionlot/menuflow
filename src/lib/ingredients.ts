import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/types/db";

/** Which ingredient sources to consume from an order's lines. */
export interface DecrementSources {
  /** Composable products: the chosen composition ingredients. */
  composizione?: boolean;
  /** Simple products: the per-product display ingredient list. */
  ingredienti?: boolean;
}

/**
 * Decrement ingredient stock for a placed/paid order. Aggregates consumption
 * across all lines and applies it atomically via the `consume_ingredient` RPC
 * (single conditional UPDATE per ingredient — no read-then-write race, floors
 * at 0, skips ingredients with null/unlimited stock).
 *
 * Two disjoint sources, selected per `sources`:
 *  - **composizione**: composable lines carry their chosen ingredients (with
 *    per-unit qty) directly on the order line.
 *  - **ingredienti**: simple products list ingredient ids on the menu item
 *    itself (not on the order line), so we re-fetch them; each listed
 *    ingredient counts as 1 unit per product unit.
 *
 * A product consumes through exactly ONE source. A line is treated as
 * composition-driven (and excluded from the `ingredienti` pass) when EITHER it
 * already carries a frozen `composizione` on the order line, OR the item is
 * currently in a composable category. The first signal protects against config
 * drift between order placement and decrement (Case B's payment window): a line
 * that was priced with a composition keeps consuming via that frozen list even
 * if the category later leaves the composable set. The second signal covers a
 * composable product whose chosen composition was empty (all-optional groups),
 * so no `composizione` key was stored. Together they guarantee no ingredient is
 * ever decremented twice.
 *
 * `composableCategorie` is the set of categories handled by composition (the
 * union of the restaurant's composition groups' categories, when the
 * `componibili` feature is on; empty otherwise).
 */
export async function decrementIngredientStock(
  admin: SupabaseClient,
  items: OrderItem[],
  sources: DecrementSources = { composizione: true },
  composableCategorie: Iterable<string> = [],
): Promise<void> {
  const used = new Map<string, number>();

  // Composable products: consume the explicitly chosen composition ingredients.
  if (sources.composizione)
    for (const l of items)
      for (const c of l.composizione ?? [])
        used.set(c.ingredient_id, (used.get(c.ingredient_id) ?? 0) + c.qta * l.qta);

  // Simple products: consume each ingredient listed on the menu item, scaled by
  // the line qty. Lines that already carry a composition are composition-driven
  // and excluded here. The list lives on `menu_items` (not the order line), so
  // fetch it; products currently in a composable category are also excluded.
  if (sources.ingredienti) {
    const simple = items.filter((l) => !(l.composizione?.length));
    const ids = [...new Set(simple.map((l) => l.item_id))];
    if (ids.length) {
      const { data } = await admin
        .from("menu_items")
        .select("id, categoria, ingredienti, composizione")
        .in("id", ids);
      const composable = new Set(composableCategorie);
      const byId = new Map(
        (data ?? []).map((r) => [
          r.id as string,
          {
            categoria: r.categoria as string,
            // Recipe is now [{ id, grammi }] (count each ingredient as 1 unit/product
            // unit for stock); tolerate legacy bare-id strings.
            ingredienti: ((r.ingredienti as (string | { id: string })[] | null) ?? [])
              .map((v) => (typeof v === "string" ? v : v?.id))
              .filter(Boolean),
            // per-item composition groups (empty for non per-item-composable items)
            composable: Array.isArray(r.composizione) && r.composizione.length > 0,
          },
        ]),
      );
      for (const l of simple) {
        const row = byId.get(l.item_id);
        // Skip composition-driven products: category-level composable, or
        // per-item composable (its own groups own ingredient consumption).
        if (!row || composable.has(row.categoria) || row.composable) continue;
        for (const ingId of row.ingredienti)
          used.set(ingId, (used.get(ingId) ?? 0) + l.qta);
      }
    }
  }

  if (!used.size) return;
  await Promise.all(
    [...used.entries()].map(([id, n]) =>
      admin.rpc("consume_ingredient", { p_id: id, p_n: n }),
    ),
  );
}

/**
 * The categories whose ingredient consumption is driven by composition (so
 * their products' display `ingredienti` list must NOT be decremented). It's the
 * union of the restaurant's composition groups' categories when `componibili`
 * is on, and empty otherwise.
 */
export function composableCategories(
  gruppi: { categorie: string[] }[] | null | undefined,
  componibiliOn: boolean,
): string[] {
  if (!componibiliOn || !gruppi) return [];
  return [...new Set(gruppi.flatMap((g) => g.categorie ?? []))];
}
