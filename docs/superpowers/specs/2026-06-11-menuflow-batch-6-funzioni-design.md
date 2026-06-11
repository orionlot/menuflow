# MenuFlow — Batch 6 funzioni (aspetto, notifiche, menu tools, chiamate)

**Data:** 2026-06-11
**Stato:** design approvato, pronto per il piano d'implementazione
**Lingua prodotto:** italiano (tutte le stringhe utente in IT)

## Contesto

Aggiunta di 6 funzioni alla piattaforma MenuFlow (Next.js App Router + Supabase + RLS),
tutte rivolte a un ristoratore **non tecnico** e ai suoi clienti al tavolo. Il design
rispetta i vincoli architetturali del progetto (`CLAUDE.md`):

- **Ricalcolo/validazione lato server**: il totale e la disponibilità si verificano
  in `priceCartServerSide`; il client non è mai fonte di verità.
- **RLS**: la dashboard usa il client anon+cookie; gli endpoint pubblici e le scritture
  cross-tenant usano il service-role dopo aver verificato il proprietario.
- **Colonne pubbliche solo "safe"**: `resolveTenant` espone un sottoinsieme di colonne.
- **Config parametrici**: niente valori magici sparsi; default in `src/lib/config/`.
- **Stringhe italiane**, niente localStorage/sessionStorage, segreti solo server.
- **Migrazioni additive** (`add column if not exists`), tipi rispecchiati a mano in
  `src/types/db.ts`.

## Panoramica e ordine di build

Ogni modulo è verificabile da solo (checkpoint manuale a fine modulo).

| # | Modulo | Migrazione | Build order |
|---|---|---|---|
| 1 | Aspetto: 2° colore + 5 opzioni layout | `0008_appearance` | 1 |
| 2 | Notifiche leggere (suono + auto-refresh + badge non letto) | `0009_orders_visto` | 2 |
| 5 | Chiama cameriere / Chiedi il conto | `0010_chiamate` | 3 |
| 3 | Import CSV + duplica voce | — | 4 |
| 4 | Disponibilità per orari e giorni | `0011_item_schedule` | 5 |
| 6 | Ricerca + filtri dietetici + "più ordinati" | — | 6 |

(Il 5 va dopo il 2 perché ne riusa il feed live `/api/dashboard/novita` e il suono.)

> I numeri di migrazione seguono l'ordine di build (`0008` → `0011`); il "#" è solo
> l'etichetta originale del modulo. La numerazione effettiva nel repo sarà sequenziale.

---

## Modulo 1 — Aspetto personalizzabile (colore secondario + 5 layout)

### Obiettivo
Dare al ristoratore un secondo colore e 5 scelte di layout, con un'anteprima live,
tenendo tutto intuitivo (card a due opzioni, nessun gergo).

### Cosa vede il ristoratore
Nella pagina **Aspetto del menu** (`/dashboard/branding`), oltre ai controlli attuali
(nome, sottotitolo, colore brand, tema, logo, coperto):
- **Colore secondario** (nuovo selettore `<input type="color">` + hex), accanto al brand.
- **5 controlli di layout**, ognuno una coppia di "card" selezionabili:
  1. **Bordi** — Arrotondati / Squadrati
  2. **Foto prodotto** — A lato / Grande sopra
  3. **Foto per categoria** — elenco categorie con interruttore mostra/nascondi
  4. **Intestazione** — Banner con logo grande / Minimal con logo piccolo
  5. **Densità** — Comoda / Compatta
- L'**anteprima live** già presente nel form si aggiorna con colore secondario + layout.

### Dove si applica il secondo colore
Il primario resta per l'**intestazione**. Il secondario è l'**accento**: bottoni
("Aggiungi" `+`, "Vedi ordine", "Invia"/"Vai al pagamento"), prezzi, **categoria attiva**
(chip), badge quantità. Se il secondario è assente → fallback al primario (retro-compatibile).

### Data model — `0008_appearance.sql`
```sql
alter table public.restaurants
  add column if not exists colore_secondario text,
  add column if not exists layout jsonb not null default '{}'::jsonb;
```
`layout` shape (tutti opzionali, default da config):
```ts
interface MenuLayout {
  bordi: 'arrotondati' | 'squadrati';       // default 'arrotondati'
  foto_pos: 'lato' | 'sopra';               // default 'lato'
  foto_categorie_nascoste: string[];        // categorie senza foto; default []
  intestazione: 'banner' | 'minimal';       // default 'banner'
  densita: 'comoda' | 'compatta';           // default 'comoda'
}
```

