# Checkout pagamenti cliente (carte + Apple Pay + Google Pay) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the diner a real hosted Stripe Checkout payment screen (cards + Apple Pay + Google Pay) for table orders, on the existing Connect account, replacing the unused PaymentIntent flow.

**Architecture:** On order submit (payments on, not pay-at-counter), `api/ordine` keeps creating the order `in_attesa_pagamento` with a server-recomputed `totale`, then creates a **hosted Checkout Session on the restaurant's connected account** and returns its URL; the client redirects. Payment truth comes only from the `connect-webhook` (`checkout.session.completed` → `pagato`). A "Paga ora" button on the order tracker re-creates a session for orders still awaiting/failed payment (expiring the prior session first to avoid double charge).

**Tech Stack:** Next.js 15 App Router (route handlers + server components), TypeScript strict, Supabase (service-role admin client), `stripe` Node SDK, Vitest.

## Global Constraints

- **Connect ≠ Billing, never mixed.** All changes live in `connect-webhook` / `lib/stripe/connect.ts` / `lib/stripe/checkout-order.ts`. Never touch subscriptions or `billing.ts`.
- **Charge on the connected account, platform fee = 0.** Every Stripe call targets `{ stripeAccount: restaurant.stripe_connect_id }`; never set `application_fee_amount`.
- **Server-side total only.** The Checkout amount is `Math.round(Number(order.totale) * 100)` (the total computed by `priceCartServerSide` at creation). The client never supplies an amount.
- **"Pagato" only from the webhook.** `success_url` marks nothing; `stato` becomes `pagato` exclusively via `checkout.session.completed` → `markOrderPaid`.
- **Idempotency preserved.** The webhook keeps the `stripe_events` dedupe and `markOrderPaid` race-safe transition unchanged.
- **No fiscal receipt.** Unchanged.
- **Italian user-facing strings.** All new copy in Italian.
- **No localStorage/sessionStorage.** Unchanged (client only redirects / calls fetch).
- **Migrations additive + mirror `src/types/db.ts`** by hand.
- **No `Co-Authored-By` trailer** on commits.

---

### Task 1: Schema + type — `orders.stripe_checkout_session`

**Files:**
- Create: `supabase/migrations/0045_order_checkout_session.sql`
- Modify: `src/types/db.ts:375` (add field right after `stripe_payment_intent`)

**Interfaces:**
- Produces: `Order.stripe_checkout_session: string | null` (consumed by Tasks 4 & 5).

- [ ] **Step 1: Write the migration**

`supabase/migrations/0045_order_checkout_session.sql`:
```sql
-- Hosted Stripe Checkout for customer table payments: track the latest open
-- Checkout Session id per order so a "Paga ora" retry can EXPIRE the previous
-- session before creating a new one (prevents a stale abandoned session from
-- being completed later → double charge). Additive, nullable. The paid
-- PaymentIntent id continues to live in orders.stripe_payment_intent.
alter table public.orders
  add column if not exists stripe_checkout_session text;
```

- [ ] **Step 2: Mirror the column in the hand-maintained types**

In `src/types/db.ts`, immediately after the line `stripe_payment_intent: string | null;` (line 375), add:
```ts
  /** Latest open Stripe Checkout Session id (hosted customer payment). Used to
   *  expire a stale session on a "Paga ora" retry so an order is never double-charged. */
  stripe_checkout_session: string | null;
```

- [ ] **Step 3: Apply the migration locally**

