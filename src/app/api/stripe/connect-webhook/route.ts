import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, CONNECT_WEBHOOK_SECRET } from "@/lib/stripe/connect";
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

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await markOrderPaid(admin, { paymentIntentId: pi.id });
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await markOrderFailed(admin, pi.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
