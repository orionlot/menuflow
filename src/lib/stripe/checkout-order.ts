import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, Restaurant } from "@/types/db";
import {
  createConnectCheckoutSession,
  expireConnectCheckoutSession,
} from "@/lib/stripe/connect";

/**
 * Create a hosted Checkout Session for an order awaiting online payment, on the
 * restaurant's connected account, and persist the session id on the order. If the
 * order already has an open session (an earlier attempt / "Paga ora"), it is
 * expired first so only ONE session can ever complete → no double charge.
 *
 * The amount is `order.totale` — the server-recomputed total written at creation;
 * the client never supplies it. Returns the hosted URL (or null if Stripe gave
 * none / the restaurant has no connected account).
 */
export async function checkoutForOrder(
  admin: SupabaseClient,
  args: { order: Order; restaurant: Restaurant; origin: string },
): Promise<string | null> {
  const { order, restaurant, origin } = args;
  if (!restaurant.stripe_connect_id) return null;

  if (order.stripe_checkout_session) {
    await expireConnectCheckoutSession(order.stripe_checkout_session, restaurant.stripe_connect_id);
  }

  const base = `${origin.replace(/\/+$/, "")}/ordine/${order.id}`;
  const session = await createConnectCheckoutSession({
    orderId: order.id,
    restaurantId: restaurant.id,
    restaurantName: restaurant.nome,
    tavolo: order.tavolo,
    totaleCents: Math.round(Number(order.totale) * 100),
    successUrl: `${base}?pagato=1`,
    cancelUrl: base,
    connectedAccountId: restaurant.stripe_connect_id,
  });

  await admin.from("orders").update({ stripe_checkout_session: session.id }).eq("id", order.id);
  return session.url;
}
