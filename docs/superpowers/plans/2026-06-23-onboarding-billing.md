# Onboarding Connect + Billing abbonamenti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the platform self-sufficient: the restaurateur pays the plan at signup (Stripe Billing) and can self-connect their payout account from the dashboard (Stripe Connect Express onboarding).

**Architecture:** Two separate Stripe systems. Billing (our revenue) lives in `src/lib/stripe/billing.ts` + the billing webhook; a subscription Checkout is created at signup, `attivo` flips only on `invoice.paid`. Connect (restaurateur's payouts) lives in `src/lib/stripe/connect.ts` + the connect webhook; a self-serve Express onboarding flow replaces the manual `acct_` paste. Everything degrades gracefully when Stripe is not configured.

**Tech Stack:** Next.js 15 App Router (server actions + route handlers), TypeScript strict, Supabase (service-role admin client), `stripe` Node SDK, Vitest.

## Global Constraints

- **Two Stripe systems, never mixed.** Billing code in `billing.ts` + `billing-webhook`; Connect code in `connect.ts`/`checkout-order.ts` + `connect-webhook`. Separate webhooks, separate signing secrets. The shared `getStripe()` SDK singleton (in `connect.ts`) MAY be reused (the billing webhook already imports it) — that is the only shared thing.
- **`attivo` is driven ONLY by the Billing webhook** (`invoice.paid`/`payment_failed`/`customer.subscription.*`). No other code marks a tenant active.
- **`pagamenti_attivi` is driven ONLY by Connect** (the return route / `account.updated` / the manual fallback). Connect onboarding is gated to **Plus/Pro**.
- **Pay-at-signup:** with Stripe configured, signup creates the tenant `attivo:false`; it goes live only on `invoice.paid`.
- **Insolvency:** `past_due`/`unpaid`/`canceled` → `attivo:false`; Stripe retries reactivate via `invoice.paid`.
- **Degrade without Stripe:** every new Stripe path is gated on `isStripeConfigured()`; when false, signup keeps the current simulated behavior (`attivo:true`, dashboard redirect) and the CTAs are hidden/no-op.
- **No `application_fee_amount`** on customer payments (unchanged). Secrets server-only. Italian user-facing strings. Migrations additive + mirror `src/types/db.ts`. **No `Co-Authored-By` trailer.**

---

### Task 1: Schema `0046` + types + `planForPriceId` (+ test)

**Files:**
- Create: `supabase/migrations/0046_subscription_tracking.sql`
- Modify: `src/types/db.ts` (after `stripe_customer_id: string | null;`, ~line 126)
- Modify: `src/lib/stripe/billing.ts` (add `planForPriceId`)
- Create: `src/lib/stripe/billing.test.ts`

**Interfaces:**
- Produces: `Restaurant.stripe_subscription_id|abbonamento_stato|abbonamento_rinnovo: string | null`; `planForPriceId(priceId: string | null | undefined): PlanId | null`.

- [ ] **Step 1: Migration**

`supabase/migrations/0046_subscription_tracking.sql`:
```sql
-- Stripe Billing subscription tracking on the platform's own account. The binary
-- `attivo` is too coarse to represent the subscription's real state (past_due
-- during retries, the renewal date, the specific subscription id). Additive.
alter table public.restaurants
  add column if not exists stripe_subscription_id text,
  add column if not exists abbonamento_stato text,
  add column if not exists abbonamento_rinnovo timestamptz;
```

- [ ] **Step 2: Types** — in `src/types/db.ts`, immediately after `stripe_customer_id: string | null;`:
```ts
  /** Stripe Billing subscription id (the restaurateur's plan subscription). */
  stripe_subscription_id: string | null;
  /** Subscription status mirrored from Stripe (active|past_due|unpaid|canceled|incomplete|trialing). */
  abbonamento_stato: string | null;
  /** Subscription current period end (renewal date), ISO string. */
  abbonamento_rinnovo: string | null;
```

- [ ] **Step 3: Write the failing test** — `src/lib/stripe/billing.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { planForPriceId, priceIdForPlan } from "@/lib/stripe/billing";

const SAVED = { ...process.env };
beforeEach(() => {
  process.env.STRIPE_PRICE_BASE = "price_base";
  process.env.STRIPE_PRICE_PLUS = "price_plus";
  process.env.STRIPE_PRICE_PRO = "price_pro";
});
afterEach(() => {
  process.env = { ...SAVED };
});

describe("planForPriceId", () => {
  it("maps each plan price id back to its PlanId", () => {
    expect(planForPriceId("price_base")).toBe("base");
    expect(planForPriceId("price_plus")).toBe("plus");
    expect(planForPriceId("price_pro")).toBe("pro");
  });
  it("returns null for unknown/missing ids (e.g. the multilingua add-on)", () => {
    expect(planForPriceId("price_multilingua")).toBeNull();
    expect(planForPriceId(null)).toBeNull();
    expect(planForPriceId(undefined)).toBeNull();
  });
  it("round-trips with priceIdForPlan", () => {
    expect(planForPriceId(priceIdForPlan("plus"))).toBe("plus");
  });
});
```

- [ ] **Step 4: Run → FAIL** `npx vitest run src/lib/stripe/billing.test.ts` (planForPriceId not exported).

- [ ] **Step 5: Implement** — in `src/lib/stripe/billing.ts`, after `priceIdForPlan`:
```ts
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
```

- [ ] **Step 6: Run → PASS**, then apply migration locally if Docker is up (`npm run db:reset` + `node --env-file=.env.local scripts/seed-users.mjs`), and `npx tsc --noEmit && npm run lint`.

- [ ] **Step 7: Commit**
```bash
git add supabase/migrations/0046_subscription_tracking.sql src/types/db.ts src/lib/stripe/billing.ts src/lib/stripe/billing.test.ts
git commit -m "Billing/Connect: migration 0046 subscription tracking + planForPriceId"
```

---

### Task 2: Billing helpers (customer / subscription checkout / portal)

**Files:** Modify `src/lib/stripe/billing.ts`

**Interfaces:**
- Consumes: `getStripe` (from `connect.ts`), `priceIdForPlan`, `MULTILINGUA_ADDON`, `PlanId`, `Restaurant`.
- Produces:
  - `getOrCreateBillingCustomer(admin: SupabaseClient, restaurant: Pick<Restaurant,"id"|"stripe_customer_id">, email: string): Promise<string>`
  - `createSubscriptionCheckout(input: { customerId: string; restaurantId: string; piano: PlanId; multilingua: boolean; successUrl: string; cancelUrl: string }): Promise<string | null>`
  - `createBillingPortal(customerId: string, returnUrl: string): Promise<string>`

- [ ] **Step 1: Add imports** at the top of `src/lib/stripe/billing.ts` (after the existing imports):
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Restaurant } from "@/types/db";
import { getStripe } from "@/lib/stripe/connect";
import { MULTILINGUA_ADDON } from "@/lib/config/plans";
```

- [ ] **Step 2: Add the three helpers** (after `planForPriceId`):
```ts
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
```

- [ ] **Step 3: Verify** `npx tsc --noEmit && npm run lint && npx vitest run` (all pass; no unit test for the impure helpers — covered by manual e2e).

- [ ] **Step 4: Commit**
```bash
git add src/lib/stripe/billing.ts
git commit -m "Billing: customer + subscription-checkout + portal helpers"
```

---

### Task 3: Pay-at-signup (registraLocale + OnboardingClient)

**Files:**
- Modify: `src/app/onboarding/actions.ts` (`RegistraResult` type; the insert's `attivo`; post-signup billing block)
- Modify: `src/app/onboarding/OnboardingClient.tsx` (redirect to `checkoutUrl`)

**Interfaces:**
- Consumes: `getOrCreateBillingCustomer`, `createSubscriptionCheckout` (Task 2), `isStripeConfigured`, `appOrigin`.
- Produces: `RegistraResult` now `{ ok: true; slug: string; checkoutUrl?: string } | { ok: false; error: string }`.

- [ ] **Step 1: Imports** — add to `src/app/onboarding/actions.ts`:
```ts
import { isStripeConfigured } from "@/lib/env";
import { appOrigin } from "@/lib/origin";
import { getOrCreateBillingCustomer, createSubscriptionCheckout } from "@/lib/stripe/billing";
```

- [ ] **Step 2: Result type** — change `RegistraResult`:
```ts
export type RegistraResult =
  | { ok: true; slug: string; checkoutUrl?: string }
  | { ok: false; error: string };
