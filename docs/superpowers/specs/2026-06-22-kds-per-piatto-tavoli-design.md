# KDS — Vista per tavolo, avvio per piatto, minimizzazione — Design

**Data:** 2026-06-22
**Area:** `src/app/dashboard/cucina/` (Kitchen Display System) + modello ordini

## Obiettivo

Tre miglioramenti alla cucina, decisi con l'utente:

1. **Vista «Per tavolo»** — gli ordini attivi raggruppati per tavolo; un riordino successivo dallo stesso tavolo entra nel gruppo come blocco distinto, marcato come «aggiunta delle HH:MM».
2. **Avvio per singola portata** — il cuoco avvia/segna pronto ogni piatto in autonomia; ogni piatto porta il suo **reparto** (badge), e il **filtro reparto** già esistente fa da "vista postazione".
3. **Minimizzazione** degli ordini/gruppi per una UX più pulita.

## Decisioni confermate (brainstorming)

- **Viste:** interruttore **Per tavolo ⇄ Per stato (kanban)** — si mantengono entrambe.
- **Postazioni:** avvio per piatto + **filtro reparto** esistente (nessuna schermata dedicata per reparto).
- **Stato ordine:** **derivato dai piatti** — «in preparazione» al primo piatto avviato, «pronto» quando *tutti* i piatti sono pronti, «servito» quando *tutti* serviti.

## Stato attuale (com'è oggi)

- 4 colonne kanban (`da_preparare → in_preparazione → pronti → serviti`) **derivate dai timestamp a livello ordine** (`preparazione_at`/`pronto_at`/`servito_at`) via `stageOf()`. Nessuno stato memorizzato.
- Transizioni **per intero ordine** via `setOrderStage(orderId, stage)` (`src/app/dashboard/actions.ts`), da pulsanti o drag&drop. Ottimismo locale via `applyStageLocal()`.
- **Reparto:** non è sull'ordine; viene risolto da `menu_items.reparto` al momento del feed (`src/app/api/dashboard/kitchen/route.ts`) e aggiunto a ogni item. Esiste un **filtro** reparto (flag `reparto`).
- `orders.items` è un array **JSONB**: `{ item_id, nome, qta, prezzo, opzioni?, composizione?, taglia?, nota? }`. Nessuno stato per piatto.
- `KitchenClient.tsx` è **monolitico (~871 righe)**: stato in cima, componenti `Column` e `Card` nello stesso file.
- A valle leggono i timestamp **a livello ordine**: order-tracker cliente (`[domain]/ordine/[id]/OrderTracker.tsx` + `api/ordine/[id]`), statistiche (`src/lib/stats.ts`), alert dashboard (`dashboard/(app)/page.tsx`), timeline ordini (`ordini/OrdiniClient.tsx`). La stima attesa (`api/attesa` + `src/lib/attesa.ts`) e i conti **non** leggono lo stato cucina.

## Architettura proposta

### 1. Modello dati — stato per piatto in JSONB + rollup (scelta A)

Ogni riga di `orders.items` acquisisce campi di stato cucina opzionali:

```ts
export interface OrderItem {
  item_id: string;
  nome: string;
  qta: number;
  prezzo: number;
  opzioni?: OrderItemOption[];
  composizione?: OrderComposizione[];
  taglia?: string;
  nota?: string;
  // NUOVI — stato cucina per piatto (tutti opzionali / nullable)
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
}
```

Non serve migrazione di colonna (JSONB è schemaless): si aggiornano i tipi in `src/types/db.ts`. La migrazione introduce **una funzione RPC** e (opzionale) un backfill (vedi §6).

**Perché non una tabella `order_items`:** imporrebbe di denormalizzare opzioni/composizione, una doppia fonte di verità e una migrazione pesante; tutti i consumer leggono già `orders.items`. Lo stato per piatto in JSONB è la strada meno invasiva.

### 2. Derivazione dello stato ordine (il rollup)

I timestamp **a livello ordine restano** ma diventano una **cache derivata** dei piatti, mantenuta a ogni cambio di stato di un piatto:

