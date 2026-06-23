import "server-only";
import Stripe from "stripe";
import { isStripeConfigured } from "@/lib/env";

/**
 * STRIPE CONNECT — customer payments at the table.
 *
 * Money flows DIRECTLY to the restaurateur's connected (Express) account.
 * We take no fee (application_fee_amount = 0). This is COMPLETELY SEPARATE
 * from Stripe Billing (our subscription revenue, see ./billing.ts).
 *
 * The same secret key is used; what makes it "Connect" is the
 * { stripeAccount } request option targeting the connected account.
 */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("Stripe non configurato (STRIPE_SECRET_KEY mancante).");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  }
  return _stripe;
}

export type CheckoutParamsInput = {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  tavolo?: string | null;
  totaleCents: number;
  successUrl: string;
  cancelUrl: string;
};

/**
 * Pure builder for the hosted Checkout Session params. Single aggregated line
 * item priced at the server-recomputed total (no per-dish detail leaked, no
 * rounding drift). No `payment_method_types` → Stripe shows the methods enabled
 * on the connected account, incl. card wallets (Apple/Google Pay). No
 * `application_fee_amount` → the whole amount belongs to the restaurateur.
 */
export function buildCheckoutParams(input: CheckoutParamsInput): Stripe.Checkout.SessionCreateParams {
  const meta = {
    order_id: input.orderId,
    restaurant_id: input.restaurantId,
    kind: "connect_table_payment",
  };
  const name = `Ordine — ${input.restaurantName}${input.tavolo ? ` · Tavolo ${input.tavolo}` : ""}`;
  return {
    mode: "payment",
    locale: "it",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: input.totaleCents,
          product_data: { name },
        },
      },
    ],
    metadata: meta,
    payment_intent_data: { metadata: meta },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}

/** Pure: extract the args markOrderPaid needs from a completed Checkout Session. */
export function checkoutSessionPaidArgs(session: {
  metadata?: Record<string, string> | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id: string } | null;
}): { orderId?: string; paidAmountCents?: number; currency?: string; paymentIntentId?: string } {
  const pi = session.payment_intent;
  return {
    orderId: session.metadata?.order_id,
    paidAmountCents: session.amount_total ?? undefined,
    currency: session.currency ?? undefined,
    paymentIntentId: typeof pi === "string" ? pi : pi?.id,
  };
}

/** Create the hosted Checkout Session ON the connected account (direct charge). */
export async function createConnectCheckoutSession(
  input: CheckoutParamsInput & { connectedAccountId: string },
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(buildCheckoutParams(input), {
    stripeAccount: input.connectedAccountId,
  });
}

/** Retrieve a Checkout Session on the connected account (to inspect its status). */
export async function retrieveConnectCheckoutSession(
  sessionId: string,
  connectedAccountId: string,
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId, undefined, { stripeAccount: connectedAccountId });
}

/** Best-effort expire a still-open session (already-completed/expired → ignored). */
export async function expireConnectCheckoutSession(
  sessionId: string,
  connectedAccountId: string,
): Promise<void> {
  try {
    await getStripe().checkout.sessions.expire(sessionId, {}, { stripeAccount: connectedAccountId });
  } catch (err) {
    // Best-effort cleanup: an already-completed/expired session can't be expired
    // again, and a transient failure here must never block creating the new
    // payment session (a real misconfig surfaces loudly on the create call that
    // follows). Log for visibility rather than swallow silently.
    console.error(
      "[stripe] expireConnectCheckoutSession failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Create an Express connected account for a restaurateur (Connect onboarding). */
export async function createExpressAccount(params: {
  email: string;
  country?: string;
}): Promise<Stripe.Account> {
  return getStripe().accounts.create({
    type: "express",
    email: params.email || undefined,
    country: params.country ?? "IT",
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  });
}

/** Create an account-onboarding AccountLink (Stripe-hosted onboarding URL). */
export async function createAccountOnboardingLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: params.accountId,
    type: "account_onboarding",
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
  });
  return link.url;
}

/** True if the connected account can accept charges (onboarding complete). */
export async function accountChargesEnabled(accountId: string): Promise<boolean> {
  const acct = await getStripe().accounts.retrieve(accountId);
  return Boolean(acct.charges_enabled);
}

export const CONNECT_WEBHOOK_SECRET =
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? "";
