import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, CONNECT_WEBHOOK_SECRET, checkoutSessionPaidArgs } from "@/lib/stripe/connect";
import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import { isStripeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * STRIPE CONNECT webhook — customer table payments.
 *
 * This is the ONLY source of truth for payment success (briefing §6): the
 * client's success callback is never trusted. Separate signing secret from the
 * Billing webhook; this endpoint never touches subscriptions.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured() || !CONNECT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe non configurato." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) {
    return NextResponse.json({ error: "Firma mancante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, CONNECT_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Firma non valida.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: Stripe can redeliver an event. Skip ones already processed.
  const { data: seen } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Pass the captured amount/currency so markOrderPaid can assert it matches
        // the server-recomputed total before flipping to paid.
        await markOrderPaid(admin, {
          paymentIntentId: pi.id,
          paidAmountCents: pi.amount_received ?? pi.amount,
          currency: pi.currency,
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markOrderFailed(admin, { paymentIntentId: pi.id });
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const args = checkoutSessionPaidArgs(session);
        if (!args.orderId) break;
        // Persist the PaymentIntent id for reconciliation, then mark paid. Truth
        // of "paid" is this webhook; the amount/currency are asserted in markOrderPaid.
        if (args.paymentIntentId) {
          const { error: piErr } = await admin
            .from("orders")
            .update({ stripe_payment_intent: args.paymentIntentId })
            .eq("id", args.orderId);
          // Persist BEFORE marking paid; a failure here must surface (500 → Stripe
          // retries) so the order isn't flipped to pagato without its PI id.
          if (piErr) throw new Error(`connect-webhook: persist PI failed: ${piErr.message}`);
        }
        await markOrderPaid(admin, {
          orderId: args.orderId,
          paidAmountCents: args.paidAmountCents,
          currency: args.currency,
        });
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (orderId) await markOrderFailed(admin, { orderId });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // A DB-write failure must NOT be swallowed with a 200 — return 500 so Stripe
    // retries, otherwise a real paid order would stay unmarked forever.
    console.error(`[connect-webhook] ${event.type} (${event.id}) failed:`, err);
    return NextResponse.json({ error: "Elaborazione fallita." }, { status: 500 });
  }

  // Record only after successful processing (a failed attempt stays retryable).
  // markOrderPaid is idempotent, so a duplicate that slips the check is harmless.
  // Log (don't fail) an insert error — e.g. the stripe_events table missing
  // (migration 0036 not applied) means idempotency is silently degraded.
  const { error: ledgerErr } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (ledgerErr) console.error("[connect-webhook] stripe_events insert failed:", ledgerErr.message);
  return NextResponse.json({ received: true });
}