```

- [ ] **Step 3: Tenant created inactive when Stripe is on** — in the `.insert({...})`, change `attivo: true,` to:
```ts
      attivo: !isStripeConfigured(),
```

- [ ] **Step 4: Billing block** — replace the final `return { ok: true, slug };` with:
```ts
  // Billing: when Stripe is configured, the tenant pays the first month before
  // going live (attivo flips to true only on invoice.paid). Create the customer +
  // a subscription Checkout and return its URL for the client to redirect to.
  if (isStripeConfigured()) {
    try {
      const origin = await appOrigin();
      const customerId = await getOrCreateBillingCustomer(
        admin,
        { id: rest.id, stripe_customer_id: null },
        email,
      );
      const checkoutUrl = await createSubscriptionCheckout({
        customerId,
        restaurantId: rest.id,
        piano,
        multilingua,
        successUrl: `${origin}/dashboard?abbonato=1`,
        cancelUrl: `${origin}/dashboard?abbonamento=incompleto`,
      });
      if (checkoutUrl) return { ok: true, slug, checkoutUrl };
    } catch (err) {
      // Don't block account creation on a Stripe hiccup; the tenant exists as
      // attivo:false and can complete payment from the dashboard banner.
      console.error("[registraLocale] billing checkout failed:", err);
    }
  }
  return { ok: true, slug };
