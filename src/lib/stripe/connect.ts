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

/**
 * Creates a PaymentIntent on the restaurateur's connected account.
 * @param amountCents authoritative amount, recomputed server-side from DB.
 * @param connectedAccountId restaurants.stripe_connect_id
 */
export async function createConnectPaymentIntent(params: {
  amountCents: number;
  connectedAccountId: string;
  orderId: string;
  restaurantId: string;
}) {
  const stripe = getStripe();
  return stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: "eur",
      // No platform fee: the whole amount belongs to the restaurateur.
      application_fee_amount: 0,
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_id: params.orderId,
        restaurant_id: params.restaurantId,
        kind: "connect_table_payment",
      },
    },
    { stripeAccount: params.connectedAccountId },
  );
}

export const CONNECT_WEBHOOK_SECRET =
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? "";