### Config parametrico — `src/lib/config/layout.ts` (nuovo)
- `DEFAULT_LAYOUT: MenuLayout`
- `LAYOUT_CONTROLS` — metadati per il form (chiave, etichetta IT, due scelte con etichetta).
- `resolveLayout(raw: unknown): MenuLayout` — merge con i default (usato lato render).
- `sanitizeLayout(raw: unknown): MenuLayout` — whitelist/validazione (usato in `sanitizeBranding`).

### Palette — `src/lib/brand.ts`
- Firma estesa: `brandPalette(primary: string, tema, secondary?: string | null): Palette`.
- `Palette` guadagna `accent` e `onAccent` (calcolati dal secondario; fallback = primary/onBrand).
- I bordi/densità **non** stanno nella palette (sono layout): restano applicati nei componenti
  dal `layout`. La palette resta solo-colori (separazione netta).

### Tipi — `src/types/db.ts`
- `Restaurant` + `PublicRestaurant`: aggiungi `colore_secondario: string | null`, `layout: MenuLayout`.
- `BrandingPatch`: aggiungi `colore_secondario?`, `layout?: Partial<MenuLayout>`.
- Esporta `MenuLayout` (o importalo da config).

### Server
- `src/lib/branding.ts` `sanitizeBranding`: whitelist `colore_secondario` (regex hex come
  `colore_primario`, ammette null per rimuovere) e `layout` via `sanitizeLayout`.
- `src/lib/tenant.ts` `SAFE_RESTAURANT_COLUMNS`: aggiungi `colore_secondario, layout`.
- `updateBranding` (actions.ts) funziona già: passa il patch a `sanitizeBranding`.

### UI
- `src/components/BrandingForm.tsx`: nuovi stati (secondario, 5 layout), nuovi controlli,
  preview estesa (passa secondario a `brandPalette`, applica radius/foto_pos/densità/header).
  Le categorie per il toggle "foto per categoria" arrivano come nuova prop dalla pagina.
- `src/app/dashboard/(app)/branding/page.tsx`: query delle categorie distinte
  (`select categoria from menu_items where restaurant_id=…`), passa `initial` esteso + categorie.
- `src/app/[domain]/MenuClient.tsx`: accetta `layout` (da `tenant.layout`), applica:
  - **bordi**: helper `radius(layout)` → valori (es. arrotondati 18px / squadrati 4px) su card, foto, chip, header.
  - **foto_pos**: `lato` = layout attuale (flex row); `sopra` = immagine grande full-width sopra il testo.
  - **foto_categorie_nascoste**: salta il blocco immagine se `layout.foto_categorie_nascoste.includes(item.categoria)`.
  - **intestazione**: `banner` = header attuale; `minimal` = sfondo `pageBg`, logo piccolo, testo `text`.
  - **densità**: `comoda` = spacing attuale; `compatta` = padding/gap ridotti.
  - accento: bottoni/prezzi/chip-attiva usano `p.accent`/`p.onAccent`.

### Note / edge
- Retro-compatibilità: ristoranti esistenti hanno `layout='{}'` → `resolveLayout` dà i default
  (= aspetto attuale). `colore_secondario=null` → accento = primario (= aspetto attuale).
- Il tema dark ha già logiche proprie: il layout `minimal`/`compatta` deve convivere con
  `dark` senza rompere (testare entrambi i temi).

### Test
- Unit: `sanitizeLayout` (valori non validi → default), `brandPalette` con/ senza secondario
  (accent corretto, contrasto `onAccent`).
- Manuale: cambia ogni controllo → anteprima e menu pubblico coerenti, su tema chiaro e scuro.

---

## Modulo 2 — Notifiche leggere (suono + auto-refresh + badge non letto)

### Obiettivo
Il ristoratore che guarda la dashboard "Ordini" non perde un ordine: suono all'arrivo,
lista che si aggiorna da sola, badge "Nuovo / non letto". Nessuna email.

### Cosa vede
- Pulsante una-tantum **"🔔 Attiva avvisi sonori"** (i browser bloccano l'audio senza un
  gesto utente iniziale).
- Ordini non ancora visti: badge **"Nuovo"** + contatore totale; **suono** all'arrivo di un
  nuovo ordine; lista aggiornata via polling. Azione **"Segna letti"**.