```

- [ ] **Step 5: Client redirect** — in `src/app/onboarding/OnboardingClient.tsx`, replace the result handling (`if (res.ok) setDone({ slug: res.slug });`):
```ts
      if (res.ok) {
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
          return;
        }
        setDone({ slug: res.slug });
      } else setError(res.error);
```

- [ ] **Step 6: Verify** `npx tsc --noEmit && npm run lint && npm run build`.

- [ ] **Step 7: Commit**
```bash
git add src/app/onboarding/actions.ts src/app/onboarding/OnboardingClient.tsx
git commit -m "Billing: pay-at-signup — tenant inactive until invoice.paid, redirect to subscription Checkout"
```

---

### Task 4: Billing webhook — record subscription state + sync piano

**Files:** Modify `src/app/api/stripe/billing-webhook/route.ts`

**Interfaces:**
- Consumes: `planForPriceId` (Task 1), `PlanId`.

- [ ] **Step 1: Imports** — change the billing import line and add the PlanId type:
```ts
import { BILLING_WEBHOOK_SECRET, planForPriceId } from "@/lib/stripe/billing";
import type { PlanId } from "@/lib/config/plans";
```

- [ ] **Step 2: Add a subscription-sync helper** next to `setActiveByCustomer`:
```ts
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
```

- [ ] **Step 3: Route the subscription events** — replace the `customer.subscription.deleted` and `customer.subscription.updated` cases with the three sub-event cases (keep `invoice.paid`/`invoice.payment_failed` unchanged):
```ts
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (sub.customer) await syncSubscription(String(sub.customer), sub);
        break;
      }
