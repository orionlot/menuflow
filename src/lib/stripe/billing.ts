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
