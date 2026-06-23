import "server-only";
import { PLANS, type PlanId } from "@/lib/config/plans";

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