```

- [ ] **Step 4: Verify** `npx tsc --noEmit && npm run lint && npm run build`. (No unit test — webhook hits Stripe/DB; `planForPriceId` is covered in Task 1.)

- [ ] **Step 5: Commit**
```bash
git add src/app/api/stripe/billing-webhook/route.ts
git commit -m "Billing: webhook records subscription status/renewal + syncs piano from portal changes"
```

---

### Task 5: Dashboard — Abbonamento CTAs (checkout + portal)

**Files:**
- Modify: `src/app/dashboard/actions.ts` (two new actions + imports)
- Create: `src/app/dashboard/(app)/AbbonamentoCTA.tsx`
- Modify: `src/app/dashboard/(app)/page.tsx` (render the CTA in the Abbonamento section)

**Interfaces:**
- Consumes: `getOrCreateBillingCustomer`, `createSubscriptionCheckout`, `createBillingPortal` (Task 2), `appOrigin`, `isStripeConfigured`, `PlanId`.
- Produces: `createBillingCheckoutSession(): Promise<{url:string}|{error:string}>`, `createBillingPortalSession(): Promise<{url:string}|{error:string}>`.

- [ ] **Step 1: Imports** — add to `src/app/dashboard/actions.ts` (if not already present; `isStripeConfigured` is already imported, `createSupabaseServerClient`/`createAdminClient` too):
```ts
import { appOrigin } from "@/lib/origin";
import { getOrCreateBillingCustomer, createSubscriptionCheckout, createBillingPortal } from "@/lib/stripe/billing";
import type { PlanId } from "@/lib/config/plans";
```

- [ ] **Step 2: Add the two billing actions** (after `disconnectStripe`):
```ts
/** Start (or resume) the plan subscription for an inactive tenant. */
export async function createBillingCheckoutSession(): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured()) return { error: "Pagamenti non configurati." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };
  const { data: r } = await supabase
    .from("restaurants")
    .select("id, piano, multilingua, attivo, stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!r) return { error: "Nessun ristorante associato." };
  if (r.attivo) return { error: "Abbonamento già attivo." };
  try {
    const admin = createAdminClient();
    const origin = await appOrigin();
    const customerId = await getOrCreateBillingCustomer(
      admin,
      { id: r.id as string, stripe_customer_id: r.stripe_customer_id as string | null },
      user.email ?? "",
    );
    const url = await createSubscriptionCheckout({
      customerId,
      restaurantId: r.id as string,
      piano: r.piano as PlanId,
      multilingua: Boolean(r.multilingua),
      successUrl: `${origin}/dashboard?abbonato=1`,
      cancelUrl: `${origin}/dashboard?abbonamento=incompleto`,
    });
    return url ? { url } : { error: "Impossibile avviare il pagamento. Riprova." };
  } catch {
    return { error: "Impossibile avviare il pagamento. Riprova." };
  }
}

/** Open the Stripe Customer Portal to manage the subscription. */
export async function createBillingPortalSession(): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured()) return { error: "Pagamenti non configurati." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };
  const { data: r } = await supabase
    .from("restaurants").select("stripe_customer_id").eq("owner_id", user.id).maybeSingle();
  if (!r?.stripe_customer_id) return { error: "Nessun abbonamento da gestire." };
  try {
    const origin = await appOrigin();
    const url = await createBillingPortal(r.stripe_customer_id as string, `${origin}/dashboard`);
    return { url };
  } catch {
    return { error: "Portale non disponibile. Riprova." };
  }
}
```

- [ ] **Step 3: Create the client CTA** — `src/app/dashboard/(app)/AbbonamentoCTA.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";

