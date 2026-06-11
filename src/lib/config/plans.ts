/**
 * Pricing configuration for restaurateur subscriptions (Stripe Billing).
 *
 * These are the prices WE charge restaurateurs on OUR Stripe account.
 * They are intentionally centralised here (not hardcoded across the app) so
 * they can be tuned in one place. Amounts are in EUR cents.
 *
 * NOTE: this has nothing to do with Stripe Connect customer payments.
 */

export type PlanId = "base" | "plus" | "pro";

export interface PlanConfig {
  id: PlanId;
  label: string;
  /** Monthly price in EUR cents (Stripe Billing). */
  priceCents: number;
  /** Stripe Price ID — filled from env in production. Optional locally. */
  stripePriceEnv: string;
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  base: {
    id: "base",
    label: "Base",
    priceCents: 2900,
    stripePriceEnv: "STRIPE_PRICE_BASE",
    features: ["Menu digitale", "Ordini al tavolo", "Bot Telegram Ordini"],
  },
  plus: {
    id: "plus",
    label: "Plus",
    priceCents: 3900,
    stripePriceEnv: "STRIPE_PRICE_PLUS",
    features: ["Tutto di Base", "Dominio personalizzato", "Pagamenti al tavolo"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceCents: 5900,
    stripePriceEnv: "STRIPE_PRICE_PRO",
    features: ["Tutto di Plus", "Riconciliazione avanzata", "Priorità supporto"],
  },
};

/** Add-on: multilingua, +10€/mese. */
export const MULTILINGUA_ADDON = {
  label: "Multilingua",
  priceCents: 1000,
  stripePriceEnv: "STRIPE_PRICE_MULTILINGUA",
};

export function formatEUR(cents: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
