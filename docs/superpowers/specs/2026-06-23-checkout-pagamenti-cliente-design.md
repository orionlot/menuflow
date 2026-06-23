# Checkout pagamenti cliente (carte + Apple Pay + Google Pay) — Design

**Data:** 2026-06-23
**Stato:** approvato dall'utente (in attesa di review dello spec scritto)

## Obiettivo

Dare al commensale una vera schermata di pagamento per gli ordini al tavolo,
con **carte + Apple Pay + Google Pay**, usando **Stripe Checkout ospitato** sul
sistema **Connect** già presente. Oggi `api/ordine` crea un PaymentIntent
sull'account collegato del locale ma il client non ha mai una UI per
confermarlo (`clientSecret` ignorato): questo è il pezzo mancante che lo spec
copre.

## Scope

**Incluso:**
- Pagamento del cliente via Checkout ospitato (redirect) sull'account Connect del locale.
- Webhook `connect-webhook` esteso per chiudere l'ordine alla conferma.
- "Paga ora" / retry sul tracker per ordini in attesa o falliti (gestisce annullo/abbandono senza perdere l'ordine).
- Prevenzione doppio addebito: la sessione precedente viene fatta scadere prima di crearne una nuova.

**Fuori scope (gap separati, NON in questo lavoro):**
- Onboarding Connect Express (come il locale ottiene `stripe_connect_id`): oggi impostato a mano. Questo lavoro **assume che `stripe_connect_id` esista già**.
- Stripe Billing (checkout abbonamento + portale): sistema separato, mai toccato qui.
- PayPal / Satispay e altri metodi: rimandati.
- Nessuna `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / Stripe.js: il redirect ospitato non li richiede.

## Architettura e flusso

1. **Invio ordine** (`pagamenti_attivi` on, non "paga in cassa"): `api/ordine`
   crea l'ordine `in_attesa_pagamento` (come oggi) con `totale` ricalcolato
   server-side. Poi crea una **Checkout Session sull'account Connect del locale**
   (`stripe.checkout.sessions.create(params, { stripeAccount })`), salva
   `orders.stripe_checkout_session`, e risponde `{ ok:true, mode:"payment",
   checkoutUrl }`.
2. **Redirect**: il client fa `window.location.href = checkoutUrl` → pagina
   Stripe ospitata, mobile-first, con carte + Apple Pay + Google Pay automatici
   (nessuna registrazione dominio, perché ospitata).
3. **Esito** (Checkout redirige):
   - `success_url` = `<tenant-origin>/ordine/{id}?pagato=1`
   - `cancel_url`  = `<tenant-origin>/ordine/{id}`
4. **Webhook** `connect-webhook` (UNICA fonte di verità del pagamento):
   - `checkout.session.completed` → salva `stripe_payment_intent` =
     `session.payment_intent`, poi `markOrderPaid({ orderId:
     session.metadata.order_id, paidAmountCents: session.amount_total, currency:
     session.currency })`. L'assert importo già esistente verifica
     `amount_total === order.totale*100` ed EUR.
   - `checkout.session.expired` → `markOrderFailed({ orderId:
     session.metadata.order_id })` (pulizia ordini abbandonati).
   - Restano i case esistenti `payment_intent.succeeded` /
     `payment_intent.payment_failed` (innocui: per Checkout l'evento principale
     è `checkout.session.*`).
5. **Tracker** `/ordine/{id}`:
   - `stato === "pagato"` → vista "pagato" (come oggi).
   - `?pagato=1` e non ancora pagato → "Pagamento in elaborazione…" + polling
     già esistente; quando lo stato passa a `pagato`, mostra il successo.
   - `stato ∈ {in_attesa_pagamento, fallito}` (senza `?pagato=1`) → bottone
     **"Paga ora"** → `POST /api/ordine/{id}/pay` → redirect alla nuova sessione.

### Perché Checkout ospitato

App multi-tenant con **domini personalizzati**: Apple Pay con Payment Element
imbarcato richiederebbe di registrare ogni dominio dei locali su Stripe.
Checkout ospitato lo evita del tutto, riduce il codice client e mantiene PCI al
minimo.

## Parametri Checkout Session (esatti)

```ts
{
  mode: "payment",
  locale: "it",
  line_items: [{
    quantity: 1,
    price_data: {
      currency: "eur",
      unit_amount: totaleCents,            // = Math.round(order.totale * 100)
      product_data: { name: `Ordine — ${restaurantName}${tavolo ? ` · Tavolo ${tavolo}` : ""}` },
    },
  }],
  metadata: { order_id, restaurant_id, kind: "connect_table_payment" },
  payment_intent_data: { metadata: { order_id, restaurant_id, kind: "connect_table_payment" } },
  success_url: successUrl,                  // <origin>/ordine/{id}?pagato=1
  cancel_url: cancelUrl,                     // <origin>/ordine/{id}
  // payment_method_types OMESSO di proposito → Stripe mostra i metodi abilitati
  // sull'account collegato, inclusi i wallet (Apple/Google Pay).
  // Nessun application_fee → l'intero importo resta al locale.
}
```

Riga unica e aggregata (non itemizzata): evita disallineamenti di
arrotondamento col totale e non espone il dettaglio piatti sulla pagina Stripe.

## Componenti / file

- **`supabase/migrations/0045_order_checkout_session.sql`** (additivo):
  `alter table orders add column if not exists stripe_checkout_session text;`
- **`src/types/db.ts`**: `Order.stripe_checkout_session?: string | null`.
- **`src/lib/stripe/connect.ts`**:
  - `buildCheckoutParams(input)` — **funzione pura** che ritorna i params (testabile senza Stripe).
  - `createConnectCheckoutSession(input)` — chiama `stripe.checkout.sessions.create(params, { stripeAccount })`.
  - `expireConnectCheckoutSession(sessionId, connectedAccountId)` — `stripe.checkout.sessions.expire(...)`, errori non bloccanti.
  - **Rimuove** `createConnectPaymentIntent` (ora morto: solo `api/ordine` lo usava).
- **`src/lib/orders.ts`**: `markOrderFailed(admin, { orderId?, paymentIntentId? })` (firma estesa, simmetrica a `markOrderPaid`; match per `id` o per `stripe_payment_intent`, sempre con `neq("stato","pagato")`).
- **`src/app/api/ordine/route.ts`** (case B): costruisce l'origin con
  `appOrigin()`, crea la sessione tramite helper condiviso, salva
  `stripe_checkout_session`, risponde `checkoutUrl`. Rimuove `clientSecret`/`paymentIntentId` dalla risposta.
- **`src/app/api/ordine/[id]/pay/route.ts`** (NUOVO): retry/"Paga ora".
- **`src/app/api/stripe/connect-webhook/route.ts`**: nuovi case `checkout.session.completed` / `checkout.session.expired`.
- **`src/app/[domain]/MenuClient.tsx`**: su `mode:"payment"` con `checkoutUrl` → redirect; ramo simulatore invariato (`devSimulateAvailable`, senza `checkoutUrl`).
- **`src/app/[domain]/ordine/[id]/OrderTracker.tsx`** (+ `page.tsx`): stato "in elaborazione" su `?pagato=1` e bottone "Paga ora".
- **Test**: `src/lib/stripe/connect.test.ts` per `buildCheckoutParams`.

### Interfacce

- `buildCheckoutParams(input: { orderId: string; restaurantId: string; restaurantName: string; tavolo?: string | null; totaleCents: number; successUrl: string; cancelUrl: string }): Stripe.Checkout.SessionCreateParams`
- `createConnectCheckoutSession(input: BuildInput & { connectedAccountId: string }): Promise<Stripe.Checkout.Session>`
- `expireConnectCheckoutSession(sessionId: string, connectedAccountId: string): Promise<void>`
- `markOrderFailed(admin, opts: { orderId?: string; paymentIntentId?: string }): Promise<void>`
- Retry endpoint `POST /api/ordine/{id}/pay` → `{ ok:true, mode:"payment", checkoutUrl }` | `{ ok:true, devSimulateAvailable:true }` | `{ ok:false, error }`.

## Retry / "Paga ora" (endpoint)

- Carica l'ordine (service-role). Procede solo se `stato ∈ {in_attesa_pagamento, fallito}` e `restaurant.pagamenti_attivi`.
- Se `!pagamenti_test && isStripeConfigured() && stripe_connect_id`: **fa scadere** l'eventuale `stripe_checkout_session` esistente, crea una nuova sessione (importo = `order.totale`, già autorevole), aggiorna `stripe_checkout_session`, ritorna `checkoutUrl`.
- Altrimenti (test mode / no Stripe): ritorna `{ devSimulateAvailable:true }` → il tracker mostra il bottone simulatore.
- **Rate-limit** (riusa `src/lib/ratelimit.ts`) e id ordine = UUID non indovinabile.

## Invarianti rispettate

- **Connect ≠ Billing**: tutto resta in `connect-webhook`; nessuna subscription toccata.
- **Addebito sull'account del locale, fee = 0**: `{ stripeAccount }`, nessun `application_fee_amount`.
- **Totale ricalcolato server-side**: la riga Checkout usa `order.totale`, scritto da `priceCartServerSide` alla creazione; il client non fornisce mai l'importo.
- **"Pagato" solo dal webhook**: il `success_url` non marca nulla; lo stato passa a `pagato` esclusivamente da `checkout.session.completed`.
- **Idempotenza**: tabella `stripe_events` (già esistente) + `markOrderPaid` race-safe.
- **Nessuno scontrino fiscale**: invariato.

## Gestione errori

- Sessione non creabile (Stripe down) → `api/ordine` risponde 503/`maintenance` come gli altri fallimenti backend; l'ordine resta `in_attesa_pagamento` e si può "Paga ora" dal tracker.
- Webhook: un fallimento di scrittura DB ritorna 500 (Stripe ritenta), come oggi.
- Mismatch importo/valuta → `markOrderPaid` lancia → 500 → evento resta ritentabile, ordine NON marcato pagato (comportamento attuale preservato).
- Doppio addebito: mitigato facendo scadere la sessione precedente a ogni retry (solo una sessione "aperta" alla volta).

## Test

- **Unit (vitest)**: `buildCheckoutParams` — `unit_amount === round(totale*100)`, `currency:"eur"`, `metadata.order_id`, success/cancel URL corretti, nessun `application_fee_amount`, `payment_method_types` assente.
- **Statico**: `tsc --noEmit`, `eslint`, `next build`.
- **Manuale e2e**: con chiavi **test** Stripe + `stripe listen --forward-to localhost:3000/api/stripe/connect-webhook`; carta `4242…` e wallet in test mode; verifica `in_attesa → pagato`, notifica Payments bot, schermo "Paga ora" su annullo.
- **Simulatore**: invariato per `pagamenti_test` / locale senza Stripe.

## Migrazioni

`0045_order_checkout_session.sql` (additiva). Da `supabase db push` prima del deploy. Nessun'altra modifica schema.