export default function AbbonamentoCTA({
  attivo,
  stripeOn,
  startCheckout,
  openPortal,
}: {
  attivo: boolean;
  stripeOn: boolean;
  startCheckout: () => Promise<{ url: string } | { error: string }>;
  openPortal: () => Promise<{ url: string } | { error: string }>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!stripeOn) return null;

  function go(action: () => Promise<{ url: string } | { error: string }>) {
    setMsg(null);
    start(async () => {
      const res = await action();
      if ("url" in res) window.location.href = res.url;
      else setMsg(res.error);
    });
  }

  return (
    <div className="mt-4">
      {!attivo && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Abbonamento non attivo — completa il pagamento per pubblicare il menu.
        </div>
      )}
      <button
        onClick={() => go(attivo ? openPortal : startCheckout)}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : attivo ? "Gestisci abbonamento" : "Completa l'abbonamento"}
      </button>
      {msg && <p className="mt-2 text-sm text-red-500">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Render it** — in `src/app/dashboard/(app)/page.tsx`: import at top:
```ts
import AbbonamentoCTA from "./AbbonamentoCTA";
import { createBillingCheckoutSession, createBillingPortalSession } from "@/app/dashboard/actions";
import { isStripeConfigured } from "@/lib/env";
```
Then inside the Abbonamento `<section>`, immediately after the closing `</p>` of the multilingua note (`page.tsx:182`), add:
```tsx
        <AbbonamentoCTA
          attivo={restaurant.attivo}
          stripeOn={isStripeConfigured()}
          startCheckout={createBillingCheckoutSession}
          openPortal={createBillingPortalSession}
        />
```

- [ ] **Step 5: Verify** `npx tsc --noEmit && npm run lint && npm run build`.

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/actions.ts "src/app/dashboard/(app)/AbbonamentoCTA.tsx" "src/app/dashboard/(app)/page.tsx"
git commit -m "Billing: dashboard 'Completa l'abbonamento' + 'Gestisci abbonamento' (Customer Portal)"
```

---

### Task 6: Connect Express onboarding helpers + action

**Files:**
- Modify: `src/lib/stripe/connect.ts` (3 helpers)
- Modify: `src/app/dashboard/actions.ts` (new action + import)

**Interfaces:**
- Produces (connect.ts): `createExpressAccount({email, country?}): Promise<Stripe.Account>`, `createAccountOnboardingLink({accountId, refreshUrl, returnUrl}): Promise<string>`, `accountChargesEnabled(accountId): Promise<boolean>`.
- Produces (actions.ts): `createStripeConnectOnboardingLink(): Promise<{url:string}|{error:string}>`.

- [ ] **Step 1: connect.ts helpers** — add after `expireConnectCheckoutSession` (before `CONNECT_WEBHOOK_SECRET`):
```ts
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
```

- [ ] **Step 2: actions.ts import** — add to `src/app/dashboard/actions.ts` Stripe import:
```ts
import { createExpressAccount, createAccountOnboardingLink } from "@/lib/stripe/connect";
```
(Keep the existing `getStripe` import from connect.ts.)

- [ ] **Step 3: actions.ts action** — add after `disconnectStripe`:
```ts
/** Self-serve Connect onboarding: create (once) an Express account for the
 *  owner's Plus/Pro restaurant and return a hosted onboarding link. */
export async function createStripeConnectOnboardingLink(): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured()) return { error: "Pagamenti non configurati." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };
  const { data: r } = await supabase
    .from("restaurants").select("id, piano, stripe_connect_id").eq("owner_id", user.id).maybeSingle();
  if (!r) return { error: "Nessun ristorante associato." };
  if (r.piano !== "plus" && r.piano !== "pro")
    return { error: "I pagamenti al tavolo sono disponibili dal piano Plus." };
  try {
    const admin = createAdminClient();
    let accountId = r.stripe_connect_id as string | null;
    if (!accountId) {
      const acct = await createExpressAccount({ email: user.email ?? "" });
      accountId = acct.id;
      const { error } = await admin.from("restaurants").update({ stripe_connect_id: accountId }).eq("id", r.id);
      if (error) return { error: "Impossibile salvare l'account. Riprova." };
    }
    const origin = await appOrigin();
    const url = await createAccountOnboardingLink({
      accountId,
      refreshUrl: `${origin}/api/stripe/connect/refresh`,
      returnUrl: `${origin}/api/stripe/connect/return`,
    });
    return { url };
  } catch {
    return { error: "Onboarding non disponibile. Riprova." };
  }
}
```

- [ ] **Step 4: Verify** `npx tsc --noEmit && npm run lint && npm run build`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/stripe/connect.ts src/app/dashboard/actions.ts
git commit -m "Connect: Express account + onboarding-link helpers + createStripeConnectOnboardingLink action"
```

---

### Task 7: Connect return/refresh routes + webhook `account.updated`

**Files:**
- Create: `src/app/api/stripe/connect/return/route.ts`
- Create: `src/app/api/stripe/connect/refresh/route.ts`
- Modify: `src/app/api/stripe/connect-webhook/route.ts` (add `account.updated`)

**Interfaces:**
- Consumes: `getOwnedRestaurant` (`@/lib/auth`), `accountChargesEnabled`/`createAccountOnboardingLink` (Task 6), `appOrigin`, `isStripeConfigured`.

