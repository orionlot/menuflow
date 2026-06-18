import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, Restaurant } from "@/types/db";
import { notifyPaidOrder } from "@/lib/telegram";
import { isFeatureOn } from "@/lib/config/features";
import { decrementIngredientStock, composableCategories } from "@/lib/ingredients";
import { decrementMenuItemStock } from "@/lib/menu-stock";

/**
 * Transition an order to `pagato` and fire the Payments bot. Shared by the
 * Stripe Connect webhook and the dev payment simulator. Idempotent: if the
 * order is already paid (e.g. a duplicate webhook), it does nothing.
 */
export async function markOrderPaid(
  admin: SupabaseClient,
  opts: { orderId?: string; paymentIntentId?: string; paidAmountCents?: number; currency?: string },
): Promise<Order | null> {
  let query = admin.from("orders").select("*");
  if (opts.orderId) query = query.eq("id", opts.orderId);
  else if (opts.paymentIntentId)
    query = query.eq("stripe_payment_intent", opts.paymentIntentId);
  else throw new Error("markOrderPaid: orderId or paymentIntentId required");

  const { data: orderRow, error: selErr } = await query.maybeSingle();
  // A DB read failure must surface (the webhook returns 500 so Stripe retries) —
  // never silently treat it as "order not found".
  if (selErr) throw new Error(`markOrderPaid: lettura ordine fallita: ${selErr.message}`);
  const order = orderRow as Order | null;
  if (!order) return null;
  if (order.stato === "pagato") return order; // already processed

  // Payment-truth: when the caller passes the amount actually captured by Stripe
  // (the REAL Connect webhook), it MUST equal the server-recomputed order total
  // (and be EUR) before we flip to `pagato` and fire "battere scontrino". The dev
  // payment simulator passes NO amount → this check is skipped (test bypass kept).
  // A mismatch is logged and NOT marked paid (no wrong-total receipt reminder).
  if (opts.paidAmountCents != null) {
    const expected = Math.round(Number(order.totale) * 100);
    const currencyOk = !opts.currency || opts.currency.toLowerCase() === "eur";
    if (opts.paidAmountCents !== expected || !currencyOk) {
      console.error(
        `[markOrderPaid] amount mismatch order=${order.id} captured=${opts.paidAmountCents}${opts.currency ?? ""} expected=${expected}eur — NOT marking paid`,
      );
      return null;
    }
  }

  // Race-safe transition: the `neq("stato","pagato")` filter means only ONE of
  // two concurrent webhook deliveries actually flips the row (Postgres serialises
  // the row lock). The loser matches 0 rows and returns below WITHOUT notifying,
  // so the Payments bot fires exactly once even under duplicate delivery.
  const { data: updatedRow, error: updErr } = await admin
    .from("orders")
    .update({ stato: "pagato", pagato_at: new Date().toISOString() })
    .eq("id", order.id)
    .neq("stato", "pagato")
    .select("*")
    .maybeSingle();
  if (updErr) throw new Error(`markOrderPaid: aggiornamento ordine fallito: ${updErr.message}`);
  const updated = updatedRow as Order | null;

  if (!updated) return order; // already paid by a concurrent delivery — don't re-notify

  const { data: restaurantRow } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", updated.restaurant_id)
    .maybeSingle();
  const restaurant = restaurantRow as Restaurant | null;

  if (restaurant) {
    // Mirror the route's Case A decrements for the online-paid flow.
    // Per-product stock (scorte):
    if (isFeatureOn(restaurant, "scorte"))
      await decrementMenuItemStock(admin, updated.items);
    // Ingredient stock: composable products consume their composition, simple
    // products their ingredient list.
    const componibiliOn = isFeatureOn(restaurant, "componibili");
    const ingredientiOn = isFeatureOn(restaurant, "ingredienti");
    if (componibiliOn || ingredientiOn)
      await decrementIngredientStock(
        admin,
        updated.items,
        { composizione: componibiliOn, ingredienti: ingredientiOn },
        composableCategories(restaurant.composizione, componibiliOn),
      );
    await notifyPaidOrder(restaurant, updated);
  }
  return updated;
}

/** Transition an order to `fallito` (payment failed). Never notifies as paid. */
export async function markOrderFailed(
  admin: SupabaseClient,
  paymentIntentId: string,
): Promise<void> {
  const { error } = await admin
    .from("orders")
    .update({ stato: "fallito" })
    .eq("stripe_payment_intent", paymentIntentId)
    .neq("stato", "pagato");
  if (error) throw new Error(`markOrderFailed: ${error.message}`);
}
