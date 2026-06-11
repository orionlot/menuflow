import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/connect";
import { BILLING_WEBHOOK_SECRET } from "@/lib/stripe/billing";
import { isStripeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * STRIPE BILLING webhook — restaurateur subscriptions on OUR account.
 *
 * SEPARATE from the Connect webhook and from order/PaymentIntent logic. Drives
 * tenant activation: failed/cancelled subscription → `attivo=false` (suspend),
 * successful payment → `attivo=true`. Matches restaurants by stripe_customer_id.
 */
async function setActiveByCustomer(customerId: string, attivo: boolean) {
  const admin = createAdminClient();
  await admin
    .from("restaurants")
    .update({ attivo })
    .eq("stripe_customer_id", customerId);
}

export async function POST(req: Request) {
  if (!isStripeConfigured() || !BILLING_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe non configurato." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) {
    return NextResponse.json({ error: "Firma mancante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, BILLING_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Firma non valida.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  switch (event.type) {
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      if (inv.customer) await setActiveByCustomer(String(inv.customer), true);
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      if (inv.customer) await setActiveByCustomer(String(inv.customer), false);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.customer) await setActiveByCustomer(String(sub.customer), false);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const active = sub.status === "active" || sub.status === "trialing";
      if (sub.customer) await setActiveByCustomer(String(sub.customer), active);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