- [ ] **Step 1: return route** — `src/app/api/stripe/connect/return/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountChargesEnabled } from "@/lib/stripe/connect";
import { isStripeConfigured } from "@/lib/env";
import { appOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/** Browser return from Stripe Express onboarding. Re-checks charges_enabled and
 *  flips pagamenti_attivi; the webhook (account.updated) is the async backstop. */
export async function GET() {
  const origin = await appOrigin();
  const dash = `${origin}/dashboard/funzionalita`;
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) return NextResponse.redirect(`${origin}/dashboard/login`);
  if (!isStripeConfigured() || !restaurant.stripe_connect_id) {
    return NextResponse.redirect(`${dash}?connect=incompleto`);
  }
  try {
    if (await accountChargesEnabled(restaurant.stripe_connect_id)) {
      const admin = createAdminClient();
      await admin.from("restaurants").update({ pagamenti_attivi: true }).eq("id", restaurant.id);
      return NextResponse.redirect(`${dash}?connect=ok`);
    }
  } catch {
    /* fall through */
  }
  return NextResponse.redirect(`${dash}?connect=incompleto`);
}
```

- [ ] **Step 2: refresh route** — `src/app/api/stripe/connect/refresh/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/env";
import { appOrigin } from "@/lib/origin";
import { createAccountOnboardingLink } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

/** Re-issue an onboarding link (AccountLinks expire) and bounce the user back in. */
export async function GET() {
  const origin = await appOrigin();
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) return NextResponse.redirect(`${origin}/dashboard/login`);
  if (!isStripeConfigured() || !restaurant.stripe_connect_id) {
    return NextResponse.redirect(`${origin}/dashboard/funzionalita?connect=incompleto`);
  }
  try {
    const url = await createAccountOnboardingLink({
      accountId: restaurant.stripe_connect_id,
      refreshUrl: `${origin}/api/stripe/connect/refresh`,
      returnUrl: `${origin}/api/stripe/connect/return`,
    });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(`${origin}/dashboard/funzionalita?connect=incompleto`);
  }
}
```

- [ ] **Step 3: webhook `account.updated`** — in `src/app/api/stripe/connect-webhook/route.ts`, add this case to the `switch (event.type)` (immediately before `default:`):
```ts
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        if (acct.charges_enabled) {
          const { error } = await admin
            .from("restaurants")
            .update({ pagamenti_attivi: true })
            .eq("stripe_connect_id", acct.id);
          if (error) throw new Error(`account.updated: ${error.message}`);
        }
        break;
      }
```

- [ ] **Step 4: Verify** `npx tsc --noEmit && npm run lint && npm run build`.

- [ ] **Step 5: Commit**
```bash
git add src/app/api/stripe/connect/return/route.ts src/app/api/stripe/connect/refresh/route.ts src/app/api/stripe/connect-webhook/route.ts
git commit -m "Connect: onboarding return/refresh routes + account.updated webhook activation"
```

---

### Task 8: PagamentiSettings UI — "Connetti con Stripe"

**Files:**
- Modify: `src/app/dashboard/(app)/funzionalita/PagamentiSettings.tsx`
- Modify: `src/app/dashboard/(app)/funzionalita/page.tsx` (pass the onboarding action)

**Interfaces:**
- Consumes: `createStripeConnectOnboardingLink` (Task 6), `disconnectStripe` (existing).

