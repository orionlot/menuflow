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
  const { error } = await admin
    .from("restaurants")
    .update({ attivo })
    .eq("stripe_customer_id", customerId);
  if (error) throw new Error(`setActiveByCustomer: ${error.message}`);
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

  const admin = createAdminClient();

  // Idempotency: skip events already processed (Stripe may redeliver).
  const { data: seen } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
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
  } catch (err) {
    // Don't ack with 200 on a DB-write failure — return 500 so Stripe retries
    // (otherwise a paying tenant could stay suspended, or a lapsed one active).
    console.error(`[billing-webhook] ${event.type} (${event.id}) failed:`, err);
    return NextResponse.json({ error: "Elaborazione fallita." }, { status: 500 });
  }

  const { error: ledgerErr } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (ledgerErr) console.error("[billing-webhook] stripe_events insert failed:", ledgerErr.message);
  return NextResponse.json({ received: true });
}
