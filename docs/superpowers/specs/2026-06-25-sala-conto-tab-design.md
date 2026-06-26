# Sala — modale tavolo "solo Tavolo + Conto" — Design

**Data:** 2026-06-25
**Stato:** approvato dall'utente

## Obiettivo

Quando si apre il modale "Nuovo ordine" **da un tavolo in modalità Servizio** della Sala:
1. **nascondere Asporto/Delivery** (sei a un tavolo specifico) → tipo forzato a "tavolo";
2. la riga schede diventa **「Tavolo」** (crea ordine, com'è ora) **|** **「Conto」** (nuova) dove si vede **tutto il conto di quel tavolo**, con **"Estingui conto"** quando la funzione Conti è attiva.

Il modale `ManualOrderModal` è **condiviso** con la pagina **Ordini**: lì resta invariato (Tavolo/Asporto/Delivery, niente Conto). La modifica è **contestuale**, attivata solo dalla Sala.

## Architettura

Nessun cambio schema. Tre punti.

### 1. `src/app/dashboard/actions.ts` — server action `contoTavolo`
Owner-scoped; ritorna il conto aggregato del tavolo (stessa definizione "aperto" della pagina Conti: `conto_chiuso_at NULL`, `annullato_at NULL`, `asporto=false`, `tavolo` match, `stato ∈ (ricevuto,pagato)`; e `sala` match se passata).
```ts
export async function contoTavolo(tavolo: string, sala?: string): Promise<{
  ids: string[];
  lines: { nome: string; qta: number; totCents: number }[];
  prodottiCents: number;
  copertoCents: number;
  manciaCents: number;
  totCents: number;
}>
```
Aggregazione (come ContiClient): per ogni ordine somma `items` (`qta × prezzo`) raggruppando per `nome`; `copertoCents = Σ round(coperto_tot*100)`; `manciaCents = Σ round(mancia*100)`; `prodottiCents = Σ round(prezzo*100)*qta`; `totCents = prodottiCents + copertoCents + manciaCents`. `ids` = gli id degli ordini aperti (per `estinguiConto`). Su errore/owner mancante → conto vuoto (`{ ids:[], lines:[], ...0 }`).

### 2. `src/app/dashboard/(app)/ordini/ManualOrderModal.tsx` — modalità `tableOnly` + scheda "Conto"
Nuove prop (tutte opzionali, default off → Ordini invariato):
- `tableOnly?: boolean`
- `contiOn?: boolean`
- `caricaConto?: (tavolo: string, sala?: string) => Promise<ContoData>`
- `estingui?: (ids: string[]) => Promise<void>`

Comportamento con `tableOnly`:
- `tipo` forzato a `"tavolo"`; **niente Asporto/Delivery** (il selettore `tipoOptions` non si usa).
- Nuovo stato `view: "ordine" | "conto"` (default `"ordine"`). La riga schede mostra due bottoni: **「Tavolo」** (`view="ordine"`) e **「Conto」** (`view="conto"`).
- `view==="ordine"` → il selettore prodotti attuale (carrello + footer "Crea ordine"), invariato.
- `view==="conto"` → pannello Conto: al primo ingresso chiama `caricaConto(tavolo, sala)` (stato `conto` + `loadingConto`), poi mostra:
  - voci aggregate `l.qta× l.nome … formatEUR(l.totCents)`,
  - righe coperto/mancia se `>0`,
  - **Totale** in evidenza (`formatEUR(totCents)`),
  - vuoto → "Nessun ordine aperto a questo tavolo.",
  - se `contiOn` e ci sono ordini → bottone **"Estingui conto"** → `await estingui(conto.ids)` → `onClose()` (il tavolo torna verde via realtime della Sala).
- Senza `tableOnly` (pagina Ordini): comportamento identico a oggi (tabs `tipoOptions`, nessuna scheda Conto).

### 3. `src/app/dashboard/(app)/sala/SalaClient.tsx` + `sala/page.tsx`
- `SalaActions` aggiunge `contoTavolo` ed `estinguiConto`; `SalaClient` riceve `contiOn: boolean`.
- Il `<ManualOrderModal>` aperto dalla Sala passa `tableOnly`, `contiOn`, `caricaConto={actions.contoTavolo}`, `estingui={actions.estinguiConto}`.
- `sala/page.tsx`: aggiunge `contiOn={isFeatureOn(restaurant, "conti")}` e passa `contoTavolo, estinguiConto` in `actions`.
- Dopo "Estingui conto", il modale si chiude; la **subscription realtime già esistente** (`orders`) ricolora il tavolo di verde — nessun wiring extra.

## Gating
La scheda Conto + il bottone Estingui rispettano la funzione **Conti** (`contiOn`). La vista Conto in sé (sola lettura) si può mostrare comunque; "Estingui" solo se `contiOn`. La Sala resta dietro `isFeatureOn("sala")`.

## Errori / robustezza
- `contoTavolo` su errore → conto vuoto (mai crash).
- `estingui` riusa `estinguiConto` (già auth+entitlement-checked lato server).

## Test / verifica
- `npx tsc --noEmit`, `npm run lint`, `npm run build` (PASS).
- Visivo: locale con `sala` (+ `conti`): Servizio → tocco un tavolo con ordini aperti → solo schede Tavolo/Conto; "Conto" mostra voci + totale; "Estingui conto" chiude e il tavolo torna verde. Dalla pagina Ordini il modale resta con Tavolo/Asporto/Delivery e senza Conto.

## Fuori scope (v1)
Niente pagamento dal Conto, niente split/stampa conto dal modale (la stampa aggregata resta nella pagina Conti), niente modifica delle righe dal Conto.
