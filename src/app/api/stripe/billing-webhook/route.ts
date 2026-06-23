import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/connect";
import { BILLING_WEBHOOK_SECRET, planForPriceId } from "@/lib/stripe/billing";
import type { PlanId } from "@/lib/config/plans";
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

/** Mirror a subscription's full state onto the restaurant (status, renewal,
 *  subscription id) and sync `piano` from the plan line item (ignoring the
 *  multilingua add-on). `attivo` is true only for active/trialing. */
async function syncSubscription(customerId: string, sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const active = sub.status === "active" || sub.status === "trialing";
  let piano: PlanId | null = null;
  for (const it of sub.items.data) {
    const p = planForPriceId(it.price.id);
    if (p) { piano = p; break; }
  }
  if (!piano) {
    console.warn(`[billing-webhook] no known plan line item for subscription ${sub.id} (customer ${customerId}); leaving restaurants.piano unchanged`);
  }
  // current_period_end is unix seconds; read defensively in case the API version
  // surfaces it on the item rather than the subscription root.
  const periodEnd =
    (sub as { current_period_end?: number }).current_period_end ??
    (sub.items.data[0] as { current_period_end?: number } | undefined)?.current_period_end ??
    null;
  const patch: Record<string, unknown> = {
    attivo: active,
    stripe_subscription_id: sub.id,
    abbonamento_stato: sub.status,
    abbonamento_rinnovo: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
  if (piano) patch.piano = piano;
  const { error } = await admin.from("restaurants").update(patch).eq("stripe_customer_id", customerId);
  if (error) throw new Error(`syncSubscription: ${error.message}`);
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
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.customer) await syncSubscription(String(sub.customer), sub);
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
