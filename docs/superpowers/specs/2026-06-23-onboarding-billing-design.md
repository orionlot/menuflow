# Onboarding Connect + Billing abbonamenti — Design

**Data:** 2026-06-23
**Stato:** approvato dall'utente (in attesa di review dello spec scritto)

## Obiettivo

Completare al 100% la fase pagamenti perché il prodotto sia un business autosufficiente:
1. **Billing** — il ristoratore **paga il canone subito al signup** (Stripe Billing, abbonamento ricorrente); il locale si attiva **solo dopo `invoice.paid`**.
2. **Onboarding Connect** — il ristoratore collega il **proprio** account Stripe per incassare dai clienti al tavolo, con un flusso **self-serve dal pannello** (Stripe Express hosted onboarding), **opzionale** e riservato ai piani **Plus/Pro**.

Sono due sistemi Stripe **separati** (regola d'architettura: mai mischiati): Billing = ricavo della piattaforma; Connect = incassi del ristoratore (`application_fee = 0`).

## Stato attuale (verificato sul codice)

- **Signup** `registraLocale` (`src/app/onboarding/actions.ts:50`) crea il locale `attivo:true` "simulato" (`:107`), `pagamenti_attivi:false`, `piano` validato (`:103`). Nessun Customer/abbonamento; `stripe_customer_id` mai scritto.
- **Billing**: il webhook (`src/app/api/stripe/billing-webhook/route.ts`) **reagisce** a `invoice.paid`/`payment_failed`/`customer.subscription.deleted/updated` chiamando `setActiveByCustomer(customerId, bool)` (match su `stripe_customer_id`, scrive solo `attivo`). **Nessun codice crea l'abbonamento**; `priceIdForPlan` (`src/lib/stripe/billing.ts:16`) è pronto ma **mai chiamato**. Pannello "Abbonamento" sola lettura (`src/app/dashboard/(app)/page.tsx:160-183`).
- **Connect**: addebito + webhook completi; `stripe_connect_id` impostato **a mano** dall'azione `connectStripe` (`src/app/dashboard/actions.ts:539`, gate Plus/Pro, valida `acct_`, verifica `charges_enabled`) via form in `PagamentiSettings.tsx`. **Nessun onboarding** (no `accounts.create`/`accountLinks.create`/`account.updated`).
- **Schema**: `piano`,`pagamenti_attivi`,`stripe_connect_id`,`stripe_customer_id`,`attivo` esistono (0001). **Nessuna colonna di stato abbonamento.** Ultima migrazione `0045` → prossima **`0046`**.
- **Piani** (`src/lib/config/plans.ts`): base €29 / plus €39 / pro €59 (+ Multilingua €10), price-env `STRIPE_PRICE_BASE/PLUS/PRO/MULTILINGUA`.

## Decisioni (confermate dall'utente)

- **Canone**: pagamento **immediato al signup**; locale `attivo:false` fino a `invoice.paid`.
- **Connect onboarding**: **opzionale, dal pannello, dopo**; Plus/Pro.
- **Dashboard durante il "non pagato"**: accessibile, con banner "Completa l'abbonamento per pubblicare il menu"; menu pubblico resta sospeso (`attivo:false`).
- **Insolvenza**: ci si affida ai retry automatici di Stripe; sospensione (`attivo:false`) quando l'abbonamento va `past_due`/`unpaid`/`canceled`.
- **Multilingua**: seconda riga dell'abbonamento (+€10/mese).

## Regola trasversale: degrado senza Stripe

L'app deve girare in locale **senza Stripe** (regola CLAUDE.md). Tutto il nuovo codice è gated su `isStripeConfigured()`:
- Se Stripe **non** è configurato, `registraLocale` mantiene il comportamento attuale (`attivo:true` simulato, redirect al dashboard) e le CTA Billing/Connect mostrano "Stripe non configurato" o sono nascoste.
- Se Stripe **è** configurato, parte il flusso reale descritto sotto.

---

## Fase 0 — Schema + tipi + mappa prezzo→piano

- **Migrazione `0046_subscription_tracking.sql`** (additiva):
  ```sql
  alter table public.restaurants
    add column if not exists stripe_subscription_id text,
    add column if not exists abbonamento_stato text,        -- active|past_due|unpaid|canceled|incomplete|trialing
    add column if not exists abbonamento_rinnovo timestamptz; -- current_period_end
  ```
- **`src/types/db.ts`** (`Restaurant`): `stripe_subscription_id: string | null`, `abbonamento_stato: string | null`, `abbonamento_rinnovo: string | null`.
- **`planForPriceId(priceId: string): PlanId | null`** in `src/lib/stripe/billing.ts` — reverse di `priceIdForPlan`: confronta con `process.env[STRIPE_PRICE_BASE/PLUS/PRO]`, ritorna il `PlanId` o null. **Funzione pura, unit-testabile.**

---

## Fase A — Billing (canone al signup)

### Helper in `src/lib/stripe/billing.ts`
- `getOrCreateBillingCustomer(admin, restaurant, email): Promise<string>` — se `restaurant.stripe_customer_id` esiste lo ritorna; altrimenti `stripe.customers.create({ email, metadata:{ restaurant_id } })`, **persiste** `stripe_customer_id`, ritorna l'id.
- `createSubscriptionCheckout(input): Promise<string | null>` — `stripe.checkout.sessions.create({ mode:'subscription', customer, line_items, success_url, cancel_url, metadata:{restaurant_id}, subscription_data:{ metadata:{ restaurant_id } } })`. `line_items` = `[{ price: priceIdForPlan(piano), quantity:1 }]` **+** `{ price: STRIPE_PRICE_MULTILINGUA, quantity:1 }` se multilingua. Ritorna `session.url`.
- `createBillingPortal(customerId, returnUrl): Promise<string | null>` — `stripe.billingPortal.sessions.create({ customer, return_url })`.

Tutti usano `getStripe()` (singleton condiviso) ma restano in `billing.ts` (separati da Connect).

### Signup (`src/app/onboarding/actions.ts` `registraLocale`)
- Crea il locale con **`attivo:false`** (oggi `true`).
- Se `isStripeConfigured()`:
  1. `getOrCreateBillingCustomer` (salva `stripe_customer_id`).
  2. `createSubscriptionCheckout` con `success_url = <origin>/dashboard?abbonato=1`, `cancel_url = <origin>/dashboard?abbonamento=incompleto`.
  3. Ritorna `{ checkoutUrl }`; `OnboardingClient.tsx` fa `window.location.href = checkoutUrl`.
- Se **non** configurato: comportamento attuale (`attivo:true`, sign-in, redirect dashboard).
- L'utente owner viene comunque creato e loggato (così al ritorno dal Checkout è nel pannello).

### Attivazione (webhook Billing) — `src/app/api/stripe/billing-webhook/route.ts`
- `invoice.paid` → `attivo:true` (come oggi) + aggiorna le colonne abbonamento.
- `customer.subscription.created/updated` → scrive `stripe_subscription_id`, `abbonamento_stato = sub.status`, `abbonamento_rinnovo = sub.current_period_end`, **sincronizza `piano`** via `planForPriceId` sulla riga-piano (ignora la riga Multilingua), e imposta `attivo = sub.status ∈ {active, trialing}`.
- `invoice.payment_failed` → `attivo:false` (come oggi) + stato.
- `customer.subscription.deleted` → `attivo:false`, `abbonamento_stato='canceled'`.
- Match per `stripe_customer_id` (già scritto al signup); fallback su `subscription.metadata.restaurant_id`.
- Idempotenza `stripe_events` e 500-su-errore-DB invariati.
- **Nota insolvenza (scelta confermata):** `past_due` **sospende subito** (`attivo:false`), insieme a `unpaid`/`canceled`. I retry automatici di Stripe restano attivi: se vanno a buon fine, `invoice.paid` **riattiva** (`attivo:true`). Una grace-period durante `past_due` è un possibile affinamento futuro, fuori scope qui.

### Pannello "Abbonamento" (`src/app/dashboard/(app)/page.tsx:160-183`)
- Banner globale quando `!attivo`: **"Abbonamento non attivo — completa il pagamento per pubblicare il menu."**
- Se non attivo / nessun abbonamento → bottone **"Completa l'abbonamento"** → azione `createBillingCheckoutSession()` → redirect al Checkout.
- Se attivo → bottone **"Gestisci abbonamento"** → azione `createBillingPortalSession()` → redirect al Customer Portal.

### Server actions (`src/app/dashboard/actions.ts`, pattern `ownerRestaurantId()`)
- `createBillingCheckoutSession(): Promise<{url}|{error}>` — solo se non già `active`; riusa/crea il customer; ritorna l'URL Checkout.
- `createBillingPortalSession(): Promise<{url}|{error}>` — richiede `stripe_customer_id`; ritorna l'URL del portale.

---

## Fase B — Connect onboarding (incassi al tavolo, Plus/Pro, dal pannello)

### Helper in `src/lib/stripe/connect.ts`
- `createExpressAccount({ email, country='IT' }): Promise<Stripe.Account>` — `stripe.accounts.create({ type:'express', email, country, capabilities:{ card_payments:{requested:true}, transfers:{requested:true} } })`.
- `createAccountOnboardingLink({ accountId, refreshUrl, returnUrl }): Promise<string>` — `stripe.accountLinks.create({ account, type:'account_onboarding', refresh_url, return_url })`.
- `accountChargesEnabled(accountId): Promise<boolean>` — `accounts.retrieve` → `charges_enabled` (stessa logica di `connectStripe` `actions.ts:562-574`).

### Server action `createStripeConnectOnboardingLink()` (`src/app/dashboard/actions.ts`)
- Gate: `ownerRestaurantId()` + Plus/Pro (riusa il gate `actions.ts:551`).
- Se `stripe_connect_id` è null → `createExpressAccount(ownerEmail)` → **persiste subito** `stripe_connect_id` (così non si creano account orfani).
- `createAccountOnboardingLink` con `return_url = <origin>/api/stripe/connect/return`, `refresh_url = <origin>/api/stripe/connect/refresh` → ritorna l'URL; il client redirige.

### Route di ritorno/refresh
- `GET /api/stripe/connect/return` — `requireOwner` → recupera l'`acct_` del locale dell'owner → `accountChargesEnabled` → se true `pagamenti_attivi:true`; redirect a `/dashboard/funzionalita#pagamenti?connect=ok|incompleto`.
- `GET /api/stripe/connect/refresh` — `requireOwner` → rigenera un account link (i link scadono) e redirige all'onboarding.

### Webhook Connect (`src/app/api/stripe/connect-webhook/route.ts`)
- Nuovo case **`account.updated`** → se `account.charges_enabled` → `pagamenti_attivi:true` per il locale con `stripe_connect_id = account.id` (attivazione asincrona se l'onboarding finisce dopo il redirect).

### UI `PagamentiSettings.tsx`
- Sostituisce il form "incolla `acct_`" con il bottone **"Connetti con Stripe"** → chiama l'azione → `window.location` all'account link. Mostra lo stato (collegato / incassi abilitati).
- `connectStripe` / `disconnectStripe` (incolla manuale) **restano** come fallback (admin/avanzato).

---

## Setup Stripe (una volta sola, dashboard — non codice)

1. **Prodotti/Prezzi ricorrenti mensili**: Base €29, Plus €39, Pro €59, Multilingua €10 → Price ID in `STRIPE_PRICE_BASE/PLUS/PRO/MULTILINGUA` (env di prod su Vercel + locale).
2. **Customer Portal** attivato: consentire aggiorna-carta, cambia-piano (tra i 3 prezzi), disdici.
3. **Connect**: già abilitato; aggiungere l'evento **`account.updated`** all'endpoint Connect.
4. **Due webhook separati** con secret distinti: Billing (`STRIPE_BILLING_WEBHOOK_SECRET`) e Connect (`STRIPE_CONNECT_WEBHOOK_SECRET`); test e live separati.

## Invarianti rispettate

- **Due sistemi Stripe mai mischiati**: Billing in `billing.ts` + billing-webhook; Connect in `connect.ts`/`checkout-order.ts` + connect-webhook. Secret separati. `getStripe()` condiviso ma flussi logicamente separati.
- **`attivo`** guidato **solo** dal webhook Billing; **`pagamenti_attivi`** solo da Connect (return route / `account.updated`).
- Incassi cliente `application_fee = 0` (invariato).
- Segreti server-only; degrado senza Stripe.
- Nessuno scontrino fiscale (invariato).

## Gestione errori

- Checkout/portal/account-link non creabili (Stripe down) → l'azione ritorna `{ error }` con messaggio italiano generico; il signup, se il Checkout fallisce, lascia il locale `attivo:false` e mostra "Completa l'abbonamento" dal pannello.
- Webhook: 500 su errore di scrittura DB (Stripe ritenta), idempotenza invariata.
- Onboarding Connect interrotto: `pagamenti_attivi` resta false; il bottone ricrea un link; `account.updated` lo attiva quando `charges_enabled`.

## Test

- **Unit (vitest)**: `planForPriceId` (pura) — mappa i 4 env→PlanId e null per id sconosciuti.
- **Statico**: `tsc`, `eslint`, `next build`, `vitest`.
- **Manuale e2e** (chiavi test + `stripe listen` su entrambi gli endpoint):
  - Billing: signup → redirect Checkout subscription → paga 4242 → `invoice.paid` → locale `attivo:true`, `piano`/stato/rinnovo popolati; "Gestisci abbonamento" → portale; cambio piano dal portale → `customer.subscription.updated` → `piano` sincronizzato; disdetta → `attivo:false`.
  - Connect: pannello Plus/Pro → "Connetti con Stripe" → onboarding Express test → ritorno → `pagamenti_attivi:true`; poi un ordine reale paga via Checkout (flusso già esistente).

## Migrazioni

`0046_subscription_tracking.sql` (additiva). Da `supabase db push` prima del deploy.

## Implementazione in fasi

- **Fase 0**: migrazione 0046 + tipi + `planForPriceId` (+ test).
- **Fase A**: helper Billing + signup + webhook esteso + CTA pannello + azioni checkout/portal.
- **Fase B**: helper Connect onboarding + azione + route return/refresh + `account.updated` + UI bottone.