### Data model — `0009_orders_visto.sql`
```sql
alter table public.orders
  add column if not exists visto_at timestamptz;  -- null = non letto
create index if not exists orders_unread_idx
  on public.orders (restaurant_id, visto_at, created_at);
```
`Order` (types/db.ts): aggiungi `visto_at: string | null`.

### Endpoint live — `src/app/api/dashboard/novita/route.ts` (nuovo)
- `GET`, `force-dynamic`, RLS-scoped (`getOwnedRestaurant` + anon+cookie client come
  `api/dashboard/kitchen`).
- Ritorna `{ ok, orders, chiamate }`:
  - `orders`: ordini del giorno corrente (o ultime 24h) con `id, tavolo, totale, stato,
    created_at, visto_at, items` → il client evidenzia i non letti.
  - `chiamate`: vedi Modulo 5 (attive, `gestita_at is null`). In Modulo 2 il campo può
    restare vuoto finché il Modulo 5 non è implementato.

### Azioni — `src/app/dashboard/actions.ts`
- `markOrdersRead(ids?: string[])`: set `visto_at=now()` sugli ordini non letti del
  proprietario (RLS scope). Se `ids` assente → tutti i non letti del giorno.

### UI — `OrdiniClient.tsx` (nuovo, client) + `ordini/page.tsx` (modifica)
- La pagina resta server component: carica gli ordini del giorno + il filtro data, poi
  monta `OrdiniClient` con i dati iniziali.
- `OrdiniClient`:
  - **polling** ogni ~15s su `/api/dashboard/novita` (stesso pattern di `KitchenClient`).
  - confronta gli id visti per rilevare **nuovi** ordini → **suono** (Web Audio API:
    `OscillatorNode`, nessun asset) se il suono è attivato.
  - badge "Nuovo" sugli ordini con `visto_at===null`; contatore in cima; "Segna letti".
  - rendering ordini riusa la stessa struttura della pagina attuale (estrai un piccolo
    `OrderCard` condiviso o duplica il markup esistente — preferito: estrarre `OrderCard`).

### Note / edge
- Autoplay: niente suono finché l'utente non preme "Attiva avvisi sonori" (stato in memoria,
  niente storage). Dopo il primo gesto l'AudioContext è sbloccato.
- Robustezza: il polling funziona anche se il realtime Supabase ha intoppi.

### Test
- Manuale: con la dashboard aperta, invia un ordine dal menu pubblico → entro ~15s appare,
  con badge "Nuovo" e suono (se attivato). "Segna letti" azzera il badge.

---

## Modulo 5 — Chiama il cameriere / Chiedi il conto

### Obiettivo
Bottoni sul menu del cliente che avvisano il ristoratore (Telegram + feed dashboard).

