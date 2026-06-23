import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, Restaurant } from "@/types/db";
import {
  createConnectCheckoutSession,
  expireConnectCheckoutSession,
  retrieveConnectCheckoutSession,
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

  // If a prior session exists, inspect its real Stripe status BEFORE recreating.
  // A session the customer already completed (the webhook may not have landed
  // yet, so the order is still in_attesa_pagamento) must NEVER be replaced with a
  // new payable session — that would double-charge. Fail safe: if we can't read
  // the prior session, do NOT create a new one (a blocked retry is recoverable;
  // a double charge is not).
  if (order.stripe_checkout_session) {
    let prior: Awaited<ReturnType<typeof retrieveConnectCheckoutSession>> | null = null;
    try {
      prior = await retrieveConnectCheckoutSession(order.stripe_checkout_session, restaurant.stripe_connect_id);
    } catch {
      return null;
    }
    if (prior.status === "complete" || prior.payment_status === "paid") {
      // Already paid — the webhook will flip the order to pagato shortly.
      return null;
    }
    if (prior.status === "open") {
      await expireConnectCheckoutSession(order.stripe_checkout_session, restaurant.stripe_connect_id);
    }
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

  const { error } = await admin
    .from("orders")
    .update({ stripe_checkout_session: session.id })
    .eq("id", order.id);
  // Must surface: if this persist fails, a later "Paga ora" retry can't expire
  // this session and would create a second completable one (double-charge risk).
  if (error) throw new Error(`checkoutForOrder: persist session failed: ${error.message}`);
  return session.url;
}
