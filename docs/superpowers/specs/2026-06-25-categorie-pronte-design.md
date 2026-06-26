# Categorie auto "pronte da servire" in cucina — Design

**Data:** 2026-06-25
**Stato:** approvato dall'utente

## Obiettivo

Permettere al ristoratore di scegliere **categorie di prodotti** i cui piatti, appena ordinati, compaiono **direttamente in "Pronti da servire"** nella cucina (KDS), saltando "Da preparare"/"In preparazione". Esempio: ordine [Antipasto + Acqua] con categoria "Bevande" impostata → l'Antipasto va in **Da preparare**, l'Acqua va in **Pronti** all'istante. Configurabile per categoria → flessibile per ogni locale.

## Come funziona (riuso)

Lo stato KDS di un piatto è **derivato dai timestamp** (`itemStageOf`): `pronto_at` impostato → **"Pronti"**. Quindi basta, alla creazione dell'ordine, stampare `preparazione_at = pronto_at = adesso` sui piatti delle categorie scelte. KDS e tracker non cambiano.

## Architettura

### 1. Config — migrazione `0047` + tipi
- `0047_categorie_pronte.sql`: `alter table public.restaurants add column if not exists categorie_pronte text[] not null default '{}'`.
- `src/types/db.ts` `Restaurant`: `categorie_pronte: string[]` (accanto a `categorie_ordine`).
- Vuota = funzione spenta (nessun feature-flag: è una configurazione, come `categorie_ordine`/`categoria_tempi`).

### 2. Helper puro + sanitizer — `src/lib/menu.ts`
- `sanitizeCategoriePronte(raw): string[]` — identico a `sanitizeCategorieOrdine` (trim, dedup, cap 100, max 60 char).
- `markCategoriePronte(lines, categoriaById, categoriePronte, nowIso): T[]` — **pura, unit-testabile**:
  ```ts
  export function markCategoriePronte<T extends {
    item_id: string; a_seguire?: boolean; preparazione_at?: string | null; pronto_at?: string | null;
  }>(lines: T[], categoriaById: Record<string, string | null | undefined>, categoriePronte: string[], nowIso: string): T[] {
    if (!categoriePronte.length) return lines;
    const ready = new Set(categoriePronte);
    return lines.map((l) => {
      const cat = categoriaById[l.item_id];
      if (l.a_seguire || !cat || !ready.has(cat)) return l;     // held items are never auto-readied
      return { ...l, preparazione_at: nowIso, pronto_at: nowIso };
    });
  }
  ```

### 3. Azione owner — `src/app/dashboard/actions.ts`
- `updateCategoriePronte(value)` — come `updateCategorieOrdine`: `update({ categorie_pronte: sanitizeCategoriePronte(value) })`, `revalidatePath("/dashboard/menu")`.

### 4. Creazione ordine (entrambi i percorsi)
- **`src/app/api/ordine/route.ts`**: dopo `finalLines`, se `restaurant.categorie_pronte.length`, fai un fetch `id, categoria` su `menu_items` per gli `orderedIds`, costruisci `categoriaById`, e applica `markCategoriePronte(finalLines, categoriaById, restaurant.categorie_pronte, now)`. Usa il risultato nell'insert (`items: …`).
- **`createManualOrder` (`actions.ts`)**: identico — dopo `finalLines`, fetch `id, categoria` per gli item ordinati, `markCategoriePronte(...)`, insert con il risultato.

### 5. UI — `src/app/dashboard/(app)/menu/MenuManager.tsx`
- Una **multi-selezione delle categorie del menu** (toggle/checkbox per categoria) accanto alla configurazione **tempi per categoria** (sezione config cucina). Salva via `updateCategoriePronte`. Etichetta es. *"Categorie pronte da servire automaticamente"* + nota *"I piatti di queste categorie (es. bevande) saltano la preparazione e vanno direttamente in «Pronti» in cucina."*

## Comportamento / rollup
- Ordine [Antipasto da_preparare + Acqua pronto] → `rollupTimestamps`: `pronto_at` ordine = null (non TUTTI pronti) → l'ordine resta "in cucina". Per-piatto, l'Acqua è già "Pronti"; il tracker cliente (piatto-per-piatto) mostra l'Acqua "pronto". Corretto.
- Un piatto **"a seguire"** non viene auto-prontato (il cameriere l'ha tenuto apposta).

## Test
- **Unit (vitest)**: `markCategoriePronte` — stampa pronto_at/preparazione_at solo per le righe in categoria pronta; salta `a_seguire`; no-op se lista vuota; lascia invariate le altre.
- **Statico**: `tsc`, `eslint`, `npx vitest run`, `npm run build`.
- **Manuale**: imposta "Bevande" come categoria pronta → ordina antipasto + acqua → in Cucina l'acqua è in "Pronti", l'antipasto in "Da preparare".

## Fuori scope (v1)
Niente auto-servito (resta "pronti", il cameriere lo serve), niente per-item-id (è per categoria), niente gating per piano (config libera come `categorie_ordine`).