- [ ] **Step 1: Rewrite PagamentiSettings** — replace `src/app/dashboard/(app)/funzionalita/PagamentiSettings.tsx` with:
```tsx
"use client";

import { useState, useTransition } from "react";

export default function PagamentiSettings({
  piano,
  stripeConnectId,
  pagamentiAttivi,
  pagamentiTest,
  onboard,
  disconnect,
}: {
  piano: string;
  stripeConnectId: string | null;
  pagamentiAttivi: boolean;
  pagamentiTest: boolean;
  onboard: () => Promise<{ url: string } | { error: string }>;
  disconnect: () => Promise<void>;
}) {
  const hasPlan = piano === "plus" || piano === "pro";
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function doOnboard() {
    setMsg(null);
    startTransition(async () => {
      const res = await onboard();
      if ("url" in res) window.location.href = res.url;
      else setMsg(res.error);
    });
  }
  function doDisconnect() {
    setMsg(null);
    startTransition(async () => {
      try {
        await disconnect();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  if (!hasPlan) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        I pagamenti al tavolo sono inclusi dal piano <b>Plus</b>. Fai l’upgrade per incassare
        online direttamente sul tuo conto.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 text-xs font-medium text-neutral-500">
        Pagamenti al tavolo (Stripe Connect)
      </div>
      <span
        className="mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{
          background: pagamentiTest ? "#fef3c7" : "#dcfce7",
          color: pagamentiTest ? "#92400e" : "#166534",
        }}
      >
        {pagamentiTest ? "Modalità test — pagamenti simulati" : "Pagamenti reali attivi"}
      </span>

      {stripeConnectId && pagamentiAttivi ? (
        <div className="text-sm">
          <div>Incassi al tavolo <b className="text-green-700">attivi</b> ✓</div>
          <button
            onClick={doDisconnect}
            disabled={pending}
            className="mt-2 text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            Scollega
          </button>
        </div>
      ) : stripeConnectId ? (
        <div>
          <p className="mb-2 text-sm text-neutral-600">
            Onboarding non ancora completato. Completa la procedura su Stripe per iniziare a
            incassare.
          </p>
          <button
            onClick={doOnboard}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "…" : "Completa su Stripe"}
          </button>
          <button
            onClick={doDisconnect}
            disabled={pending}
            className="ml-3 text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            Scollega
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm text-neutral-600">
            Collega il tuo conto Stripe: la procedura guidata ti chiede i dati dell’attività e
            l’IBAN per i bonifici. Gli incassi al tavolo arriveranno direttamente sul tuo conto.
          </p>
          <button
            onClick={doOnboard}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "…" : "Connetti con Stripe"}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-red-500">{msg}</p>}
      <p className="mt-2 text-[11px] text-neutral-400">
        La modalità test (pagamenti finti o reali) è gestita dall’amministratore.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Wire the action** — in `src/app/dashboard/(app)/funzionalita/page.tsx`: change the actions import to drop `connectStripe` and add `createStripeConnectOnboardingLink`, and change the `<PagamentiSettings>` props from `connect={connectStripe}` to `onboard={createStripeConnectOnboardingLink}` (keep `disconnect={disconnectStripe}`). The import block (currently importing `connectStripe, disconnectStripe`) becomes:
```ts
  createStripeConnectOnboardingLink,
  disconnectStripe,
```
and the element:
```tsx
        <PagamentiSettings
          piano={restaurant.piano}
          stripeConnectId={restaurant.stripe_connect_id}
          pagamentiAttivi={restaurant.pagamenti_attivi}
          pagamentiTest={restaurant.pagamenti_test}
          onboard={createStripeConnectOnboardingLink}
          disconnect={disconnectStripe}
        />
```
(Keep `connectStripe` exported in actions.ts as an admin/manual fallback — just no longer wired here.)

- [ ] **Step 3: Verify** `npx tsc --noEmit && npm run lint && npm run build`.

- [ ] **Step 4: Commit**
```bash
git add "src/app/dashboard/(app)/funzionalita/PagamentiSettings.tsx" "src/app/dashboard/(app)/funzionalita/page.tsx"
git commit -m "Connect: 'Connetti con Stripe' onboarding button (replaces manual acct_ paste)"
```

---

## Manual e2e (after all tasks)

Stripe-touching paths need **test keys** + `stripe listen` on **both** endpoints. After the one-time Stripe setup (Products/Prices → `STRIPE_PRICE_*`; Customer Portal activated; Connect `account.updated` event enabled):
- **Billing:** signup → redirect to subscription Checkout → pay `4242…` → `invoice.paid` → tenant `attivo:true`, `piano`/`abbonamento_stato`/`abbonamento_rinnovo` populated; dashboard "Gestisci abbonamento" → portal; change plan in portal → `customer.subscription.updated` → `piano` synced; cancel → `attivo:false`.
- **Connect:** Plus/Pro dashboard → "Connetti con Stripe" → Express onboarding (test data) → return → `pagamenti_attivi:true`; then a table order pays via the existing Checkout flow.
- **No Stripe:** signup still works (`attivo:true` simulated), CTAs hidden.

## Verification per task

`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build`. Migration `0046` must be `supabase db push`ed before deploy. Stripe Products/Prices, Customer Portal, and the Connect `account.updated` event must be configured in the Stripe dashboard.
