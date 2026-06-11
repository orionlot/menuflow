# MenuFlow

Piattaforma web **multi-tenant** di menu digitali e ordini per ristoranti e bar.
Una sola codebase / un solo deploy serve tutti i locali: ogni ristorante è uno
**slug** raggiungibile via sottodominio (`slug.menuflow.it`) o dominio custom.

Stack: **Next.js (App Router, TS) · Supabase (Postgres+Auth+Storage, RLS) ·
Stripe Connect (pagamenti al tavolo) + Stripe Billing (abbonamenti) · 2 bot
Telegram**.

> In locale, Stripe e Telegram sono **opzionali**: senza chiavi le integrazioni
> diventano stub (Telegram scrive in console, i pagamenti usano un simulatore
> dev). Tutto il resto funziona davvero contro un Supabase locale in Docker.

## Prerequisiti

- Node 20+ e npm
- Docker Desktop (avviato) — per Supabase locale
- Supabase CLI (`brew install supabase/tap/supabase`)

## Setup locale (prima volta)

```bash
npm install
supabase start                 # avvia Postgres+Auth+Storage in Docker
# Copia le chiavi mostrate in .env.local (NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY = "publishable", SUPABASE_SERVICE_ROLE_KEY = "secret").
# Un .env.local pronto all'uso è già incluso per i valori di default della CLI.

supabase db reset              # applica migration + seed (ristoranti e menu demo)
node --env-file=.env.local scripts/seed-users.mjs   # crea gli utenti di login
npm run dev                    # http://localhost:3000
```

## Indirizzi locali

I browser risolvono `*.localhost` su 127.0.0.1, quindi i sottodomini funzionano
senza toccare `/etc/hosts`:

| Cosa | URL |
|---|---|
| Hub / landing (lista locali) | http://localhost:3000 |
| Menu pubblico — Pizzeria da Mario | http://pizzeria-mario.localhost:3000 |
| Menu pubblico — Bar Luna (multilingua, pagamenti) | http://bar-luna.localhost:3000 |
| Dashboard ristoratore | http://localhost:3000/dashboard |
| Admin | http://localhost:3000/admin |
| Supabase Studio | http://127.0.0.1:54323 |

### Account demo

| Ruolo | Email | Password |
|---|---|---|
| Admin | admin@menuflow.it | menuflow-admin |
| Ristoratore (Pizzeria) | mario@pizzeria.it | pizzeria-mario |
| Ristoratore (Bar Luna) | luna@barluna.it | bar-luna |

## Cosa provare

- **Menu + ordine senza pagamento** (Pizzeria da Mario): aggiungi voci, indica il
  tavolo, invia. L'ordine arriva e la notifica del *bot Ordini* viene stampata
  nella console di `npm run dev`. La voce "Birra artigianale" è esaurita (non
  ordinabile).
- **Ordine con pagamento** (Bar Luna, `pagamenti_attivi=true`): l'ordine nasce
  `in_attesa_pagamento`; senza Stripe in locale compare il bottone **"Simula
  pagamento (dev)"** che riproduce il webhook → l'ordine diventa `pagato` e parte
  la notifica del *bot Pagamenti* ("DA REGISTRARE / Battere scontrino").
- **Multilingua** (Bar Luna): selettore IT/EN in alto a destra.
- **Dashboard**: toggle esaurito in tempo reale, modifica prezzi/nome, upload
  foto (Supabase Storage), riconciliazione pagamenti del giorno con la spunta
  *promemoria gestionale* (non fiscale).
- **Admin**: crea ristoranti, cambia piano/flag, sospendi un locale → la pagina
  pubblica mostra "Servizio temporaneamente non disponibile".

## Comandi

```bash
npm run dev          # dev server
npm run build        # build di produzione
npm run lint         # eslint
npm run db:start     # supabase start
npm run db:stop      # supabase stop
npm run db:reset     # ricrea DB + migration + seed
```

## Abilitare Stripe / Telegram (opzionale)

Riempi le variabili in `.env.local` (vedi `.env.example`):

- **Telegram**: `TELEGRAM_BOT_ORDINI_TOKEN`, `TELEGRAM_BOT_PAGAMENTI_TOKEN` e i
  `telegram_chat_*` dei ristoranti. Il ristoratore deve premere "Avvia" su
  entrambi i bot prima di ricevere messaggi.
- **Stripe**: `STRIPE_SECRET_KEY` + i `*_WEBHOOK_SECRET`. Con Stripe configurato
  il simulatore dev si disattiva: l'unica fonte di verità sul pagamento è il
  webhook `api/stripe/connect-webhook`. Gli abbonamenti (Billing) usano
  `api/stripe/billing-webhook` e i `STRIPE_PRICE_*`.

Per i webhook in locale: `stripe listen --forward-to localhost:3000/api/stripe/connect-webhook`.

## Architettura

Vedi [CLAUDE.md](CLAUDE.md) per i vincoli architetturali (i due sistemi Stripe
separati, nessuno scontrino fiscale, ricalcolo totale lato server, ISR +
manutenzione, RLS per-tenant) e la struttura del codice.
