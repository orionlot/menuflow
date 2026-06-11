# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Runnable end-to-end against a **local Supabase (Docker)**. The running code plus
this file are now the source of truth (the original product briefing has been
removed). [README.md](README.md) has the full local run/test guide and demo
accounts. All six original phases are
implemented and the product has since grown past them — kitchen display,
statistics + CSV export, QR generator, per-tenant branding/theming, allergens,
per-item options and category add-ons, configurable cover charge (coperto) and
tips, Telegram forum topics, and realtime. The schema is now seven additive
migrations (`0001`–`0007`). Stripe and Telegram run as **stubs** until real keys
are added to `.env.local`.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build (also full type-check)
npm run lint         # eslint (flat config via FlatCompat)
npm run db:start     # supabase start (Docker stack)
npm run db:stop      # supabase stop
npm run db:reset     # recreate DB + apply migrations + seed.sql
node --env-file=.env.local scripts/seed-users.mjs   # seed auth users + link owners
```

No test runner yet — verification is manual (README "Cosa provare") plus
`npm run build` for type safety. Tenants are reached locally via `*.localhost`
subdomains, e.g. http://pizzeria-mario.localhost:3000.

## Code map

- `src/middleware.ts` — **must live under `src/`** (src-dir projects ignore a
  root `middleware.ts`). Resolves tenant from Host, rewrites to `app/[domain]`.
- `src/app/[domain]/` — public menu (ISR); `MenuClient.tsx` is the cart/health/lang/options client.
- `src/app/dashboard/(app)/` — restaurateur area (route group guarded by `requireOwner`): `menu/`, `ordini/`, `reconciliation/`, `statistiche/`, `branding/`, `qr/`. `login/` sits outside the group so it isn't guarded.
- `src/app/dashboard/cucina/` — full-screen Kitchen Display, **deliberately outside `(app)`** (no dashboard chrome, full viewport) but still `requireOwner`-guarded.
- `src/app/admin/(app)/` — platform-owner area (guarded by `requireAdmin`).
- `src/app/api/` — `health`, `ordine`, `dashboard/{kitchen,export}` (RLS-scoped live feed + CSV), `dev/simulate-payment` (dev-only), `stripe/{connect,billing}-webhook`.
- Server actions: `src/app/{dashboard,admin}/actions.ts` (mutations) and `src/app/actions/upload.ts` (image upload via service-role).
- `src/lib/` — `supabase/{server,client,admin,middleware}.ts`, `stripe/{connect,billing}.ts`, `telegram.ts`, `pricing.ts` (server-side recompute of items + option deltas), `menu.ts` (option/add-on resolution + input sanitizers), `branding.ts`/`brand.ts` (per-tenant theming), `stats.ts`, `tenant.ts`, `auth.ts`, `orders.ts`, `urls.ts`/`origin.ts` (deployment-origin-aware link building), `config/{plans,allergeni}.ts`, `env.ts` (feature flags).
- `src/types/db.ts` — hand-written types mirroring the schema, **kept in sync manually**.
- `supabase/migrations/` — `0001_init.sql` (schema + RLS + storage bucket) then `0002`–`0007` (all additive). `supabase/seed.sql` — demo data.

Implementation notes: public menu reads and order writes use the **service-role**
client on the server (selecting only safe columns) — anon has no direct table
access; the dashboard uses the **anon+cookie** client so RLS scopes each
restaurateur. `restaurants.owner_id` (added to the briefing schema) is what RLS
keys on. Image uploads go through `src/app/actions/upload.ts` (service-role, after
verifying owner/admin) — clients can no longer write to Storage directly (removed
in `0005`). `orders` and `menu_items` are in the `supabase_realtime` publication
(dashboard + kitchen live updates). The dev payment simulator is hard-disabled
when Stripe is configured.

## Product: MenuFlow

Multi-tenant digital menu + ordering platform for restaurants. **One codebase, one deploy, all tenants.** Adding a customer = inserting a row in `restaurants`, never creating a new site. Each tenant is reached via subdomain `slug.menuflow.it` or a custom domain.

End customer at the table scans a QR → sees menu → orders → optionally pays online. Restaurateur receives the order via Telegram and manages their menu from a dashboard.

## Stack (mandatory)

- Next.js (App Router, TypeScript) on Vercel with wildcard `*.menuflow.it` + custom domains
- Supabase (Postgres + Auth + Storage), **Row Level Security required**
- Stripe **Connect (Express)** for customer→restaurateur payments
- Stripe **Billing** for restaurateur subscription payments to us
- Two separate Telegram bots (Orders + Payments) with different tokens
- No WordPress. No localStorage/sessionStorage. Secrets (Stripe, Supabase service role, Telegram tokens) are server-only.

## Non-negotiable architectural rules

These are core product constraints and must not drift during implementation:

1. **Two Stripe systems, never mixed in code.** Stripe Connect (customer payments to restaurateur's connected account, `application_fee_amount = 0`) and Stripe Billing (our subscription revenue) are separate flows with separate webhooks (`api/stripe/connect-webhook`, `api/stripe/billing-webhook`) and separate signing secrets. Do not share helpers or models between them.

2. **No fiscal receipts.** The restaurateur always issues the fiscal receipt manually with their cash register. The platform must never imply it emits `corrispettivi telematici`. The `orders.scontrino_registrato` flag is a management reminder only — UI must say so explicitly.

3. **Server-side total recomputation.** Never trust prices/totals from the client. Recompute the order total from DB prices before creating any PaymentIntent.

4. **Payment truth comes only from the Stripe webhook**, not from the client's success callback. On `payment_intent.succeeded` → mark `pagato`, notify Payments bot. On `payment_intent.payment_failed` → mark `fallito`, do not notify as paid.

5. **Public menu page is ISR/static** so it stays up if the backend is down. Before submitting an order the client hits `api/health`; on failure show exactly this Italian text and hide the cart: *"App momentaneamente in manutenzione — Si prega di rivolgersi allo staff per l'ordinazione"*. Never show this by default.

6. **Suspended tenant** (`restaurants.attivo=false`) shows *"Servizio temporaneamente non disponibile"* — must NOT look like the restaurant is closed.

7. **Pricing is parametric.** Plan prices (Base 29€, Plus 39€, Pro 59€, Multilingua +10€) live in a single config file, not scattered as magic numbers.

## Routing model

`middleware.ts` resolves tenant from `Host`:
- `*.menuflow.it` → extract slug from subdomain
- Otherwise → look up host in `custom_domains` table
- Rewrite to `app/[domain]/…`; exclude `admin`, `api`, and static assets from rewrite

Three surfaces:
- `app/[domain]/` — public menu (per-tenant, ISR)
- `app/dashboard/` — restaurateur (Supabase auth, RLS-isolated to their own restaurant)
- `app/admin/` — platform owner only

## Data model

Tables: `restaurants`, `menu_items`, `orders`, `custom_domains`. Phase 1 DDL is `0001_init.sql`; `0002`–`0007` extend it additively (`add column if not exists`). **Mirror every schema change in `src/types/db.ts`** — it is hand-maintained. Briefing columns to know: `restaurants.piano`, `pagamenti_attivi`, `stripe_connect_id`, `stripe_customer_id`, `telegram_chat_{ordini,pagamenti}`, `attivo`, `owner_id`; `menu_items.disponibile` and `*_i18n` JSONB; `orders.stato` ∈ `ricevuto|in_attesa_pagamento|pagato|fallito`. Post-briefing additions, with their gotchas:
- `restaurants`: `telegram_topic_{ordini,pagamenti}` — one Telegram forum group, two topics via `message_thread_id` (null ⇒ use two separate groups instead); cover charge `coperto` + `coperto_modalita` (`nessuno|persona|ordine|servizio`) + `coperto_label`; `accetta_mancia`; `aggiunte` JSONB (category add-on groups); branding `sottotitolo`/`colore_primario`/`tema`.
- `menu_items`: `allergeni text[]`, `opzioni` JSONB (per-item variant/extra groups).
- `orders`: `mancia`/`coperti`/`coperto_tot`; kitchen lifecycle `pronto_at`/`servito_at` — tracked **independently of the payment `stato` enum** (an order is "in cucina" when `stato ∈ {ricevuto,pagato}` and `servito_at is null`).

## Order flow (two cases)

- **`pagamenti_attivi=false`**: save order as `ricevuto`, notify Orders bot.
- **`pagamenti_attivi=true`**: create order as `in_attesa_pagamento`, create PaymentIntent on connected account (`stripeAccount: restaurants.stripe_connect_id`), wait for webhook before marking `pagato` and notifying Payments bot.

Both cases run through `api/ordine`, which recomputes the total server-side via `priceCartServerSide`: item base prices **plus** validated option/add-on deltas, then `+ coperto` (per the restaurant's `coperto_modalita`) `+ mancia` (only when `pagamenti_attivi` **and** `accetta_mancia`). The client-supplied total is never trusted; invalid/sold-out items or option selections are rejected.

The Payments bot message is framed as an **action to take** ("⚠️ Battere scontrino"), not a confirmation — see `src/lib/telegram.ts` (`notifyPaidOrder`) for the exact format.

## Phased build order

The product was built in phases, pausing at the end of each for manual testing. Do not jump ahead; do not bundle phases.

1. Foundations: Next.js + Supabase + schema + middleware + static public menu with one seed restaurant
2. Base orders: cart, order submit (case A), Orders bot, maintenance mode + health-check
3. Restaurateur dashboard: auth, realtime menu management, RLS
4. Customer payments: Stripe Connect Express, server-side total recompute, webhook, Payments bot, reconciliation screen
5. Subscriptions: Stripe Billing, plans, webhook, auto-suspension
6. Extras: multilingua, admin dashboard, custom domains, image perf

All six phases are now complete; work is incremental feature/fix work on top. The discipline still holds: at the start of a task list what will be done and which files will be touched; at the end give local test instructions. When a request is ambiguous or technically risky, stop and ask rather than guess.

## Language

The product is Italian. User-facing strings (including the maintenance-mode message and suspended-tenant message) must be in Italian, verbatim as quoted in the architectural rules above.
