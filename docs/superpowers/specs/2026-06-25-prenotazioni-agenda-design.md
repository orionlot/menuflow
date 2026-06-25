# Agenda prenotazioni confermate — Design

**Data:** 2026-06-25
**Stato:** approvato dall'utente

## Obiettivo

Aggiungere una vista **"Agenda"** nella dashboard Prenotazioni che mostri **solo le prenotazioni confermate in arrivo** (oggi e prossimi giorni), **raggruppate per giorno**, in formato **card**. Alimentata dal flusso di conferma esistente: appena il ristoratore conferma una richiesta, questa compare nell'agenda.

## Stato attuale (riuso)

- Tabella `prenotazioni` (`stato ∈ in_attesa|confermata|rifiutata|annullata`); nessun cambio schema.
- `src/app/dashboard/(app)/prenotazioni/page.tsx` carica già le prenotazioni con `data ≥ oggi` (Europe/Rome), ordinate per `data,ora`.
- `PrenotazioniClient.tsx` già **raggruppa per giorno** (`byDay`) e ha un toggle `da_confermare | tutte`, l'azione `setStatus` (conferma/rifiuta/annulla/ripristina) con update ottimistico.
- `setReservationStatus(id, stato)` (`actions.ts`) — riusata, nessuna action nuova.

## Cosa si costruisce

Tutto in **`src/app/dashboard/(app)/prenotazioni/PrenotazioniClient.tsx`** (un file). Niente migrazioni, niente nuove server action, nessun nuovo data-load.

### Terza tab "Agenda"
- Aggiungere `"agenda"` all'insieme dei filtri: tabs diventano `da_confermare | agenda | tutte`.
- **Default invariato**: `da_confermare` (così le richieste da gestire non si perdono).
- Vista Agenda → `visible = rows.filter(r => r.stato === "confermata")`. La pagina carica già `data ≥ oggi`, quindi sono automaticamente "in arrivo".
- Raggruppamento per giorno: riusa la logica `byDay` esistente sul `visible` filtrato.

### Intestazione giorno (in Agenda)
- Etichetta: **"Oggi"** se `data === oggi`, **"Domani"** se `data === oggi+1`, altrimenti `formatDay(data)` (weekday + giorno + mese, già presente). Helper `dayLabel(iso, today)` puro.
- Riepilogo a destra: **"N prenotazioni · M coperti"** (M = somma `coperti` del giorno).

### Card (in Agenda)
- Griglia responsiva: `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`.
- Contenuto card:
  - **Ora** in grande + **coperti** (es. "👥 4").
  - **Nome** cliente (bold).
  - **Telefono** tap-to-call (`<a href="tel:…">☎ …</a>`), **sala** se presente ("🪑 …"), **note** se presenti ("📝 …").
  - Azione **"Annulla"** → `update(r.id, "annullata")` (riusa l'update ottimistico; la card sparisce dall'Agenda).
- Stile coerente con la dashboard (bordo neutro, bg bianco, accento brand); nessun redesign delle altre viste.

### Vuoto
Agenda senza confermate in arrivo → "Nessuna prenotazione confermata in arrivo."

## Le altre tab restano com'erano
`da_confermare` e `tutte` mantengono il layout a righe attuale. Solo la tab `agenda` usa il layout a card.

## Gating
Invariato: la pagina è già dietro `isFeatureOn(restaurant, "prenotazioni")` (Plus/Pro). Nessuna nuova logica di gating.

## Aggiornamento dati
- In sessione: confermando una richiesta, `rows` passa a `confermata` (update ottimistico già presente) → cambiando tab su "Agenda" compare subito.
- A pagina ricaricata: `page.tsx` rilegge dal DB (force-dynamic). Nessun realtime necessario.

## Test / verifica
- `npx tsc --noEmit`, `npm run lint`, `npm run build` (PASS).
- Visivo: dashboard di un locale con `prenotazioni` attivo + qualche prenotazione `confermata` futura → tab "Agenda" mostra le card per giorno con riepilogo coperti; "Annulla" rimuove la card.

## Fuori scope (v1)
Niente griglia-calendario mensile, niente stato "arrivato/no-show", niente motore di disponibilità/slot, niente realtime. (Possibili evoluzioni future.)
