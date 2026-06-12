import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, Restaurant } from "@/types/db";
import { notifyPaidOrder } from "@/lib/telegram";

/**
 * Transition an order to `pagato` and fire the Payments bot. Shared by the
 * Stripe Connect webhook and the dev payment simulator. Idempotent: if the
 * order is already paid (e.g. a duplicate webhook), it does nothing.
 */
export async function markOrderPaid(
  admin: SupabaseClient,
  opts: { orderId?: string; paymentIntentId?: string },
): Promise<Order | null> {
  let query = admin.from("orders").select("*");
  if (opts.orderId) query = query.eq("id", opts.orderId);
  else if (opts.paymentIntentId)
    query = query.eq("stripe_payment_intent", opts.paymentIntentId);
  else throw new Error("markOrderPaid: orderId or paymentIntentId required");

  const { data: orderRow } = await query.maybeSingle();
  const order = orderRow as Order | null;
  if (!order) return null;
  if (order.stato === "pagato") return order; // already processed

  // Race-safe transition: the `neq("stato","pagato")` filter means only ONE of
  // two concurrent webhook deliveries actually flips the row (Postgres serialises
  // the row lock). The loser matches 0 rows and returns below WITHOUT notifying,
  // so the Payments bot fires exactly once even under duplicate delivery.
  const { data: updatedRow } = await admin
    .from("orders")
    .update({ stato: "pagato", pagato_at: new Date().toISOString() })
    .eq("id", order.id)
    .neq("stato", "pagato")
    .select("*")
    .maybeSingle();
  const updated = updatedRow as Order | null;

  if (!updated) return order; // already paid by a concurrent delivery — don't re-notify

  const { data: restaurantRow } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", updated.restaurant_id)
    .maybeSingle();
  const restaurant = restaurantRow as Restaurant | null;

  if (restaurant) await notifyPaidOrder(restaurant, updated);
  return updated;
}

/** Transition an order to `fallito` (payment failed). Never notifies as paid. */
export async function markOrderFailed(
  admin: SupabaseClient,
  paymentIntentId: string,
): Promise<void> {
  await admin
    .from("orders")
    .update({ stato: "fallito" })
    .eq("stripe_payment_intent", paymentIntentId)
    .neq("stato", "pagato");
}
