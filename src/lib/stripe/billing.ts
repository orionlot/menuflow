import "server-only";
import { getStripe } from "@/lib/stripe/connect";
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

/**
 * Creates (or would create) a subscription for a restaurateur on our account.
 * Used by the admin flow when onboarding a paying restaurateur.
 */
export async function createSubscription(params: {
  customerId: string;
  plan: PlanId;
}) {
  const stripe = getStripe();
  const price = priceIdForPlan(params.plan);
  if (!price) {
    throw new Error(
      `Price ID per il piano "${params.plan}" non configurato in env.`,
    );
  }
  return stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price }],
    metadata: { kind: "menuflow_subscription", plan: params.plan },
  });
}
