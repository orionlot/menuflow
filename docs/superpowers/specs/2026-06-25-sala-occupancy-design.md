# Sala sincronizzata con ordini/conti (tavoli occupati/liberi) — Design

**Data:** 2026-06-25
**Stato:** approvato dall'utente

## Obiettivo

Nella dashboard **Sala**, in modalità **Servizio**, colorare ogni tavolo **🟠 arancione se occupato** / **🟢 verde se libero**, sincronizzato dal vivo con ordini e conti. Quando si avvia un ordine a un tavolo, quel tavolo diventa subito arancione; quando il tavolo si libera, torna verde.

## Logica "occupato" (confermata)

Un tavolo è **occupato** se esiste almeno un ordine "aperto" per quel tavolo:
`annullato_at IS NULL` **AND** `asporto = false` **AND** `tavolo IS NOT NULL` **AND** `stato ∈ (ricevuto, pagato)` **AND**
- se **Conti attivo** → `conto_chiuso_at IS NULL` (si libera con "Estingui conto");
- se **Conti spento** → `servito_at IS NULL` (si libera quando l'ordine è servito).

(È la stessa definizione di "tavolo aperto" della pagina **Conti**, resa consapevole della funzione Conti per evitare tavoli "occupati per sempre" quando Conti è spento.)

**Abbinamento ordine ↔ tavolo della mappa**: un `SalaTavolo` `t` nella stanza `room` è occupato se esiste un ordine aperto con `order.tavolo === t.nome` **e** (`order.sala` è NULL **oppure** `order.sala === room.nome`). Gli ordini manuali avviati dalla Sala passano già `sala`; gli ordini cliente la hanno se `sala_ordine` è on; altrimenti combacia per solo nome tavolo.

## Architettura

Nessun cambio schema. Tre punti:

### 1. `src/app/dashboard/(app)/sala/page.tsx` — carica i tavoli occupati
Aggiunge una query (consapevole di Conti) su `orders` selezionando solo `tavolo, sala`:
```ts
const contiOn = isFeatureOn(restaurant, "conti");
let q = supabase.from("orders").select("tavolo, sala")
  .eq("restaurant_id", restaurant.id)
  .is("annullato_at", null)
  .eq("asporto", false)
  .not("tavolo", "is", null)
  .in("stato", ["ricevuto", "pagato"]);
q = contiOn ? q.is("conto_chiuso_at", null) : q.is("servito_at", null);
const { data: occ } = await q;
```
Passa a `SalaClient`: `restaurantId={restaurant.id}`, `initialOccupied={(occ ?? []) as {tavolo:string; sala:string|null}[]}`, e l'azione `tavoliOccupati` in `actions`.

### 2. `src/app/dashboard/actions.ts` — server action `tavoliOccupati()`
Owner-scoped; ripete la query qui sopra e ritorna `{ tavolo: string; sala: string | null }[]`. Usata per il refetch in realtime (RLS + scope su `owner_id`).

### 3. `src/app/dashboard/(app)/sala/SalaClient.tsx` — colore + realtime
- Nuove prop: `restaurantId: string`, `initialOccupied: {tavolo:string; sala:string|null}[]`, `actions.tavoliOccupati: () => Promise<{tavolo:string; sala:string|null}[]>`.
- Stato `occupied` inizializzato da `initialOccupied`.
- `refreshOccupied()` = `setOccupied(await actions.tavoliOccupati())` (last-write-wins).
- **Realtime**: `useEffect` con `createSupabaseBrowserClient().channel(`sala-${restaurantId}`).on("postgres_changes", { event:"*", schema:"public", table:"orders", filter:`restaurant_id=eq.${restaurantId}` }, () => refreshOccupied()).subscribe()`, cleanup `removeChannel` (stesso pattern di ContiClient).
- Dopo un ordine manuale: in `onCreate` del `ManualOrderModal`, sostituire `router.refresh()` con `await refreshOccupied()` (aggiorna lo stato occupied; la sub realtime fa comunque da rete di sicurezza).
- **Helper** `isOccupied(t, room)`: `occupied.some(o => o.tavolo === t.nome && (o.sala == null || o.sala === room?.nome))`.
- **Marker del tavolo** (`mode === "servizio"`): sfondo + bordo
  - occupato → bg `#ffedd5`, bordo `#fb923c` (arancione);
  - libero → bg `#dcfce7`, bordo `#22c55e` (verde);
  - in `modifica` resta com'è (bg bianco). Il numero del tavolo resta in testo scuro (leggibile su entrambe le tinte).
- **Legenda + contatore** (solo servizio): "🟢 Libero · 🟠 Occupato" + "N occupati" (numero di tavoli della stanza corrente risultati occupati).

## Gating
Invariato: la pagina è già dietro `isFeatureOn(restaurant, "sala")`. La colorazione è puramente visiva, nessun nuovo gating.

## Errori / robustezza
- `tavoliOccupati()` su errore DB ritorna `[]` (la mappa mostra tutto libero, mai un crash). 
- Realtime non disponibile (no env) → resta il caricamento iniziale + il refetch dopo ordine manuale.
- `refreshOccupied` race: replace completo dello stato, eventually-consistent (la sub re-emette).

## Test / verifica
- `npx tsc --noEmit`, `npm run lint`, `npm run build` (PASS).
- Visivo: locale con `sala` (e qualche tavolo disegnato) → modalità Servizio: un ordine aperto a un tavolo lo mostra arancione, gli altri verdi; estinguendo il conto (o servendo, se Conti spento) torna verde; legenda + contatore corretti.

## Fuori scope (v1)
Niente "libera tavolo" manuale, niente stato intermedio (prenotato), niente conteggio coperti sul tavolo, niente colorazione in modalità Modifica.
