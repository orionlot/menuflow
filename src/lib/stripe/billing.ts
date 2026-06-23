import "server-only";
import { PLANS, type PlanId } from "@/lib/config/plans";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Restaurant } from "@/types/db";
import { getStripe } from "@/lib/stripe/connect";
import { MULTILINGUA_ADDON } from "@/lib/config/plans";

/**
 * STRIPE BILLING — restaurateur subscriptions billed to OUR account.
 *
 * SEPARATE from Stripe Connect (./connect.ts). This money is ours; Connect
 * money is the restaurateur's. Never mix the two: this module only ever uses
 * the plain (non-`stripeAccount`) request context.
 */

export const BILLING_WEBHOOK_SECRET =
  process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? "";

/** Resolve the Stripe Price ID for a plan from env (parametric, not hardcoded). */
export function priceIdForPlan(plan: PlanId): string | undefined {
  return process.env[PLANS[plan].stripePriceEnv];
}

/** Reverse of priceIdForPlan: map a Stripe Price ID back to a PlanId (or null).
 *  Used by the billing webhook to sync restaurants.piano on a Customer-Portal plan
 *  change. Ignores the Multilingua add-on price (returns null for it). */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of Object.keys(PLANS) as PlanId[]) {
    if (process.env[PLANS[id].stripePriceEnv] === priceId) return id;
  }
  return null;
}

/** Get the restaurant's Stripe Billing customer, creating + persisting it once. */
export async function getOrCreateBillingCustomer(
  admin: SupabaseClient,
  restaurant: Pick<Restaurant, "id" | "stripe_customer_id">,
  email: string,
): Promise<string> {
  if (restaurant.stripe_customer_id) return restaurant.stripe_customer_id;
  const customer = await getStripe().customers.create({
    email,
    metadata: { restaurant_id: restaurant.id },
  });
  const { error } = await admin
    .from("restaurants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", restaurant.id);
  if (error) throw new Error(`getOrCreateBillingCustomer: ${error.message}`);
  return customer.id;
}

/** Create a subscription Checkout Session for the chosen plan (+ multilingua add-on). */
export async function createSubscriptionCheckout(input: {
  customerId: string;
  restaurantId: string;
  piano: PlanId;
  multilingua: boolean;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const planPrice = priceIdForPlan(input.piano);
  if (!planPrice) throw new Error("Prezzo del piano non configurato.");
  const line_items: { price: string; quantity: number }[] = [{ price: planPrice, quantity: 1 }];
  const addon = process.env[MULTILINGUA_ADDON.stripePriceEnv];
  if (input.multilingua && !addon) throw new Error("Prezzo Multilingua non configurato.");
  if (input.multilingua && addon) line_items.push({ price: addon, quantity: 1 });
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId,
    line_items,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { restaurant_id: input.restaurantId },
    subscription_data: { metadata: { restaurant_id: input.restaurantId } },
  });
  return session.url;
}

/** Create a Billing Customer Portal session (manage card / plan / cancel). */
export async function createBillingPortal(customerId: string, returnUrl: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