- `ordine.preparazione_at` = **min** dei `preparazione_at` dei piatti non annullati (≠ null appena parte il primo piatto).
- `ordine.pronto_at` = **max** dei `pronto_at` **solo se tutti** i piatti non annullati sono pronti; altrimenti `null`.
- `ordine.servito_at` = **max** dei `servito_at` **solo se tutti** i piatti non annullati sono serviti; altrimenti `null`.

Conseguenza chiave: **tutti i consumer a valle restano invariati**, perché continuano a leggere i timestamp a livello ordine, che ora riflettono la semantica «tutti i piatti» scelta dall'utente. L'unica regola resa esplicita: lato cliente «pronto» = tutti i piatti pronti.

Un piatto senza stato esplicito è trattato come `da_preparare`. La derivazione di stage per piatto riusa la logica di `stageOf()` sui campi del piatto.

### 3. Aggiornamenti atomici (RPC)

Nuova funzione DB (migrazione `0043_kds_item_stage.sql`), `SECURITY INVOKER` così la **RLS dell'invocante** (proprietario) si applica:

```
set_item_stage(p_order_id uuid, p_line int, p_stage text) returns void
```

- valida `p_stage ∈ {da_preparare,in_preparazione,pronti,serviti}`;
- blocca la riga ordine (`SELECT ... FOR UPDATE`), legge `items`;
- applica al piatto `p_line` la stessa logica preserva-avanti / azzera-indietro di `setOrderStage`;
- ricalcola il rollup (§2) e scrive in **un'unica UPDATE** sia `items` sia i 3 timestamp ordine.

Il row-lock di Postgres serializza due reparti che avviano piatti diversi dello stesso ordine: nessun aggiornamento perso.

**Server actions** (`src/app/dashboard/actions.ts`), client anon+cookie (RLS):
- `setItemStage(orderId, lineIndex, stage)` → `supabase.rpc('set_item_stage', …)`.
- `setOrderStage(orderId, stage)` **riscritta**: applica lo stage a **tutti** i piatti non annullati + rollup (resta usata dal drag e dal pulsante "tutto"). Mantiene la firma esistente.

### 4. Feed API

`src/app/api/dashboard/kitchen/route.ts`: i timestamp per piatto sono già in `items`. Si **estende l'arricchimento** per riga aggiungendo, oltre a `reparto`, anche `tempo_preparazione` (da `menu_items`) per i countdown per piatto. Filtro/ordinamento del feed invariati.

### 5. Client — refactor + due viste

`KitchenClient.tsx` viene **scomposto** (refactoring mirato) in:

- `kitchen/derive.ts` — funzioni pure: `itemStageOf(item)`, `orderStageOf(order)` (derivato), `rollupTimestamps(items)` (per l'ottimismo locale), raggruppamento per tavolo.
- `kitchen/ItemRow.tsx` — riga-piatto: nome/qta/opzioni/taglia/nota, **badge reparto**, stato, **countdown per piatto** (se `tempo_stimato`/prep disponibile), pulsanti **Avvia / Pronto / (Ritirato)** per piatto.
- `kitchen/OrderCard.tsx` — card consapevole dei piatti: header (tavolo/sala/ora) → banner allergeni → lista `ItemRow` → footer azioni "ordine intero" (avvia tutto / pronto tutto). **Collapse** per ordine.
- `kitchen/TableGroup.tsx` — gruppo-tavolo della vista «Per tavolo»: intestazione (tavolo/sala, riepilogo "n piatti · da fare / pronti"), ordini come blocchi; i riordini successivi mostrano **«+ aggiunta delle HH:MM»**. **Collapse** per gruppo.
- `kitchen/Column.tsx` — colonna kanban (vista «Per stato»), invariata nello scopo ma usa `OrderCard`.
- `KitchenClient.tsx` — orchestratore: stato, realtime, **toggle vista**, filtro reparto, metriche.

**Toggle vista** (in alto): `Per tavolo` | `Per stato`.
- **Per stato:** l'ordine si colloca nella colonna per **stato derivato** (§2). Drag di un ordine = scorciatoia "sposta tutti i piatti" (riusa `setOrderStage`). I pulsanti per piatto restano nelle righe.
- **Per tavolo:** gruppi per `tavolo`; asporto/delivery in gruppi separati per nome/etichetta. Ordini interi serviti escono dal board come oggi (filtro feed last-2h invariato).

**Filtro reparto:** quando attivo, le righe-piatto di altri reparti sono **nascoste**; un ordine/gruppo senza piatti del reparto selezionato è nascosto interamente (come il comportamento odierno). Le metriche e l'avvio per piatto operano sul reparto filtrato → "vista postazione" (es. Bar).

### 6. Minimizzazione

Stato di collapse **effimero in React** (un `Set` di id ordine/gruppo) — niente `localStorage`/`sessionStorage` (vincolo di progetto). Persiste tra i refetch realtime (il componente non viene smontato), si azzera solo al reload completo. Default: ordini **interamente serviti** collassati; il resto espanso.

### 7. Compatibilità ordini in corso (backfill)

Migrazione `0043`: per gli ordini **attivi** (`servito_at is null`, `annullato_at is null`) si **seminano** i timestamp per piatto da quelli a livello ordine (tutti i piatti ricevono `preparazione_at`/`pronto_at`/`servito_at` dell'ordine, dove presenti), così al deploy nulla appare "resettato". Gli ordini storici non vengono toccati.

### 8. Gating, realtime, perf

- **Nessun nuovo feature-flag:** il toggle vista e la minimizzazione sono UX core; l'avvio per piatto funziona sempre; i badge/filtro reparto restano sotto il flag `reparto` esistente.
- **Realtime invariato:** subscribe su `orders` → refetch (`load()`); l'ottimismo locale aggiorna item+rollup prima della risposta.
- **Perf:** payload invariato (i timestamp per piatto sono pochi campi nel JSONB già caricato).

## A valle (downstream) — impatto

Grazie al rollup (§2): order-tracker cliente, `api/ordine/[id]`, `stats.ts`, alert dashboard, timeline `OrdiniClient`, `api/attesa`, conti → **nessuna modifica funzionale**. Verifica esplicita in fase di test che i timestamp ordine restino coerenti.

## File toccati (rappresentativo)

- **Migrazione:** `supabase/migrations/0043_kds_item_stage.sql` (RPC `set_item_stage` + backfill ordini attivi).
- **Tipi:** `src/types/db.ts` (`OrderItem` per-item state).
- **Actions:** `src/app/dashboard/actions.ts` (`setItemStage` nuova; `setOrderStage` riscritta su tutti i piatti + rollup).
- **Feed:** `src/app/api/dashboard/kitchen/route.ts` (arricchimento `tempo_preparazione` per piatto).
- **Client (refactor + nuovo):** `src/app/dashboard/cucina/KitchenClient.tsx` + nuovi `kitchen/derive.ts`, `ItemRow.tsx`, `OrderCard.tsx`, `TableGroup.tsx`, `Column.tsx`.

## Verifica

- `npx tsc --noEmit` · `npm run lint` · `npm run build`.
- `npx vitest run` con **test nuovi** su `kitchen/derive.ts`: `orderStageOf`/`rollupTimestamps` per i casi: nessun piatto avviato, alcuni avviati, tutti pronti, mix con piatto annullato, tutti serviti.
- e2e su **Caterina** (Docker su): avvio di un singolo piatto → la colonna/gruppo e i timestamp ordine si aggiornano; secondo ordine stesso tavolo → «+ aggiunta delle HH:MM»; minimizzazione; filtro reparto come vista postazione. Conferma che order-tracker cliente e statistiche restino coerenti.

## Fuori scope (YAGNI)

- Schermata fisica dedicata per reparto (scartata: basta il filtro).
- Stato per piatto esposto al cliente (il cliente vede solo lo stato ordine derivato).
- Nuovi feature-flag.
- Tabella `order_items` separata.
