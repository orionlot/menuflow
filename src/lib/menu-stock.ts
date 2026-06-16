import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/types/db";

/**
 * Decrement per-product stock (`menu_items.scorta`, the "scorte" feature) for a
 * placed/paid order. Aggregates the ordered quantity per item across all lines
 * and applies it atomically via the `consume_menu_item` RPC (single conditional
 * UPDATE — no read-then-write race, floors at 0, skips unlimited/null stock).
 *
 * Called from both order paths so per-product stock decrements regardless of
 * payment mode:
 *  - non-online orders (api/ordine Case A), and
 *  - online-paid orders (markOrderPaid, after the Stripe webhook / dev sim).
 */
export async function decrementMenuItemStock(
  admin: SupabaseClient,
  items: OrderItem[],
): Promise<void> {
  const used = new Map<string, number>();
  for (const l of items)
    used.set(l.item_id, (used.get(l.item_id) ?? 0) + l.qta);
  if (!used.size) return;
  await Promise.all(
    [...used.entries()].map(([id, n]) =>
      admin.rpc("consume_menu_item", { p_id: id, p_n: n }),
    ),
  );
}
