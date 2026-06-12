# Deploy gratuito (GitHub + Supabase + Vercel) — guida testing

Passo-passo per mettere online MenuFlow a costo zero, solo per provarlo. Usa i
piani **free** di GitHub, Supabase e Vercel.

## 0. Cosa va su GitHub e cosa NO

Il repo è già pulito: ti basta fare **`git push`** e `.gitignore` esclude
automaticamente tutto il resto.

> ⚠️ **Non** caricare la cartella con il drag-and-drop del sito di GitHub: quel
> metodo **ignora `.gitignore`** e finiresti per caricare `node_modules`, `.next`
> e soprattutto **`.env.local` con i tuoi segreti**. Usa sempre `git push`.

| ✅ VA su GitHub | ❌ NON va (già escluso da `.gitignore`) |
|---|---|
| `src/`, `public/` | **`.env.local`** ← i tuoi segreti, mai caricarlo |
| `supabase/migrations/`, `supabase/seed.sql`, `supabase/config.toml` | `node_modules/` (~476 MB) |
| `scripts/` | `.next/` (build, ~462 MB) |
| `package.json`, **`package-lock.json`** | `supabase/.temp`, `supabase/.branches` |
| config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts` | `.DS_Store`, `.vercel`, `.claude/` |
| **`.env.example`** (template, senza segreti) | |
| `README.md`, `CLAUDE.md`, `docs/`, i PDF | |

> `package-lock.json` **deve** esserci: Vercel lo usa per installare le dipendenze
> in modo riproducibile (`npm ci`).

## 1. Carica su GitHub

Crea un repository **vuoto** su github.com (senza README/licenza), poi nella
cartella del progetto:

```bash
git remote add origin https://github.com/TUO-UTENTE/menuflow.git
git branch -M main
git push -u origin main
```

## 2. Database su Supabase (free)

1. Crea un progetto su [supabase.com](https://supabase.com) (piano free).
2. **Project Settings → API**: copia *Project URL*, chiave *anon public*, chiave
   *service_role*.
3. Applica lo schema (migrazioni `0001`→`0014`). Due modi:
   - **CLI (consigliato):**
     ```bash
     supabase link --project-ref <REF-del-progetto>
     supabase db push          # applica tutte le migration in ordine
     ```
   - **Manuale:** apri il *SQL Editor* su Supabase e incolla, **in ordine**, il
     contenuto di ogni file in `supabase/migrations/` (dal `0001` al `0014`).
4. *(Opzionale)* Dati demo: incolla `supabase/seed.sql` nel SQL Editor, poi crea
   gli utenti di login:
   ```bash
   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<service_role> node scripts/seed-users.mjs
   ```
   In alternativa, registra un locale da `/onboarding` una volta online.

Il bucket Storage `menu-photos` viene creato dalla migration `0001`: non devi fare altro.

## 3. Deploy su Vercel (free)

1. [vercel.com](https://vercel.com) → **Add New → Project** → importa il repo GitHub.
2. Framework **Next.js** (rilevato in automatico): lascia i comandi di default.
3. **Environment Variables** — imposta almeno queste (riferimento: `.env.example`):

   | Variabile | Valore |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | *Project URL* di Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chiave *anon public* |
   | `SUPABASE_SERVICE_ROLE_KEY` | chiave *service_role* (server-only — **niente** prefisso `NEXT_PUBLIC`) |
   | `ADMIN_EMAILS` | la tua email (per entrare in `/admin`) |
   | `ROOT_DOMAIN` | vedi punto 4 |

   Lascia vuote (per ora) `STRIPE_*`, `TELEGRAM_*`, `UPSTASH_*`: le integrazioni
   diventano stub e l'app funziona comunque.
4. **Deploy**.

## 4. Routing multi-tenant: come vedere un menu

MenuFlow capisce *quale* locale mostrare dall'**Host** della richiesta
(sottodominio oppure dominio in `custom_domains`). Su un semplice indirizzo
`*.vercel.app` **non** hai i sottodomini jolly → scegli una delle due strade.

### A) Test rapido senza comprare un dominio (un solo locale)
Punta l'URL di Vercel a un locale tramite la tabella `custom_domains`:
1. Tieni `ROOT_DOMAIN` su un valore **diverso** dal tuo host Vercel (es. `menuflow.it`).
2. Nel SQL Editor di Supabase, prendi l'`id` di un ristorante e aggiungi:
   ```sql
   insert into custom_domains (domain, restaurant_id)
   values ('TUO-APP.vercel.app', '<UUID-del-ristorante>');
   ```
3. Apri `https://TUO-APP.vercel.app` → vedi il menu di quel locale.
   `/dashboard`, `/admin`, `/onboarding` funzionano comunque (sono per percorso, non per host).

### B) Multi-tenant reale (consigliato): dominio con wildcard
1. Collega un tuo dominio a Vercel e aggiungi il **wildcard** `*.tuodominio.it`.
2. Imposta `ROOT_DOMAIN=tuodominio.it`.
3. Ogni locale è su `slug.tuodominio.it` (es. `pizzeria-mario.tuodominio.it`);
   l'apice `tuodominio.it` mostra la landing.

> ⚠️ **Gotcha più comune:** se imposti `ROOT_DOMAIN` uguale all'host su cui navighi
> ma **non** hai i sottodomini, vedrai solo la landing e i menu daranno 404. È
> esattamente il caso `*.vercel.app` → usa la **strada A**.

## 5. Dopo il primo deploy

- **Admin:** `https://…/admin` (login con un utente la cui email è in `ADMIN_EMAILS`).
- **Crea locali / cambia piano** da admin, oppure registra da `/onboarding`.
- **Stripe/Telegram reali:** aggiungi le chiavi nelle Environment Variables di
  Vercel e ridistribuisci (vedi `README.md` e `.env.example`). Ricorda: due webhook
  separati con *signing secret* distinti.
- **Rate limit in produzione:** crea un DB gratis su [upstash.com](https://upstash.com)
  e imposta `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — altrimenti il
  limitatore è solo in-memory (vedi `docs/SECURITY-AUDIT.md`).

📋 Checklist sicurezza pre-deploy: **`docs/SECURITY-AUDIT.md`**.
```
