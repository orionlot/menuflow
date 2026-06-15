import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/types/db";

/**
 * Decrement ingredient stock for a placed/paid order. Aggregates consumption
 * across all lines (per-ingredient qty × line qty) and applies it atomically via
 * the `consume_ingredient` RPC (single conditional UPDATE per ingredient — no
 * read-then-write race). Ingredients with null stock (unlimited) are skipped.
 */
export async function decrementIngredientStock(
  admin: SupabaseClient,
  items: OrderItem[],
): Promise<void> {
  const used = new Map<string, number>();
  for (const l of items)
    for (const c of l.composizione ?? [])
      used.set(c.ingredient_id, (used.get(c.ingredient_id) ?? 0) + c.qta * l.qta);
  if (!used.size) return;
  await Promise.all(
    [...used.entries()].map(([id, n]) =>
      admin.rpc("consume_ingredient", { p_id: id, p_n: n }),
    ),
  );
}