### Cosa vede il cliente
Un pulsante discreto **"Serve aiuto?"** (vicino all'header) apre un mini-sheet con
**"🔔 Chiama cameriere"** e **"🧾 Chiedi il conto"**. Richiede il numero tavolo
(riusa lo stato `tavolo` già presente; se mancante, chiede di inserirlo). Dopo l'invio,
il pulsante resta disabilitato ~60s (anti-spam, cooldown solo client).

### Cosa vede il ristoratore
- **Telegram** (bot Ordini / topic Ordini): "🔔 Tavolo 5 — Chiama il cameriere" /
  "🧾 Tavolo 5 — Chiede il conto".
- **Dashboard "Ordini"**: banner in cima nel feed live (Modulo 2) con la chiamata + suono +
  azione **"Gestita"**.

### Data model — `0010_chiamate.sql`
```sql
create table if not exists public.chiamate (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tavolo text not null,
  tipo text not null check (tipo in ('cameriere','conto')),
  created_at timestamptz not null default now(),
  gestita_at timestamptz
);
create index if not exists chiamate_live_idx
  on public.chiamate (restaurant_id, gestita_at, created_at);
alter table public.chiamate enable row level security;
-- Il proprietario vede/aggiorna solo le proprie (join via restaurants.owner_id).
create policy "chiamate owner select" on public.chiamate for select
  using (exists (select 1 from public.restaurants r
    where r.id = chiamate.restaurant_id and r.owner_id = auth.uid()));
create policy "chiamate owner update" on public.chiamate for update
  using (exists (select 1 from public.restaurants r
    where r.id = chiamate.restaurant_id and r.owner_id = auth.uid()));
-- L'inserimento avviene dall'endpoint pubblico via service-role (bypassa RLS).
```
`Chiamata` (types/db.ts): `{ id, restaurant_id, tavolo, tipo: 'cameriere'|'conto',
created_at, gestita_at }`.

### Endpoint pubblico — `src/app/api/chiamata/route.ts` (nuovo)
- `POST { slug, tavolo, tipo }`, `force-dynamic`, admin client (come `api/ordine`).
- Valida: tenant esiste e `attivo`; `tavolo` non vuoto; `tipo ∈ {cameriere,conto}`.
- Anti-abuso server (leggero): rifiuta se esiste già una chiamata stessa `restaurant_id+tavolo`
  con `gestita_at is null` creata negli ultimi 30s.
- Inserisce in `chiamate`, poi `notifyServiceRequest(restaurant, tavolo, tipo)`.

### Telegram — `src/lib/telegram.ts`
- `notifyServiceRequest(restaurant, tavolo, tipo)`: invia al bot Ordini / topic Ordini
  (riusa `send()` + `telegram_chat_ordini` / `telegram_topic_ordini`). Testo IT come sopra.

### Feed dashboard
- `/api/dashboard/novita` (Modulo 2) include `chiamate` (attive `gestita_at is null`,
  ultime 2h).
- `OrdiniClient` mostra le chiamate come banner in cima, suono all'arrivo, "Gestita".
- Azione `markChiamataGestita(id)` in actions.ts (RLS: update sulle proprie).

### UI cliente — `MenuClient.tsx`
- Nuovo componente interno `HelpButton` + mini-sheet (riusa lo stile `Overlay`/sheet).
- `POST /api/chiamata`; cooldown 60s client; messaggio di conferma ("Avvisato lo staff ✓").

### Test
- Manuale: dal menu, "Chiama cameriere" → notifica Telegram (o log stub) + comparsa nel feed
  dashboard con suono; "Gestita" la rimuove. Doppio click entro 30s → bloccato.

---

## Modulo 3 — Import CSV + duplica voce

### Obiettivo
Velocizzare il popolamento del menu: duplicare una voce e importare molte voci da CSV.

### Cosa vede
Nella pagina **Menu**:
- **"Duplica"** su ogni voce → crea una copia "<nome> (copia)" sotto l'originale, pronta da
  modificare.
- **"Importa CSV"** + **"Scarica modello"** vicino a "+ Aggiungi voce". Carica un CSV, vede
  **"X voci valide, Y righe ignorate"**, conferma → le voci vengono aggiunte (modalità append).

### Modello CSV
Colonne (header riga 1): `categoria, nome, descrizione, prezzo, disponibile, allergeni`.
- `prezzo`: numero (accetta `8` o `8,50` o `8.50`).
- `disponibile`: `sì/si/no` (default sì).
- `allergeni`: id separati da `|` (es. `glutine|latte`); id non noti ignorati.
- i18n e opzioni NON nel CSV (restano nell'editor).

### Parser — `src/lib/csv.ts` (nuovo)
- `parseCsv(text: string): string[][]` — parser minimale ma corretto (gestisce campi
  quotati, `""` escaping, `\r\n`/`\n`, separatore `,` **e** `;` per Excel IT).
- `rowsToItemPatches(rows): { patches: ItemPatch[]; skipped: number }` — mappa header→campi,
  valida ogni riga con `sanitizeItemPatch`, scarta righe senza nome/categoria.
- **Testato** (unit) — è codice di parsing, copre i casi limite.

### Server — `src/app/dashboard/actions.ts`
- `duplicateItem(itemId)`: legge la voce (RLS), inserisce una copia (`nome+" (copia)"`,
  stesso `categoria/prezzo/…`, `ordine` dopo l'originale), `revalidatePath`.
- `importItems(formData)`: legge il file, `parseCsv` + `rowsToItemPatches`, bulk-insert
  (cap es. 500 righe) sul ristorante del proprietario, `revalidatePath`. Ritorna conteggi.

### Modello scaricabile
- `src/app/api/dashboard/menu-template/route.ts` (nuovo) o generazione client: CSV con header
  + 1 riga d'esempio, UTF-8 BOM + `;` (coerente con `api/dashboard/export`).

### UI — `MenuManager.tsx`
- `MenuActions` += `duplicateItem`, `importItems`; wiring in `menu/page.tsx`.
- Bottone "Duplica" accanto a "Elimina" in `SortableItem`.
- Barra import (file input + "Scarica modello" + esito) in testa.

### Test
- Unit: `parseCsv` (virgole nei campi, `;`, quote, righe vuote), `rowsToItemPatches`.
- Manuale: duplica una voce; importa il modello compilato; conteggi corretti, voci visibili.

---

## Modulo 4 — Disponibilità per orari e giorni

### Obiettivo
Voci disponibili solo certi giorni/orari (es. menu pranzo, happy hour), tenendo la UI semplice.

### Cosa vede il ristoratore
Nell'editor voce, sezione a scomparsa **"Disponibilità oraria"**: interruttore
**"Sempre disponibile / Solo in certi orari"**. Se attivo:
- chip **giorni** (Lun–Dom, multiselezione; nessuno = tutti i giorni)
- **fascia oraria** dalle–alle; pulsante per una **seconda fascia** opzionale (pranzo+cena).

### Cosa vede il cliente
Voce fuori orario = **non ordinabile**, con etichetta gentile ("Disponibile dalle 18:00"
oppure "Solo gio–dom"), riusando il rendering "Esaurito" già esistente (badge + opacità).

### Data model — `0011_item_schedule.sql`
```sql
alter table public.menu_items
  add column if not exists disponibilita_oraria jsonb;  -- null = sempre disponibile
```
Shape:
```ts
interface FasciaOraria { da: string; a: string; }   // "HH:MM", a > da (no overnight in v1)
interface DisponibilitaOraria {
  giorni: number[];        // 0=Dom … 6=Sab (getDay); [] = tutti i giorni
  fasce: FasciaOraria[];   // [] = tutto il giorno; 1–2 fasce
}
```
`MenuItem` (types/db.ts): aggiungi `disponibilita_oraria: DisponibilitaOraria | null`.

### Helper puro — `src/lib/availability.ts` (nuovo)
- `isAvailableNow(s: DisponibilitaOraria | null, now: Date): boolean` — true se `s` è null o
  (giorni vuoti o include il giorno) **e** (fasce vuote o `now` dentro una fascia).
  Il giorno/ora si calcolano nel fuso **Europe/Rome** (via `Intl…formatToParts`), così è
  corretto sia su server (UTC) sia su client.
- `availabilityHint(s): string | null` — etichetta IT breve per il cliente.
- **Testato** (unit) con date fisse.

### Server (sicurezza) — `src/lib/pricing.ts`
- `priceCartServerSide`: nel `select` aggiungi `disponibilita_oraria`; dopo il check
  `!item.disponibile`, rifiuta anche se `!isAvailableNow(item.disponibilita_oraria, new Date())`
  → "Voce non disponibile ora: …". Mantiene "il server è la verità".
- `src/lib/tenant.ts` `getMenuItems`: aggiungi `disponibilita_oraria` al `select` (serve al client).

### UI
- `MenuManager.tsx` (`SortableItem`): nuova `<details>` "Disponibilità oraria" (giorni + fasce),
  salva via `h.save(item.id, { disponibilita_oraria })`. `ItemPatch` + `sanitizeItemPatch`
  (menu.ts) gestiscono il nuovo campo (con `sanitizeDisponibilita`).
- `MenuClient.tsx`: una voce è ordinabile solo se `item.disponibile` **e**
  `isAvailableNow(item.disponibilita_oraria, new Date())`; altrimenti badge/etichetta
  (`availabilityHint`) e `+` nascosto. Calcolo lato client (sempre aggiornato, non soffre l'ISR).

### Note / edge
- Solo fasce same-day in v1 (`a > da`); overnight (es. 22:00–02:00) **fuori scope** (validazione
  lo impedisce, con messaggio).
- `disponibilita_oraria` vuota/`{giorni:[],fasce:[]}` ≡ null (sempre disponibile).

### Test
- Unit: `isAvailableNow` (dentro/fuori giorno, dentro/fuori fascia, due fasce, null),
  `availabilityHint`. Importante: anche il rifiuto server in `priceCartServerSide`.
- Manuale: imposta una voce "solo 18:00–20:00", verifica non ordinabile fuori fascia e che
  l'ordine fuori fascia venga rifiutato dal server.

---

## Modulo 6 — Ricerca + filtri dietetici + "più ordinati"

### Obiettivo
Rendere il menu del cliente più navigabile e spingere le vendite, senza lavoro extra per il
ristoratore e senza migrazioni.

### Cosa vede il cliente
- **Casella "cerca"** in cima al menu: filtra le voci per nome (e nome i18n) dal vivo.
- **Filtri dietetici**: chip **"Senza glutine", "Senza lattosio", "Senza frutta a guscio"…**
  derivati da `allergeni` (mostra solo voci che NON contengono quell'allergene).
- **Badge "★ Tra i più ordinati"** sulle voci top.

> ⚠️ "Vegetariano/Vegano" NON è ricavabile dagli allergeni → **fuori scope** (vedi Fase 2).
> I filtri sono di tipo "senza [allergene]".

### Comportamento ricerca/filtri
- Senza query e senza filtri → vista a categorie attuale (rail + categoria attiva).
- Con query o filtri attivi → lista **piatta** dei risultati su tutte le categorie (la rail si
  disattiva/dimma), con conteggio risultati e stato vuoto ("Nessun piatto trovato").
- Filtri: i chip mostrati derivano dagli allergeni effettivamente presenti nel menu.

### "Più ordinati" — server
- `src/lib/tenant.ts` (o `stats`): `getPopularItemIds(restaurantId, days=30, limit=4):
  Promise<Set<string>>` — admin client, ordini `ricevuto|pagato` ultimi N giorni, aggrega
  `items[].item_id`, ritorna i top. Soglia minima (es. ≥3 ordini) per evitare badge "rumore".
- `src/app/[domain]/page.tsx`: calcola `popolari` e li passa a `MenuClient` (`popolari: string[]`).
  Sotto ISR (`revalidate=60`) si aggiorna periodicamente; locali nuovi → set vuoto (nessun badge).

### UI — `MenuClient.tsx`
- Stato `query` + `filters: Set<string>` (allergene id da escludere).
- `visible(items)`: applica categoria **oppure** query/filtri; per i filtri esclude voci con
  l'allergene; per la ricerca confronta `nome`/`nome_i18n`.
- Badge "★ Più ordinato" se `popolari.includes(item.id)`.
- Usa `p.accent` per la chip filtro attiva (coerente col Modulo 1).

### Test
- Manuale: cerca una voce; attiva "Senza glutine" → spariscono le voci con glutine; badge "più
  ordinati" presente dopo qualche ordine, assente su locale nuovo.

---

## Cross-cutting

### Tipi (`src/types/db.ts`)
`Restaurant`/`PublicRestaurant`: `colore_secondario`, `layout`. `MenuItem`:
`disponibilita_oraria`. `Order`: `visto_at`. Nuovi: `MenuLayout`, `DisponibilitaOraria`,
`FasciaOraria`, `Chiamata`. `BrandingPatch`: `colore_secondario`, `layout`. `ItemPatch`
(menu.ts): `disponibilita_oraria`.

### Colonne "safe" e select
- `SAFE_RESTAURANT_COLUMNS` += `colore_secondario, layout`.
- `getMenuItems` select += `disponibilita_oraria`.
- `priceCartServerSide` select += `disponibilita_oraria`.

### Nuovi file
- `src/lib/config/layout.ts`, `src/lib/availability.ts`, `src/lib/csv.ts`
- `src/app/api/chiamata/route.ts`, `src/app/api/dashboard/novita/route.ts`,
  `src/app/api/dashboard/menu-template/route.ts`
- `src/app/dashboard/(app)/ordini/OrdiniClient.tsx` (+ `OrderCard` condiviso)
- Migrazioni `0008`–`0011`.

### Test runner
Nessun test runner è configurato. Introdurre **Vitest** (dev dep) per i moduli con logica pura
(`sanitizeLayout`, `brandPalette`, `parseCsv`/`rowsToItemPatches`, `isAvailableNow`/
`availabilityHint`). Aggiungere `"test": "vitest run"` a package.json. (Allinea anche
l'obiettivo "facile manutenzione".)

## Fuori scope (Fase 2)
- Import via foto/OCR del menù.
- Tag "vegetariano/vegano" sulle voci (campo dedicato) e relativo filtro.
- Fasce orarie overnight (a < da).
- Notifiche email/WhatsApp.
- Onboarding Telegram self-service (`/start` + notifica di prova + stato connessione).
- PWA / menu offline.

## Verifica per fase
Dopo ogni modulo: `npm run lint` + `npm run build` (type-check) + i test del modulo + la
prova manuale indicata. `npm run db:reset` riapplica tutte le migrazioni.