Run: `npm run db:reset` (recreates DB + applies all migrations + seed), then re-seed auth users: `node --env-file=.env.local scripts/seed-users.mjs`.
Expected: no SQL error; `orders` now has a `stripe_checkout_session` column.
(If Docker is down, skip the apply and verify the SQL is syntactically additive; it must be `supabase db push`ed before deploy.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Reads use `as Order` casts / `select("*")`, so the new field needs no changes there. If tsc reports any full `Order` object literal missing the property, add `stripe_checkout_session: null` to it (mirrors the existing `stripe_payment_intent: null` handling).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0045_order_checkout_session.sql src/types/db.ts
git commit -m "Checkout: add orders.stripe_checkout_session (migration 0045 + type)"
```

---

### Task 2: Stripe Checkout primitives in `connect.ts` (+ unit tests)

**Files:**
- Modify: `src/lib/stripe/connect.ts` (add functions; keep `createConnectPaymentIntent` for now — Task 4 removes it)
- Create: `src/lib/stripe/connect.test.ts`

**Interfaces:**
- Consumes: `getStripe()` (existing in the same file).
- Produces:
  - `type CheckoutParamsInput = { orderId: string; restaurantId: string; restaurantName: string; tavolo?: string | null; totaleCents: number; successUrl: string; cancelUrl: string }`
  - `buildCheckoutParams(input: CheckoutParamsInput): Stripe.Checkout.SessionCreateParams`
  - `checkoutSessionPaidArgs(session): { orderId?: string; paidAmountCents?: number; currency?: string; paymentIntentId?: string }`
  - `createConnectCheckoutSession(input: CheckoutParamsInput & { connectedAccountId: string }): Promise<Stripe.Checkout.Session>`
  - `expireConnectCheckoutSession(sessionId: string, connectedAccountId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

`src/lib/stripe/connect.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildCheckoutParams, checkoutSessionPaidArgs } from "@/lib/stripe/connect";

const base = {
  orderId: "ord-1",
  restaurantId: "rest-1",
  restaurantName: "Trattoria Da Test",
  tavolo: "5" as string | null,
  totaleCents: 4500,
  successUrl: "https://x.it/ordine/ord-1?pagato=1",
  cancelUrl: "https://x.it/ordine/ord-1",
};

describe("buildCheckoutParams", () => {
  it("builds a single EUR line item for the recomputed total", () => {
    const p = buildCheckoutParams(base);
    expect(p.mode).toBe("payment");
    expect(p.locale).toBe("it");
    expect(p.line_items).toHaveLength(1);
    const li = p.line_items![0];
    expect(li.quantity).toBe(1);
    expect(li.price_data!.currency).toBe("eur");
    expect(li.price_data!.unit_amount).toBe(4500);
  });

  it("carries order_id in BOTH session and payment_intent metadata", () => {
    const p = buildCheckoutParams(base);
    expect(p.metadata!.order_id).toBe("ord-1");
    expect(p.metadata!.restaurant_id).toBe("rest-1");
    expect(p.payment_intent_data!.metadata!.order_id).toBe("ord-1");
  });

  it("uses the given urls, sets no platform fee, and no explicit method list", () => {
    const p = buildCheckoutParams(base);
    expect(p.success_url).toBe(base.successUrl);
    expect(p.cancel_url).toBe(base.cancelUrl);
    expect(p.payment_intent_data!.application_fee_amount).toBeUndefined();
    expect(p.payment_method_types).toBeUndefined();
  });

  it("includes the table in the product name, and omits it when null", () => {
    expect(buildCheckoutParams(base).line_items![0].price_data!.product_data!.name)
      .toBe("Ordine — Trattoria Da Test · Tavolo 5");
    expect(buildCheckoutParams({ ...base, tavolo: null }).line_items![0].price_data!.product_data!.name)
      .toBe("Ordine — Trattoria Da Test");
  });
});

describe("checkoutSessionPaidArgs", () => {
  it("extracts orderId, amount, currency and PI id (string PI)", () => {
    expect(
      checkoutSessionPaidArgs({
        metadata: { order_id: "ord-9" },
        amount_total: 4500,
        currency: "eur",
        payment_intent: "pi_123",
      }),
    ).toEqual({ orderId: "ord-9", paidAmountCents: 4500, currency: "eur", paymentIntentId: "pi_123" });
  });

  it("handles an expanded payment_intent object and missing amount", () => {
    const args = checkoutSessionPaidArgs({
      metadata: { order_id: "ord-9" },
      amount_total: null,
      currency: null,
      payment_intent: { id: "pi_obj" },
    });
    expect(args.paymentIntentId).toBe("pi_obj");
    expect(args.paidAmountCents).toBeUndefined();
    expect(args.currency).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/stripe/connect.test.ts`
Expected: FAIL — `buildCheckoutParams`/`checkoutSessionPaidArgs` are not exported.

- [ ] **Step 3: Implement the functions**

In `src/lib/stripe/connect.ts`, after the existing `createConnectPaymentIntent` (before the `CONNECT_WEBHOOK_SECRET` export), add:
```ts
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

/** Best-effort expire a still-open session (already-completed/expired → ignored). */
export async function expireConnectCheckoutSession(
  sessionId: string,
  connectedAccountId: string,
): Promise<void> {
  try {
    await getStripe().checkout.sessions.expire(sessionId, {}, { stripeAccount: connectedAccountId });
  } catch {
    /* a completed/expired session can't be expired again — not an error here */
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/stripe/connect.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe/connect.ts src/lib/stripe/connect.test.ts
git commit -m "Checkout: Stripe Connect Checkout Session builders + tests"
```

---

### Task 3: `markOrderFailed` by orderId + webhook Checkout events

**Files:**
- Modify: `src/lib/orders.ts:96-106` (`markOrderFailed` signature)
- Modify: `src/app/api/stripe/connect-webhook/route.ts` (new cases + updated failed call)

**Interfaces:**
- Consumes: `markOrderPaid` (existing), `checkoutSessionPaidArgs` (Task 2).
- Produces: `markOrderFailed(admin, opts: { orderId?: string; paymentIntentId?: string }): Promise<void>`

- [ ] **Step 1: Rewrite `markOrderFailed` to accept orderId or paymentIntentId**

Replace `src/lib/orders.ts:95-106` with:
```ts
/** Transition an order to `fallito` (payment failed/expired). Never notifies as
 *  paid. Match by order id OR PaymentIntent id; never downgrades a paid order. */
export async function markOrderFailed(
  admin: SupabaseClient,
  opts: { orderId?: string; paymentIntentId?: string },
): Promise<void> {
  let q = admin.from("orders").update({ stato: "fallito" });
  if (opts.orderId) q = q.eq("id", opts.orderId);
  else if (opts.paymentIntentId) q = q.eq("stripe_payment_intent", opts.paymentIntentId);
  else throw new Error("markOrderFailed: orderId or paymentIntentId required");
  const { error } = await q.neq("stato", "pagato");
  if (error) throw new Error(`markOrderFailed: ${error.message}`);
}
```

- [ ] **Step 2: Update the webhook import**

In `src/app/api/stripe/connect-webhook/route.ts`, change the connect import (line 4) to also import the parser:
```ts
import { getStripe, CONNECT_WEBHOOK_SECRET, checkoutSessionPaidArgs } from "@/lib/stripe/connect";
```

- [ ] **Step 3: Update the `payment_intent.payment_failed` call and add the Checkout cases**

In the `switch (event.type)` block, change the failed case to the new signature and add two cases. The block becomes:
```ts
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markOrderPaid(admin, {
          paymentIntentId: pi.id,
          paidAmountCents: pi.amount_received ?? pi.amount,
          currency: pi.currency,
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await markOrderFailed(admin, { paymentIntentId: pi.id });
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const args = checkoutSessionPaidArgs(session);
        if (!args.orderId) break;
        // Persist the PaymentIntent id for reconciliation, then mark paid. Truth
        // of "paid" is this webhook; the amount/currency are asserted in markOrderPaid.
        if (args.paymentIntentId) {
          await admin
            .from("orders")
            .update({ stripe_payment_intent: args.paymentIntentId })
            .eq("id", args.orderId);
        }
        await markOrderPaid(admin, {
          orderId: args.orderId,
          paidAmountCents: args.paidAmountCents,
          currency: args.currency,
        });
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;
        if (orderId) await markOrderFailed(admin, { orderId });
        break;
      }
      default:
        break;
```

- [ ] **Step 4: Type-check + lint + full test suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: PASS (no behavioral unit test here — the parsing is covered by Task 2's `checkoutSessionPaidArgs` tests; the webhook/DB path is verified by the manual e2e recipe). Confirm no other caller of `markOrderFailed` broke (grep: only this webhook calls it).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders.ts src/app/api/stripe/connect-webhook/route.ts
git commit -m "Checkout: webhook handles checkout.session.completed/expired; markOrderFailed by orderId"
```

---

### Task 4: Order-aware orchestrator + wire `api/ordine` case B

**Files:**
- Create: `src/lib/stripe/checkout-order.ts`
- Modify: `src/app/api/ordine/route.ts` (imports line 15-16; case B block lines 375-396)
- Modify: `src/lib/stripe/connect.ts` (remove now-unused `createConnectPaymentIntent`)

**Interfaces:**
- Consumes: `createConnectCheckoutSession`, `expireConnectCheckoutSession` (Task 2); `Order`, `Restaurant` (`src/types/db`); `appOrigin` (`src/lib/origin`).
- Produces: `checkoutForOrder(admin: SupabaseClient, args: { order: Order; restaurant: Restaurant; origin: string }): Promise<string | null>` (returns the hosted Checkout URL or null). Consumed by Task 5.

- [ ] **Step 1: Write the orchestrator**

`src/lib/stripe/checkout-order.ts`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, Restaurant } from "@/types/db";
import {
  createConnectCheckoutSession,
  expireConnectCheckoutSession,
} from "@/lib/stripe/connect";

/**
 * Create a hosted Checkout Session for an order awaiting online payment, on the
 * restaurant's connected account, and persist the session id on the order. If the
 * order already has an open session (an earlier attempt / "Paga ora"), it is
 * expired first so only ONE session can ever complete → no double charge.
 *
 * The amount is `order.totale` — the server-recomputed total written at creation;
 * the client never supplies it. Returns the hosted URL (or null if Stripe gave
 * none / the restaurant has no connected account).
 */
export async function checkoutForOrder(
  admin: SupabaseClient,
  args: { order: Order; restaurant: Restaurant; origin: string },
): Promise<string | null> {
  const { order, restaurant, origin } = args;
  if (!restaurant.stripe_connect_id) return null;

  if (order.stripe_checkout_session) {
    await expireConnectCheckoutSession(order.stripe_checkout_session, restaurant.stripe_connect_id);
  }

  const base = `${origin.replace(/\/+$/, "")}/ordine/${order.id}`;
  const session = await createConnectCheckoutSession({
    orderId: order.id,
    restaurantId: restaurant.id,
    restaurantName: restaurant.nome,
    tavolo: order.tavolo,
    totaleCents: Math.round(Number(order.totale) * 100),
    successUrl: `${base}?pagato=1`,
    cancelUrl: base,
    connectedAccountId: restaurant.stripe_connect_id,
  });

  await admin.from("orders").update({ stripe_checkout_session: session.id }).eq("id", order.id);
  return session.url;
}
```

- [ ] **Step 2: Wire `api/ordine` case B to the orchestrator**

In `src/app/api/ordine/route.ts`:

(a) Replace the import line 15 (`import { createConnectPaymentIntent } from "@/lib/stripe/connect";`) with:
```ts
import { checkoutForOrder } from "@/lib/stripe/checkout-order";
import { appOrigin } from "@/lib/origin";
```

(b) Replace the real-Stripe block (current lines 375-396) with:
```ts
    if (!restaurant.pagamenti_test && isStripeConfigured() && restaurant.stripe_connect_id) {
      const checkoutUrl = await checkoutForOrder(admin, {
        order,
        restaurant,
        origin: await appOrigin(),
      });
      return NextResponse.json({ ok: true, mode: "payment", orderId: order.id, checkoutUrl });
    }
```
(The subsequent test-mode `return NextResponse.json({ ... devSimulateAvailable ... })` block stays unchanged.)

- [ ] **Step 3: Remove the now-unused PaymentIntent helper**

In `src/lib/stripe/connect.ts`, delete the entire `createConnectPaymentIntent` function (the `export async function createConnectPaymentIntent(...) { ... }` block). Keep `getStripe`, the new Checkout functions, and `CONNECT_WEBHOOK_SECRET`.

- [ ] **Step 4: Verify nothing else imports the removed helper**

Run: `grep -rn "createConnectPaymentIntent" src/`
Expected: no matches.

- [ ] **Step 5: Type-check + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stripe/checkout-order.ts src/app/api/ordine/route.ts src/lib/stripe/connect.ts
git commit -m "Checkout: api/ordine creates hosted Checkout Session (orchestrator); drop PaymentIntent path"
```

---

### Task 5: "Paga ora" retry endpoint

**Files:**
- Create: `src/app/api/ordine/[id]/pay/route.ts`

**Interfaces:**
- Consumes: `checkoutForOrder` (Task 4); `appOrigin`, `isStripeConfigured`, `hitRateLimit`/`clientIp`, `createAdminClient`, `Order`/`Restaurant`.
- Produces: `POST /api/ordine/{id}/pay` → `{ ok:true, mode:"payment", checkoutUrl }` | `{ ok:true, devSimulateAvailable:true }` | `{ ok:false, error }`.

- [ ] **Step 1: Write the route**

`src/app/api/ordine/[id]/pay/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/env";
import { appOrigin } from "@/lib/origin";
import { checkoutForOrder } from "@/lib/stripe/checkout-order";
import { hitRateLimit, clientIp } from "@/lib/ratelimit";
import type { Order, Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Paga ora" / retry: (re)create a hosted Checkout Session for an order still
 * awaiting payment (or whose previous attempt failed/expired). Delegates to
 * checkoutForOrder, which expires any prior open session first (no double charge).
 * Truth of "paid" stays the webhook; this only produces a payment URL.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await hitRateLimit(`ordine-pay:${clientIp(req.headers)}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "Troppe richieste." }, { status: 429 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
  }

  const { data: orderRow } = await admin.from("orders").select("*").eq("id", id).maybeSingle();
  const order = orderRow as Order | null;
  if (!order) return NextResponse.json({ ok: false, error: "Ordine non trovato." }, { status: 404 });
  if (order.stato !== "in_attesa_pagamento" && order.stato !== "fallito") {
    return NextResponse.json({ ok: false, error: "Ordine non pagabile." }, { status: 409 });
  }

  const { data: restRow } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", order.restaurant_id)
    .maybeSingle();
  const restaurant = restRow as Restaurant | null;
  if (!restaurant || !restaurant.pagamenti_attivi) {
    return NextResponse.json({ ok: false, error: "Pagamenti non disponibili." }, { status: 409 });
  }

  if (!restaurant.pagamenti_test && isStripeConfigured() && restaurant.stripe_connect_id) {
    try {
      const checkoutUrl = await checkoutForOrder(admin, { order, restaurant, origin: await appOrigin() });
      return NextResponse.json({ ok: true, mode: "payment", checkoutUrl });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Pagamento non disponibile. Riprova." },
        { status: 503 },
      );
    }
  }

  // Test mode / no real Stripe: let the dev simulator complete it instead.
  return NextResponse.json({
    ok: true,
    devSimulateAvailable: restaurant.pagamenti_test || process.env.NODE_ENV !== "production",
  });
}
```

- [ ] **Step 2: Type-check + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ordine/[id]/pay/route.ts
git commit -m "Checkout: 'Paga ora' retry endpoint (recreate session, expire prior)"
```

---

### Task 6: Client redirect to hosted Checkout (MenuClient)

**Files:**
- Modify: `src/app/[domain]/MenuClient.tsx:728-738` (the `data.mode === "payment"` branch)

**Interfaces:**
- Consumes: the `api/ordine` response `{ mode:"payment", orderId, checkoutUrl?, devSimulateAvailable? }`.

- [ ] **Step 1: Redirect when a checkout URL is present**

Replace the `if (data.mode === "payment") { ... } else { ... }` block (lines 728-738) with:
```ts
      if (data.mode === "payment") {
        // Real Stripe → hosted Checkout: redirect the diner to pay (cards +
        // Apple Pay + Google Pay). Truth of "paid" comes from the webhook.
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        // Test mode / no Stripe → keep the in-app simulator overlay.
        setSheet(false);
        setPending({ orderId: data.orderId, sim: Boolean(data.devSimulateAvailable) });
      } else {
        setSheet(false);
        setStatus("In preparazione");
        setDone({ mode: "placed", orderId: data.orderId });
        setCart({});
        setAllergeniSel([]);
        setSala("");
      }
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[domain]/MenuClient.tsx"
git commit -m "Checkout: client redirects to hosted Stripe Checkout on order submit"
```

---

### Task 7: Order tracker — "Paga ora" + payment-return state

**Files:**
- Modify: `src/app/[domain]/ordine/[id]/page.tsx` (read `searchParams.pagato`, pass `paymentReturn`)
- Modify: `src/app/[domain]/ordine/[id]/OrderTracker.tsx` (pay handler, button, processing copy, poll guard, immediate poll)

**Interfaces:**
- Consumes: `POST /api/ordine/{id}/pay` (Task 5); `POST /api/dev/simulate-payment` (existing) for the dev/test path.

- [ ] **Step 1: Pass the payment-return flag from the page**

In `src/app/[domain]/ordine/[id]/page.tsx`:

(a) Change the `Params` type (line 9) to:
```ts
type Params = {
  params: Promise<{ domain: string; id: string }>;
  searchParams: Promise<{ pagato?: string }>;
};
```

(b) Change the function signature + read searchParams (lines 38-39):
```ts
export default async function OrdineTrackingPage({ params, searchParams }: Params) {
  const { domain, id } = await params;
  const sp = await searchParams;
```

(c) Add the prop to the `<OrderTracker .../>` element (after `perDishOn=...`, line 108):
```ts
      paymentReturn={sp?.pagato === "1"}
```

- [ ] **Step 2: Add the prop, pay handler, immediate poll, and revised poll guard to OrderTracker**

In `src/app/[domain]/ordine/[id]/OrderTracker.tsx`:

(a) Add `paymentReturn` to the props (after `perDishOn = true,`) and its type (after `perDishOn?: boolean;`):
```ts
  paymentReturn = false,
```
```ts
  paymentReturn?: boolean;
```

(b) Add a `paying` state next to the existing `now` state (after line 89 `const [now, setNow] = useState(() => Date.now());`):
```ts
  const [paying, setPaying] = useState(false);
  async function pay() {
    setPaying(true);
    try {
      const r = await fetch(`/api/ordine/${o.id}/pay`, { method: "POST" });
      const d = await r.json();
      if (d.ok && d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      if (d.ok && d.devSimulateAvailable) {
        await fetch(`/api/dev/simulate-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: o.id }),
        });
        window.location.reload();
        return;
      }
    } catch {
      /* keep state; user can retry */
    }
    setPaying(false);
  }
```

(c) In the poll effect, change the early-return guard (line 96) so a just-returned-from-payment order keeps polling even from `fallito`, and add an immediate poll. Replace:
```ts
    if (o.fase === "servito" || o.fase === "fallito") return;
    let alive = true;
```
with:
```ts
    if (o.fase === "servito" || (o.fase === "fallito" && !paymentReturn)) return;
    let alive = true;
```
and immediately before `const t = setInterval(...)` (line 119), add an eager first poll:
```ts
    load();
```
Also add `paymentReturn` to that effect's dependency array (line 130): `}, [initial.id, o.fase, paymentReturn]);`

(d) Replace the `fallito` and `attesa_pagamento` branches (lines 171-186) with versions that offer "Paga ora":
```tsx
        {o.fase === "fallito" ? (
          <div className="mt-6 rounded-2xl border p-5 text-center" style={{ background: p.surface, borderColor: p.surfaceBorder }}>
            <p className="text-lg font-semibold text-red-600">Pagamento non riuscito</p>
            <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
              Puoi riprovare il pagamento qui sotto.
            </p>
            <button
              onClick={pay}
              disabled={paying}
              className="mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-60"
              style={{ background: p.brand, color: p.onBrand }}
            >
              {paying ? "…" : "Paga ora"}
            </button>
          </div>
        ) : o.fase === "attesa_pagamento" ? (
          <div className="mt-6 rounded-2xl border p-5 text-center" style={{ background: p.surface, borderColor: p.surfaceBorder }}>
            {paymentReturn ? (
              <>
                <p className="text-lg font-semibold" style={{ color: p.text }}>Pagamento in elaborazione…</p>
                <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
                  Attendi qualche secondo, stiamo confermando il pagamento.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold" style={{ color: p.text }}>In attesa di pagamento</p>
                <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
                  Completa il pagamento per inviare l&apos;ordine in cucina.
                </p>
              </>
            )}
            <button
              onClick={pay}
              disabled={paying}
              className="mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-60"
              style={{ background: p.brand, color: p.onBrand }}
            >
              {paying ? "…" : "Paga ora"}
            </button>
          </div>
        ) : (
```

- [ ] **Step 3: Type-check + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[domain]/ordine/[id]/page.tsx" "src/app/[domain]/ordine/[id]/OrderTracker.tsx"
git commit -m "Checkout: tracker shows 'Paga ora' + payment-in-progress state"
```

---

## Manual e2e recipe (after all tasks)

Stripe-touching paths have no unit harness (no Supabase/Stripe mock in this repo); verify end-to-end against **Stripe test keys**:

1. In `.env.local` set `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_CONNECT_WEBHOOK_SECRET=whsec_…` (from `stripe listen`), and ensure a tenant has `pagamenti_attivi=true`, `pagamenti_test=false`, and a real **test-mode** `stripe_connect_id` (a connected test account).
2. `npm run dev`; in another shell: `stripe listen --forward-to localhost:3000/api/stripe/connect-webhook`.
3. On the tenant menu, add items → "Vai al pagamento" → confirm the redirect to Stripe Checkout shows **carta + Apple Pay / Google Pay**; pay with `4242 4242 4242 4242`.
4. Verify: webhook `checkout.session.completed` received → order flips `in_attesa_pagamento → pagato`, Payments bot notified, `stripe_payment_intent` populated.
5. Cancel flow: start a payment, hit browser back / cancel → land on `/ordine/{id}` → tap **"Paga ora"** → new session opens. Confirm a prior session is expired (only one completes).
6. Amount integrity: confirm `session.amount_total` equals `order.totale*100` (a mismatch makes `markOrderPaid` throw → 500, order NOT marked paid).

Without test keys: the **dev simulator** path is unchanged (`pagamenti_test` or local-no-Stripe) — submit → simulate → `pagato`.

## Verification per task

`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build`. Migration `0045` must be `supabase db push`ed before deploy.
