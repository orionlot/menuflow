# Security & RLS audit — MenuFlow

_Point-in-time review of the running code. Re-run after any schema, RLS, or auth
change. Last reviewed: 2026-06-12._

Scope: Row Level Security, server-action authorization, the Stripe webhooks, the
service-role surface, public endpoints, and what the public menu exposes.

## Posture summary

| Area | Status | Notes |
|------|--------|-------|
| RLS enabled | ✅ | `restaurants`, `menu_items`, `orders`, `custom_domains` all `enable row level security` (0001). Anon has **no** table policy → no direct anon reads/writes. |
| Tenant isolation | ✅ | Every owner policy keys on `restaurants.owner_id = auth.uid()`; `menu_items`/`orders` join back to the owning restaurant. |
| `restaurants` writes | ✅ | Owner has **SELECT only**; plan/payment/branding writes go through service-role actions that derive the target id from the owner, never the client. |
| Storage | ✅ | Public **read** only; the permissive authenticated insert/update/delete policies were dropped in 0005. Uploads go through a service-role action that checks ownership + size. |
| Stripe Connect webhook | ✅ | Verifies signature with its own secret; sole source of payment truth (client success callback never trusted). |
| Stripe Billing webhook | ✅ | Verifies signature with a **separate** secret; drives suspend/activate. Shares no code/model with Connect. |
| Server-side total | ✅ | `priceCartServerSide` recomputes from DB prices + validated option deltas; client total never trusted. Now unit-tested (`pricing-core.test.ts`). |
| Admin actions | ✅ | Every mutation in `admin/actions.ts` calls `requireAdmin()` first. |
| Public menu exposure | ✅ | `SAFE_RESTAURANT_COLUMNS` excludes `stripe_*`, `telegram_*`, `owner_id`, `pagamenti_test`. |
| Rate limiting | ✅* | Distributed via Upstash Redis when configured; per-instance in-memory fallback otherwise. *Set `UPSTASH_*` in any multi-instance (Vercel) deploy. |
| Payment idempotency | ✅ | `markOrderPaid` flips the row race-safely and notifies exactly once (see Findings). |

## Authorization model (server actions)

Two safe patterns, applied consistently:

1. **RLS-scoped (anon+cookie client).** `menu_items` and `orders` mutations accept
   an id from the client but rely on the RLS policy to reject rows the caller
   doesn't own — a forged id simply matches 0 rows. Used by `updateItem`,
   `deleteItem`, `duplicateItem`, `reorderItems`, `toggleScontrino`, and the
   kitchen markers.

2. **Owner-derived (service-role client).** `restaurants` has no owner UPDATE
   policy by design (plan/payment flags are platform-managed). Owner writes use
   the service role, but the target id always comes from `ownerRestaurantId()` /
   an `owner_id = auth.uid()` lookup — never a client-supplied id. Used by
   `updateBranding`, `updateFunzionalita`, `updateOrari`, `updateTelegram`,
   `updateAggiunte`, `connectStripe` (gated to plus/pro), `disconnectStripe`.

Neither pattern lets an authenticated restaurateur read or write another tenant's
data.

## Findings

### Fixed in this pass
- **Payment notification could double-fire under duplicate webhook delivery.**
  Stripe may deliver `payment_intent.succeeded` more than once. The old
  `markOrderPaid` checked `stato === 'pagato'` then updated unconditionally, so
  two concurrent deliveries could both pass the check and both notify the
  Payments bot. The UPDATE now carries `neq('stato','pagato')`: Postgres
  row-locking lets only one delivery win; the other matches 0 rows and returns
  without re-notifying. (`src/lib/orders.ts`)

### Accepted / by design
- **Vote endpoint (`/api/ordine/[id]/voto`) is unauthenticated.** A customer
  action keyed on the order's UUID, capped 1–5, write-once, rate-limited.
  Guessing a v4 UUID is infeasible and the impact (one star rating) is
  negligible.
- **Public read flags.** `pagamenti_attivi`, `piano`, `funzionalita*` are exposed
  to the menu because the UI needs them; no secret is among the safe columns.
- **In-memory rate-limit fallback.** Fine for single-instance/local; configure
  Upstash for multi-instance deploys.

## Pre-deploy checklist
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is a server-only env (never `NEXT_PUBLIC_*`).
- [ ] `ADMIN_EMAILS` set to the real platform-owner address(es).
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` and `STRIPE_BILLING_WEBHOOK_SECRET` are the
      two **distinct** signing secrets from the two webhook endpoints.
- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` set so rate limits hold
      across serverless instances.
- [ ] `ROOT_DOMAIN` equals the deployed apex host (so wildcard subdomains route).
- [ ] Stripe dashboard webhooks point at `/api/stripe/connect-webhook` and
      `/api/stripe/billing-webhook` respectively.
- [ ] Supabase: RLS stays **ON** for all four tables (never disabled for debugging).
