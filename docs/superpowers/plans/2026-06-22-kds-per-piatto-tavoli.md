# KDS — Vista per tavolo, avvio per piatto, minimizzazione — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-dish (per-item) kitchen state to the KDS — each dish startable/served independently and routed by reparto — plus a table-grouped view alongside the kanban and collapsible orders, keeping every downstream consumer working via an order-level rollup.

**Architecture:** Per-item kitchen timestamps live inside the existing `orders.items` JSONB. A single atomic Postgres function `set_kds_stage(order_id, line, stage)` updates one line (or all, when `line` is null) and recomputes the order-level rollup timestamps in the same UPDATE, so the customer tracker, stats, alerts and timeline keep reading order-level stamps unchanged. The client (`KitchenClient.tsx`, today ~871 monolithic lines) is split into pure derivations (`derive.ts`, unit-tested) plus presentational components (`ItemRow`, `OrderCard`, `TableGroup`, `Column`) and gains a view toggle (Per tavolo ⇄ Per stato) and ephemeral collapse.

**Tech Stack:** Next.js 15 App Router (RSC + server actions), React 19, TypeScript strict, Supabase Postgres + RLS, Tailwind v4, `@dnd-kit` (existing drag&drop), Vitest (logic tests only), Puppeteer-core + system Chrome (manual e2e).

## Global Constraints

- **User-facing strings in Italian**, verbatim where the spec quotes them.
- **No `localStorage`/`sessionStorage`** — collapse state is ephemeral React state.
- **Server-side authority**: stage transitions go through the DB function; never trust client totals/state.
- **`src/types/db.ts` is hand-maintained** — mirror every shape change there.
- **Migrations are additive**; next number is `0043`.
- **Local commits only** — never push or open PRs; the user deploys. **No `Co-Authored-By` trailer.**
- Verification per task: `npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build`. UI tasks additionally verified with a local prod build + Puppeteer on the **Caterina** tenant (`caterina-sala-consilina.localhost`, owner `claudio@caterina.com` / `caterina-demo`; pro plan, reparti + sala + per-item prep times all present).

---

## File structure

- `supabase/migrations/0043_kds_item_stage.sql` — **create**: function `set_kds_stage` + one-time backfill of per-item stamps from order-level stamps.
- `src/types/db.ts` — **modify**: add per-item kitchen-state fields to `OrderItem`.
- `src/app/dashboard/cucina/derive.ts` — **create**: pure derivations (`itemStageOf`, `orderStageOf`, `rollupTimestamps`, `applyItemStageLocal`, `groupByTable`). The only unit-tested module.
- `src/app/dashboard/cucina/derive.test.ts` — **create**: Vitest tests for the derivations.
- `src/app/dashboard/actions.ts` — **modify**: add `setItemStage`; rewrite `setOrderStage` to delegate to `set_kds_stage` (line=null).
- `src/app/api/dashboard/kitchen/route.ts` — **modify**: enrich each item with `tempo_preparazione` (alongside `reparto`).
- `src/app/dashboard/cucina/ItemRow.tsx` — **create**: one dish row (stage, reparto badge, per-item countdown, Avvia/Pronto/Ritirato controls).
- `src/app/dashboard/cucina/OrderCard.tsx` — **create**: per-item-aware card (header/allergeni/items list/order-wide footer), collapsible.
- `src/app/dashboard/cucina/TableGroup.tsx` — **create**: table-grouped block with "+ aggiunta delle HH:MM", collapsible.
- `src/app/dashboard/cucina/KitchenClient.tsx` — **modify**: orchestrator — state, realtime, view toggle, reparto filter, metrics; renders `Column`(per-stato) or `TableGroup`(per-tavolo) using `OrderCard`.

---

## Task 1: Pure derivations (`derive.ts`) — TDD

**Files:**
- Create: `src/app/dashboard/cucina/derive.ts`
- Test: `src/app/dashboard/cucina/derive.test.ts`

**Interfaces:**
- Consumes: `KitchenStage` (type) from `src/app/dashboard/actions.ts` (`"da_preparare"|"in_preparazione"|"pronti"|"serviti"`).
- Produces:
  - `ItemState = { preparazione_at?: string|null; pronto_at?: string|null; servito_at?: string|null }`
  - `itemStageOf(it: ItemState): KitchenStage`
  - `orderStageOf(items: ItemState[]): KitchenStage`
  - `rollupTimestamps(items: ItemState[]): { preparazione_at: string|null; pronto_at: string|null; servito_at: string|null }`
  - `applyItemStageLocal<T extends ItemState>(it: T, stage: KitchenStage, nowIso: string): T`
  - `groupByTable<T extends { id: string; tavolo: string|null; sala?: string|null; asporto?: boolean; created_at: string }>(orders: T[]): { key: string; tavolo: string|null; sala: string|null; asporto: boolean; orders: T[] }[]`

- [ ] **Step 1: Write the failing tests**

Create `src/app/dashboard/cucina/derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  itemStageOf,
  orderStageOf,
  rollupTimestamps,
  applyItemStageLocal,
  groupByTable,
} from "./derive";

const T0 = "2026-06-22T10:00:00.000Z";
const T1 = "2026-06-22T10:05:00.000Z";
const T2 = "2026-06-22T10:10:00.000Z";

describe("itemStageOf", () => {
  it("derives the stage from the stamps", () => {
    expect(itemStageOf({})).toBe("da_preparare");
    expect(itemStageOf({ preparazione_at: T0 })).toBe("in_preparazione");
    expect(itemStageOf({ preparazione_at: T0, pronto_at: T1 })).toBe("pronti");
    expect(itemStageOf({ servito_at: T2 })).toBe("serviti");
  });
});

describe("orderStageOf", () => {
  it("is da_preparare with no items or no stamps", () => {
    expect(orderStageOf([])).toBe("da_preparare");
    expect(orderStageOf([{}, {}])).toBe("da_preparare");
  });
  it("is in_preparazione when at least one item started", () => {
    expect(orderStageOf([{ preparazione_at: T0 }, {}])).toBe("in_preparazione");
  });
  it("is pronti only when every item is ready (pronto or served)", () => {
    expect(orderStageOf([{ pronto_at: T1 }, { preparazione_at: T0 }])).toBe("in_preparazione");
    expect(orderStageOf([{ pronto_at: T1 }, { servito_at: T2 }])).toBe("pronti");
  });
  it("is serviti only when every item is served", () => {
    expect(orderStageOf([{ servito_at: T2 }, { pronto_at: T1 }])).toBe("pronti");
    expect(orderStageOf([{ servito_at: T2 }, { servito_at: T1 }])).toBe("serviti");
  });
});

describe("rollupTimestamps", () => {
  it("preparazione_at = earliest started item", () => {
    expect(rollupTimestamps([{ preparazione_at: T1 }, { preparazione_at: T0 }]).preparazione_at).toBe(T0);
  });
  it("pronto_at is null until all ready, then the latest ready time", () => {
    expect(rollupTimestamps([{ pronto_at: T0 }, { preparazione_at: T1 }]).pronto_at).toBeNull();
    expect(rollupTimestamps([{ pronto_at: T0 }, { servito_at: T2 }]).pronto_at).toBe(T2);
  });
  it("servito_at is null until all served, then the latest", () => {
    expect(rollupTimestamps([{ servito_at: T0 }, { pronto_at: T1 }]).servito_at).toBeNull();
    expect(rollupTimestamps([{ servito_at: T0 }, { servito_at: T2 }]).servito_at).toBe(T2);
  });
});

describe("applyItemStageLocal", () => {
  it("preserves forward stamps and clears going back", () => {
    const a = applyItemStageLocal({ nome: "x", preparazione_at: T0 }, "pronti", T1);
    expect(a.preparazione_at).toBe(T0);
    expect(a.pronto_at).toBe(T1);
    const b = applyItemStageLocal(a, "da_preparare", T2);
    expect(b.preparazione_at).toBeNull();
    expect(b.pronto_at).toBeNull();
  });
});

describe("groupByTable", () => {
  it("groups same-tavolo orders and isolates asporto orders", () => {
    const g = groupByTable([
      { id: "o1", tavolo: "3", created_at: T0 },
      { id: "o2", tavolo: "3", created_at: T1 },
      { id: "o3", tavolo: null, asporto: true, created_at: T0 },
    ]);
    const tav3 = g.find((x) => x.tavolo === "3");
    expect(tav3?.orders.map((o) => o.id)).toEqual(["o1", "o2"]); // sorted by created_at
    expect(g.filter((x) => x.asporto)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run src/app/dashboard/cucina/derive.test.ts`
Expected: FAIL — `Failed to resolve import "./derive"`.

- [ ] **Step 3: Implement `derive.ts`**

Create `src/app/dashboard/cucina/derive.ts`:

```ts
import type { KitchenStage } from "@/app/dashboard/actions";

export type { KitchenStage };

/** Per-item kitchen stamps (subset of an order line). */
export interface ItemState {
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
}

/** Stage of a single dish, derived from its stamps. */
export function itemStageOf(it: ItemState): KitchenStage {
  if (it.servito_at) return "serviti";
  if (it.pronto_at) return "pronti";
  if (it.preparazione_at) return "in_preparazione";
  return "da_preparare";
}

const isReady = (it: ItemState) => Boolean(it.pronto_at || it.servito_at);

/** Order-level stage derived from its items (the chosen "all dishes" semantics). */
export function orderStageOf(items: ItemState[]): KitchenStage {
  if (items.length === 0) return "da_preparare";
  if (items.every((i) => i.servito_at)) return "serviti";
  if (items.every(isReady)) return "pronti";
  if (items.some((i) => i.preparazione_at || isReady(i))) return "in_preparazione";
  return "da_preparare";
}

const min = (xs: string[]) => xs.reduce((a, b) => (a < b ? a : b));
const max = (xs: string[]) => xs.reduce((a, b) => (a > b ? a : b));

/** Roll the per-item stamps up to order-level (mirror of the SQL in 0043). */
export function rollupTimestamps(items: ItemState[]): {
  preparazione_at: string | null;
  pronto_at: string | null;
  servito_at: string | null;
} {
  const preps = items.map((i) => i.preparazione_at).filter((x): x is string => Boolean(x));
  const ready = items
    .map((i) => i.pronto_at ?? i.servito_at)
    .filter((x): x is string => Boolean(x));
  const served = items.map((i) => i.servito_at).filter((x): x is string => Boolean(x));
  const allReady = items.length > 0 && items.every(isReady);
  const allServed = items.length > 0 && items.every((i) => i.servito_at);
  return {
    preparazione_at: preps.length ? min(preps) : null,
    pronto_at: allReady && ready.length ? max(ready) : null,
    servito_at: allServed && served.length ? max(served) : null,
  };
}

/** Optimistic per-item stamp patch (forward-preserve / backward-clear). */
export function applyItemStageLocal<T extends ItemState>(it: T, stage: KitchenStage, nowIso: string): T {
  switch (stage) {
    case "da_preparare":
      return { ...it, preparazione_at: null, pronto_at: null, servito_at: null };
    case "in_preparazione":
      return { ...it, preparazione_at: it.preparazione_at ?? nowIso, pronto_at: null, servito_at: null };
    case "pronti":
      return {
        ...it,
        preparazione_at: it.preparazione_at ?? nowIso,
        pronto_at: it.pronto_at ?? nowIso,
        servito_at: null,
      };
    case "serviti":
      return { ...it, servito_at: it.servito_at ?? nowIso };
  }
}

/** Group active orders by table; asporto/delivery orders each get their own group. */
export function groupByTable<
  T extends { id: string; tavolo: string | null; sala?: string | null; asporto?: boolean; created_at: string },
>(orders: T[]): { key: string; tavolo: string | null; sala: string | null; asporto: boolean; orders: T[] }[] {
  const keyOf = (o: T) => (o.asporto || !o.tavolo ? `solo:${o.id}` : `tav:${o.tavolo}`);
  const byKey = new Map<string, T[]>();
  for (const o of orders) {
    const k = keyOf(o);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(o);
  }
  const groups = [...byKey.entries()].map(([key, os]) => {
    const sorted = [...os].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const head = sorted[0];
    return {
      key,
      tavolo: head.tavolo,
      sala: head.sala ?? null,
      asporto: Boolean(head.asporto),
      orders: sorted,
    };
  });
  // Oldest activity first (a table waiting longest floats up).
  return groups.sort((a, b) => a.orders[0].created_at.localeCompare(b.orders[0].created_at));
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run src/app/dashboard/cucina/derive.test.ts`
Expected: PASS (6 describe blocks green).

- [ ] **Step 5: Update the full suite + type-check**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: all tests pass; no type errors. (`KitchenStage` is imported type-only from a `"use server"` file — erased at build, safe.)

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/cucina/derive.ts src/app/dashboard/cucina/derive.test.ts
git commit -m "KDS: pure per-item stage derivations + rollup (tested)"
```

---

## Task 2: Migration `0043` — `set_kds_stage` function + backfill

**Files:**
- Create: `supabase/migrations/0043_kds_item_stage.sql`
- Create (throwaway, do NOT commit): `_verify-rpc.mjs`

**Interfaces:**
- Produces: SQL function `set_kds_stage(p_order_id uuid, p_line int, p_stage text) returns void`. `p_line null` ⇒ all non-empty lines; else the 0-based line index. Sets per-item stamps and the order-level rollup atomically.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0043_kds_item_stage.sql`:

```sql
-- KDS per-item kitchen state lives inside orders.items (JSONB). This function
-- advances ONE line (or all lines when p_line is null) and recomputes the
-- order-level rollup stamps in the same UPDATE, so downstream consumers that
-- read order-level preparazione_at/pronto_at/servito_at keep working unchanged.
-- SECURITY INVOKER: the caller's RLS (owner_id = auth.uid()) applies.

create or replace function public.set_kds_stage(p_order_id uuid, p_line int, p_stage text)
returns void
language plpgsql
security invoker
as $$
declare
  v_items jsonb;
  v_now timestamptz := now();
  v_item jsonb;
  v_idx int;
  v_len int;
  v_prep timestamptz; v_pronto timestamptz; v_serv timestamptz;
  v_min_prep timestamptz; v_max_ready timestamptz; v_max_serv timestamptz;
  v_all_ready boolean := true;
  v_all_serv boolean := true;
begin
  if p_stage not in ('da_preparare','in_preparazione','pronti','serviti') then
    raise exception 'Stato cucina non valido';
  end if;

  select items into v_items from public.orders where id = p_order_id for update;
  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'Ordine non trovato';
  end if;
  v_len := jsonb_array_length(v_items);

  -- Apply the requested stage to the target line(s).
  for v_idx in 0 .. v_len - 1 loop
    if p_line is null or v_idx = p_line then
      v_item := v_items -> v_idx;
      if p_stage = 'da_preparare' then
        v_item := v_item - 'preparazione_at' - 'pronto_at' - 'servito_at';
      elsif p_stage = 'in_preparazione' then
        v_item := (v_item - 'pronto_at' - 'servito_at')
          || jsonb_build_object('preparazione_at', coalesce(v_item->'preparazione_at', to_jsonb(v_now)));
      elsif p_stage = 'pronti' then
        v_item := (v_item - 'servito_at')
          || jsonb_build_object(
               'preparazione_at', coalesce(v_item->'preparazione_at', to_jsonb(v_now)),
               'pronto_at', coalesce(v_item->'pronto_at', to_jsonb(v_now)));
      elsif p_stage = 'serviti' then
        v_item := v_item
          || jsonb_build_object('servito_at', coalesce(v_item->'servito_at', to_jsonb(v_now)));
      end if;
      v_items := jsonb_set(v_items, array[v_idx::text], v_item);
    end if;
  end loop;

  -- Recompute the order-level rollup from the items.
  if v_len = 0 then
    v_all_ready := false; v_all_serv := false;
  else
    for v_idx in 0 .. v_len - 1 loop
      v_item := v_items -> v_idx;
      v_prep := (v_item->>'preparazione_at')::timestamptz;
      v_pronto := (v_item->>'pronto_at')::timestamptz;
      v_serv := (v_item->>'servito_at')::timestamptz;
      if v_prep is not null and (v_min_prep is null or v_prep < v_min_prep) then v_min_prep := v_prep; end if;
      if coalesce(v_pronto, v_serv) is not null
         and (v_max_ready is null or coalesce(v_pronto, v_serv) > v_max_ready) then
        v_max_ready := coalesce(v_pronto, v_serv);
      end if;
      if v_serv is not null and (v_max_serv is null or v_serv > v_max_serv) then v_max_serv := v_serv; end if;
      if v_pronto is null and v_serv is null then v_all_ready := false; end if;
      if v_serv is null then v_all_serv := false; end if;
    end loop;
  end if;

  update public.orders set
    items = v_items,
    preparazione_at = v_min_prep,
    pronto_at = case when v_all_ready then v_max_ready else null end,
    servito_at = case when v_all_serv then v_max_serv else null end
  where id = p_order_id;
end;
$$;

-- One-time backfill: seed per-item stamps from the order-level stamps for every
-- order that already carries a kitchen stamp, so nothing looks reset post-deploy
-- (after this, orderStageOf(items) == the old stageOf(order) for these rows).
update public.orders o set items = (
  select jsonb_agg(
    it
    || case when o.preparazione_at is not null then jsonb_build_object('preparazione_at', to_jsonb(o.preparazione_at)) else '{}'::jsonb end
    || case when o.pronto_at is not null then jsonb_build_object('pronto_at', to_jsonb(o.pronto_at)) else '{}'::jsonb end
    || case when o.servito_at is not null then jsonb_build_object('servito_at', to_jsonb(o.servito_at)) else '{}'::jsonb end
  )
  from jsonb_array_elements(o.items) it
)
where jsonb_typeof(o.items) = 'array'
  and jsonb_array_length(o.items) > 0
  and (o.preparazione_at is not null or o.pronto_at is not null or o.servito_at is not null);
```

- [ ] **Step 2: Apply locally and confirm it loads**

Run:
```bash
npm run db:reset
node --env-file=.env.local scripts/seed-users.mjs
```
Expected: reset completes, all migrations (incl. `0043`) apply with no error, users re-seeded.

- [ ] **Step 3: Write a throwaway verification script**

Create `_verify-rpc.mjs` in the project root:

```js
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RID = "2a92ceb7-ce3a-5ef0-83b6-54953df2a50d"; // Caterina
const items = [
  { item_id: "a", nome: "Pasta", qta: 1, prezzo: 10 },
  { item_id: "b", nome: "Coca", qta: 1, prezzo: 3 },
];
const { data: ins } = await sb.from("orders").insert({ restaurant_id: RID, tavolo: "99", items, totale: 13, stato: "ricevuto" }).select("id").single();
const id = ins.id;
await sb.rpc("set_kds_stage", { p_order_id: id, p_line: 0, p_stage: "in_preparazione" });
let { data: o } = await sb.from("orders").select("items, preparazione_at, pronto_at, servito_at").eq("id", id).single();
console.log("after start line 0 → order prep set:", Boolean(o.preparazione_at), "| pronto null:", o.pronto_at === null);
await sb.rpc("set_kds_stage", { p_order_id: id, p_line: 0, p_stage: "pronti" });
await sb.rpc("set_kds_stage", { p_order_id: id, p_line: 1, p_stage: "pronti" });
({ data: o } = await sb.from("orders").select("pronto_at").eq("id", id).single());
console.log("after both lines pronti → order pronto set:", Boolean(o.pronto_at));
await sb.from("orders").delete().eq("id", id);
console.log("cleaned up");
```

- [ ] **Step 4: Run the verification**

Run: `node --env-file=.env.local _verify-rpc.mjs`
Expected output:
```
after start line 0 → order prep set: true | pronto null: true
after both lines pronti → order pronto set: true
cleaned up
```
Then delete it: `rm _verify-rpc.mjs`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0043_kds_item_stage.sql
git commit -m "KDS: migration 0043 — set_kds_stage RPC + per-item backfill"
```

---

## Task 3: Server actions — `setItemStage` + `setOrderStage` rewrite

**Files:**
- Modify: `src/app/dashboard/actions.ts:708-741` (the `setOrderStage` body) and add `setItemStage` after it.

**Interfaces:**
- Consumes: SQL `set_kds_stage` (Task 2); `KitchenStage`, `KITCHEN_STAGES` (already in this file).
- Produces: `setItemStage(orderId: string, lineIndex: number, stage: KitchenStage): Promise<void>`; `setOrderStage(orderId: string, stage: KitchenStage): Promise<void>` (same signature, new body).

- [ ] **Step 1: Replace the `setOrderStage` body**

Replace lines `708-741` (the whole current `setOrderStage` function) with:

```ts
export async function setOrderStage(orderId: string, stage: KitchenStage) {
  // Server actions are public endpoints: never trust the (type-erased) argument.
  if (!KITCHEN_STAGES.includes(stage)) throw new Error("Stato cucina non valido.");
  const supabase = await createSupabaseServerClient();
  // p_line null ⇒ apply the stage to every line of the order (the "move all"
  // shortcut used by the kanban drag and the order-wide footer buttons).
  const { error } = await supabase.rpc("set_kds_stage", {
    p_order_id: orderId,
    p_line: null,
    p_stage: stage,
  });
  if (error) throw new Error(error.message);
}

/**
 * Kitchen: advance a SINGLE dish (line) of an order. The DB function recomputes
 * the order-level rollup atomically, so two stations advancing different dishes
 * of the same order never clobber each other (row lock). RLS-scoped.
 */
export async function setItemStage(orderId: string, lineIndex: number, stage: KitchenStage) {
  if (!KITCHEN_STAGES.includes(stage)) throw new Error("Stato cucina non valido.");
  if (!Number.isInteger(lineIndex) || lineIndex < 0) throw new Error("Riga non valida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_kds_stage", {
    p_order_id: orderId,
    p_line: lineIndex,
    p_stage: stage,
  });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`createSupabaseServerClient` and `KITCHEN_STAGES` are already imported/declared in this file.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/actions.ts
git commit -m "KDS: setItemStage action + setOrderStage via set_kds_stage RPC"
```

---

## Task 4: Types + feed enrichment (`tempo_preparazione` per item)

**Files:**
- Modify: `src/types/db.ts` (the `OrderItem` interface).
- Modify: `src/app/api/dashboard/kitchen/route.ts:47-75` (the reparto enrichment block).

**Interfaces:**
- Produces: `OrderItem` gains `preparazione_at?`, `pronto_at?`, `servito_at?`, `reparto?`, `tempo_preparazione?`. Feed returns each item enriched with `reparto` (existing) **and** `tempo_preparazione` (new) when the `reparto` feature is on.

- [ ] **Step 1: Extend `OrderItem` in `src/types/db.ts`**

Find the `OrderItem` interface (fields `item_id, nome, qta, prezzo, opzioni?, composizione?, taglia?, nota?`) and add:

```ts
  // KDS per-item kitchen state (stored in orders.items; rolled up to the order).
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
  // Resolved at feed time from menu_items (not persisted on the line).
  reparto?: string | null;
  tempo_preparazione?: number | null;
```

- [ ] **Step 2: Enrich the kitchen feed with prep time**

In `src/app/api/dashboard/kitchen/route.ts`, change the menu_items lookup to also select `tempo_preparazione`, and attach it per item. Replace the block at lines `57-74` with:

```ts
    const metaById = new Map<string, { reparto: string | null; tempo_preparazione: number | null }>();
    if (orderedIds.length) {
      const { data: rows } = await supabase
        .from("menu_items")
        .select("id, reparto, tempo_preparazione")
        .eq("restaurant_id", restaurant.id)
        .in("id", orderedIds);
      for (const r of (rows ?? []) as {
        id: string;
        reparto: string | null;
        tempo_preparazione: number | null;
      }[]) {
        metaById.set(r.id, { reparto: r.reparto ?? null, tempo_preparazione: r.tempo_preparazione ?? null });
      }
    }
    orders = orders.map((o) => ({
      ...o,
      items: (Array.isArray(o.items) ? (o.items as { item_id?: string }[]) : []).map((it) => {
        const meta = it.item_id ? metaById.get(it.item_id) : undefined;
        return { ...it, reparto: meta?.reparto ?? null, tempo_preparazione: meta?.tempo_preparazione ?? null };
      }),
    }));
```

- [ ] **Step 3: Type-check + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean. (The per-item stamps already flow through because they live in `orders.items`.)

- [ ] **Step 4: Commit**

```bash
git add src/types/db.ts src/app/api/dashboard/kitchen/route.ts
git commit -m "KDS: per-item state on OrderItem + tempo_preparazione in kitchen feed"
```

---

## Task 5: `ItemRow` + `OrderCard` — per-item controls in the kanban

Extract the order card out of `KitchenClient.tsx` and make it per-item aware. The kanban keeps working (orders placed by **derived** stage); each dish gets its own Avvia/Pronto controls and reparto badge; the order-wide footer becomes "avvia/pronto/ritira tutto".

**Files:**
- Create: `src/app/dashboard/cucina/ItemRow.tsx`
- Create: `src/app/dashboard/cucina/OrderCard.tsx`
- Modify: `src/app/dashboard/cucina/KitchenClient.tsx` — export the shared `KOrder`/`KItem` types and `Reparto` map helpers; replace the inline `Card` usage with `<OrderCard>`; place orders into columns by `orderStageOf(o.items)`; add `onItemStage`/`onOrderStage` callbacks (optimistic via `applyItemStageLocal` + `rollupTimestamps`, then call the actions).

**Interfaces:**
- Consumes: `derive.ts` (`itemStageOf`, `orderStageOf`, `applyItemStageLocal`, `rollupTimestamps`); `setItemStage`, `setOrderStage` (Task 3); `KItem`, `KOrder`, `Reparto`.
- Produces:
  - `ItemRow` props: `{ item: KItem; lineIndex: number; repartoOn: boolean; repartoById: Map<string, Reparto>; tempoStimatoOn: boolean; now: number; onStage(lineIndex: number, stage: KitchenStage): void }`.
  - `OrderCard` props: `{ order: KOrder; stage: KitchenStage; repartoOn: boolean; repartoById: Map<string, Reparto>; repFilter: string | null; tempoStimatoOn: boolean; now: number; collapsed: boolean; onToggleCollapse(): void; onItemStage(lineIndex: number, stage: KitchenStage): void; onOrderStage(stage: KitchenStage): void; onPriorita(): void; onRistampa(): void }`.

- [ ] **Step 1: Export shared types from `KitchenClient.tsx`**

In `src/app/dashboard/cucina/KitchenClient.tsx`, add `export` to the `KItem` and `KOrder` interface declarations (lines 22 and 43) so the new components can import them:

```ts
export interface KItem { /* …existing fields… */ }
export interface KOrder { /* …existing fields… */ }
```

Also add the per-item stamps to `KItem` (mirror of `OrderItem`):

```ts
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
  tempo_preparazione?: number | null;
```

- [ ] **Step 2: Create `ItemRow.tsx`**

Create `src/app/dashboard/cucina/ItemRow.tsx`:

```tsx
"use client";

import type { KItem } from "./KitchenClient";
import type { Reparto } from "@/types/db";
import { itemStageOf, type KitchenStage } from "./derive";

function itemDetails(it: KItem): string[] {
  return [
    ...(it.opzioni ?? []).map((x) => x.scelta),
    ...(it.composizione ?? []).map((c) => `${c.qta}× ${c.nome}`),
    ...(it.nota ? [`📝 ${it.nota}`] : []),
  ];
}

/** mm:ss remaining for one dish (negative ⇒ overrun, shown with +). */
function countdown(it: KItem, now: number): { text: string; late: boolean } | null {
  if (!it.preparazione_at || !it.tempo_preparazione) return null;
  const end = new Date(it.preparazione_at).getTime() + it.tempo_preparazione * 60000;
  const ms = end - now;
  const late = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const mm = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return { text: `${late ? "+" : ""}${mm}:${ss}`, late };
}

const NEXT: Record<KitchenStage, { stage: KitchenStage; label: string } | null> = {
  da_preparare: { stage: "in_preparazione", label: "Avvia" },
  in_preparazione: { stage: "pronti", label: "Pronto" },
  pronti: { stage: "serviti", label: "Ritira" },
  serviti: null,
};

export default function ItemRow({
  item,
  lineIndex,
  repartoOn,
  repartoById,
  tempoStimatoOn,
  now,
  onStage,
}: {
  item: KItem;
  lineIndex: number;
  repartoOn: boolean;
  repartoById: Map<string, Reparto>;
  tempoStimatoOn: boolean;
  now: number;
  onStage: (lineIndex: number, stage: KitchenStage) => void;
}) {
  const stage = itemStageOf(item);
  const rep = repartoOn && item.reparto ? repartoById.get(item.reparto) : null;
  const details = itemDetails(item);
  const cd = tempoStimatoOn && stage === "in_preparazione" ? countdown(item, now) : null;
  const next = NEXT[stage];
  const done = stage === "serviti";
  const ready = stage === "pronti";

  return (
    <li className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${done ? "opacity-50" : ready ? "bg-green-500/10" : stage === "in_preparazione" ? "bg-sky-500/10" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{item.qta}×</span>
          <span className="truncate">{item.nome}</span>
          {item.taglia ? <span className="text-sm opacity-70">· {item.taglia}</span> : null}
          {rep ? (
            <span className="rounded px-1.5 text-[11px] font-bold" style={{ background: rep.colore ?? "#3338", color: "#fff" }}>
              {rep.nome}
            </span>
          ) : null}
        </div>
        {details.length ? <p className="text-sm opacity-70">{details.join(" · ")}</p> : null}
      </div>
      {cd ? (
        <span className={`shrink-0 tabular-nums text-sm font-bold ${cd.late ? "text-red-400" : "text-sky-300"}`}>⏱ {cd.text}</span>
      ) : null}
      {next ? (
        <button
          onClick={() => onStage(lineIndex, next.stage)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-sm font-bold ${
            ready ? "bg-green-600 text-white" : stage === "in_preparazione" ? "bg-amber-500 text-black" : "bg-white/15 text-white"
          }`}
        >
          {next.label}
        </button>
      ) : (
        <span className="shrink-0 text-green-400">✓</span>
      )}
    </li>
  );
}
```

- [ ] **Step 3: Create `OrderCard.tsx`**

Create `src/app/dashboard/cucina/OrderCard.tsx`. Reuse the existing card header/allergen markup from `KitchenClient.tsx` Card (lines 709-763) — destination label, priority badge, age/`PRONTO 🔔`, the red allergen banner — and replace the body items list + footer:

```tsx
"use client";

import type { KOrder } from "./KitchenClient";
import type { Reparto } from "@/types/db";
import ItemRow from "./ItemRow";
import { type KitchenStage } from "./derive";

const ORDER_NEXT: Record<KitchenStage, { stage: KitchenStage; label: string } | null> = {
  da_preparare: { stage: "in_preparazione", label: "Avvia tutto" },
  in_preparazione: { stage: "pronti", label: "Tutto pronto" },
  pronti: { stage: "serviti", label: "Ritira tutto" },
  serviti: null,
};

export default function OrderCard({
  order,
  stage,
  repartoOn,
  repartoById,
  repFilter,
  tempoStimatoOn,
  now,
  collapsed,
  onToggleCollapse,
  onItemStage,
  onOrderStage,
}: {
  order: KOrder;
  stage: KitchenStage;
  repartoOn: boolean;
  repartoById: Map<string, Reparto>;
  repFilter: string | null;
  tempoStimatoOn: boolean;
  now: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onItemStage: (lineIndex: number, stage: KitchenStage) => void;
  onOrderStage: (stage: KitchenStage) => void;
}) {
  const dest = order.asporto ? `Asporto · ${order.tavolo ?? ""}`.trim() : `Tavolo ${order.tavolo ?? "—"}`;
  // Keep the line's original index so per-item actions hit the right JSONB element.
  const lines = order.items.map((it, i) => ({ it, i }));
  const shown = repFilter ? lines.filter(({ it }) => it.reparto === repFilter) : lines;
  const next = ORDER_NEXT[stage];

  return (
    <article className="rounded-xl border border-white/10 bg-neutral-900 text-neutral-100">
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <button onClick={onToggleCollapse} className="flex items-center gap-2 font-bold">
          <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
          {dest}{order.sala ? <span className="opacity-70">· {order.sala}</span> : null}
        </button>
        {/* (reuse the existing priority badge + age/PRONTO indicator markup here) */}
      </header>

      {order.allergeni?.length ? (
        <p className="mx-3 mb-2 rounded bg-red-600/90 px-2 py-1 text-sm font-bold">⚠️ Allergeni: {order.allergeni.join(", ")}</p>
      ) : null}

      {!collapsed && (
        <>
          <ul className="space-y-1 px-2 pb-2">
            {shown.map(({ it, i }) => (
              <ItemRow
                key={i}
                item={it}
                lineIndex={i}
                repartoOn={repartoOn}
                repartoById={repartoById}
                tempoStimatoOn={tempoStimatoOn}
                now={now}
                onStage={onItemStage}
              />
            ))}
          </ul>
          {next ? (
            <div className="px-3 pb-3">
              <button onClick={() => onOrderStage(next.stage)} className="w-full rounded-lg bg-white/10 py-2 text-sm font-bold hover:bg-white/20">
                {next.label}
              </button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
```

> The priority flag / ristampa icon buttons and the exact age/`PRONTO 🔔`/check indicators are lifted verbatim from the current `Card` (KitchenClient.tsx:709-805). Preserve their existing handlers (`onPriorita`, `onRistampa`) by threading them through `OrderCard` props as in the current code.

- [ ] **Step 4: Wire `OrderCard` into `KitchenClient` (kanban by derived stage)**

In `KitchenClient.tsx`:
- import `{ orderStageOf, applyItemStageLocal, rollupTimestamps }` from `./derive`, `setItemStage` from `../../actions`, and `OrderCard`.
- replace `stageOf` usage in the `byColumn` derivation (line ~328) with `orderStageOf(o.items)`.
- add the optimistic per-item handler:

```ts
const onItemStage = useCallback((orderId: string, lineIndex: number, stage: KitchenStage) => {
  const nowIso = new Date().toISOString();
  setOrders((prev) =>
    prev.map((o) => {
      if (o.id !== orderId) return o;
      const items = o.items.map((it, i) => (i === lineIndex ? applyItemStageLocal(it, stage, nowIso) : it));
      return { ...o, items, ...rollupTimestamps(items) };
    }),
  );
  void setItemStage(orderId, lineIndex, stage).catch(() => load());
}, [load]);
```
- keep `moveTo`/`onOrderStage` calling `setOrderStage` (now "all items") with optimistic `applyStageLocal` updated to also patch items: after setting the order stamps, map items through `applyItemStageLocal(it, stage, now)`.
- render `<OrderCard order={o} stage={orderStageOf(o.items)} … onItemStage={(li,s)=>onItemStage(o.id,li,s)} onOrderStage={(s)=>moveTo(o,s)} … />` inside each `Column`.

- [ ] **Step 5: Build + e2e (kanban still works, per-dish controls live)**

Run: `npm run build` (expect clean). Then with Docker up, start a prod server and drive Caterina's KDS:
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npx next start -p 3000 &
```
Puppeteer (system Chrome, login `claudio@caterina.com`/`caterina-demo`, goto `http://localhost:3000/dashboard/cucina`): assert the board renders, click a single dish's **Avvia** button, screenshot, and confirm via service-role query that that order's `preparazione_at` is set and `pronto_at` is still null (only one of ≥2 dishes started). Tear down the test order.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/cucina/ItemRow.tsx src/app/dashboard/cucina/OrderCard.tsx src/app/dashboard/cucina/KitchenClient.tsx
git commit -m "KDS: per-item dish controls (ItemRow/OrderCard); kanban placed by derived order stage"
```

---

## Task 6: `TableGroup` + view toggle (Per tavolo)

**Files:**
- Create: `src/app/dashboard/cucina/TableGroup.tsx`
- Modify: `src/app/dashboard/cucina/KitchenClient.tsx` — add `view` state (`"stato" | "tavolo"`), a toggle in the toolbar, and a per-tavolo render path using `groupByTable`.

**Interfaces:**
- Consumes: `groupByTable`, `orderStageOf` (derive); `OrderCard`.
- Produces: `TableGroup` props: `{ group: { key; tavolo; sala; asporto; orders: KOrder[] }; …shared OrderCard props (repartoOn, repartoById, repFilter, tempoStimatoOn, now); collapsed: Set<string>; onToggle(id: string): void; onItemStage(orderId, lineIndex, stage): void; onOrderStage(orderId, stage): void }`.

- [ ] **Step 1: Create `TableGroup.tsx`**

Create `src/app/dashboard/cucina/TableGroup.tsx`:

```tsx
"use client";

import type { KOrder } from "./KitchenClient";
import type { Reparto } from "@/types/db";
import OrderCard from "./OrderCard";
import { orderStageOf, type KitchenStage } from "./derive";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

export default function TableGroup({
  group,
  repartoOn,
  repartoById,
  repFilter,
  tempoStimatoOn,
  now,
  collapsed,
  onToggle,
  onItemStage,
  onOrderStage,
}: {
  group: { key: string; tavolo: string | null; sala: string | null; asporto: boolean; orders: KOrder[] };
  repartoOn: boolean;
  repartoById: Map<string, Reparto>;
  repFilter: string | null;
  tempoStimatoOn: boolean;
  now: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onItemStage: (orderId: string, lineIndex: number, stage: KitchenStage) => void;
  onOrderStage: (orderId: string, stage: KitchenStage) => void;
}) {
  const title = group.asporto ? `Asporto · ${group.tavolo ?? group.orders[0].tavolo ?? ""}`.trim() : `Tavolo ${group.tavolo ?? "—"}`;
  const groupCollapsed = collapsed.has(group.key);
  const totalItems = group.orders.reduce((n, o) => n + o.items.length, 0);
  const done = group.orders.flatMap((o) => o.items).filter((i) => i.pronto_at || i.servito_at).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-2">
      <header className="flex items-center justify-between px-1 py-1">
        <button onClick={() => onToggle(group.key)} className="flex items-center gap-2 text-lg font-extrabold">
          <span aria-hidden>{groupCollapsed ? "▸" : "▾"}</span>
          {title}{group.sala ? <span className="opacity-70 text-base">· {group.sala}</span> : null}
        </button>
        <span className="text-sm opacity-70">{group.orders.length > 1 ? `${group.orders.length} ordini · ` : ""}{done}/{totalItems} pronti</span>
      </header>
      {!groupCollapsed && (
        <div className="space-y-2">
          {group.orders.map((o, idx) => (
            <div key={o.id}>
              {idx > 0 ? <p className="px-2 pb-1 text-xs font-semibold text-amber-300">+ aggiunta delle {hhmm(o.created_at)}</p> : null}
              <OrderCard
                order={o}
                stage={orderStageOf(o.items)}
                repartoOn={repartoOn}
                repartoById={repartoById}
                repFilter={repFilter}
                tempoStimatoOn={tempoStimatoOn}
                now={now}
                collapsed={collapsed.has(o.id)}
                onToggleCollapse={() => onToggle(o.id)}
                onItemStage={(li, s) => onItemStage(o.id, li, s)}
                onOrderStage={(s) => onOrderStage(o.id, s)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add the view toggle + per-tavolo render in `KitchenClient`**

- add state: `const [view, setView] = useState<"stato" | "tavolo">("stato");`
- add a two-button toggle in the toolbar (Italian labels **Per stato** / **Per tavolo**), styled like the existing reparto filter buttons.
- when `view === "tavolo"`: compute `groupByTable(visible)` (reuse the already-`repFilter`-filtered `visible` list — note `groupByTable`'s generic accepts `KOrder`) and render a responsive grid of `<TableGroup>`; the DnD context + 4 `Column`s render only when `view === "stato"`.

- [ ] **Step 3: Build + e2e (table view + later addition)**

Run: `npm run build` (clean). Puppeteer on Caterina: switch to **Per tavolo**; create two orders for the same `tavolo` a few seconds apart (via the manual-order modal or a service-role insert with staggered `created_at`); assert they appear under one table group and the second shows **"+ aggiunta delle HH:MM"**. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cucina/TableGroup.tsx src/app/dashboard/cucina/KitchenClient.tsx
git commit -m "KDS: vista «Per tavolo» con raggruppamento + «aggiunta delle HH:MM»"
```

---

## Task 7: Minimize / collapse

**Files:**
- Modify: `src/app/dashboard/cucina/KitchenClient.tsx` — collapse `Set<string>` state + toggle handler + default-collapse served orders.

**Interfaces:**
- Consumes: `OrderCard`/`TableGroup` `collapsed`/`onToggle` props (already defined in Tasks 5-6).
- Produces: a single ephemeral `collapsed: Set<string>` keyed by order id AND table-group key, shared by both views.

- [ ] **Step 1: Add collapse state + handler**

In `KitchenClient.tsx`:

```ts
const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
const toggleCollapse = useCallback((id: string) => {
  setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}, []);
```

Pass `collapsed={collapsed.has(o.id)} onToggleCollapse={() => toggleCollapse(o.id)}` to each `OrderCard` (per-stato view) and `collapsed={collapsed} onToggle={toggleCollapse}` to each `TableGroup`.

- [ ] **Step 2: Default-collapse fully-served orders**

When the feed loads, auto-add served orders' ids to `collapsed` once (don't fight the user afterwards):

```ts
// inside load(), after setOrders(next):
setCollapsed((prev) => {
  const out = new Set(prev);
  for (const o of next) if (o.servito_at && !seenCollapse.current.has(o.id)) { out.add(o.id); seenCollapse.current.add(o.id); }
  return out;
});
```
with `const seenCollapse = useRef<Set<string>>(new Set());` near the other refs.

- [ ] **Step 3: Build + e2e (collapse persists across refetch)**

Run: `npm run build` (clean). Puppeteer on Caterina: collapse an order, wait past one realtime/poll refetch (~9s), screenshot, and assert the order is still collapsed (the `Set` survives because the component isn't remounted). Confirm no `localStorage`/`sessionStorage` is used (grep the new files).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/cucina/KitchenClient.tsx
git commit -m "KDS: minimizzazione ordini/gruppi (stato effimero) + auto-collapse serviti"
```

---

## Task 8: Full e2e + downstream coherence + final verification

**Files:** none (verification only; commit only if a fix is needed).

- [ ] **Step 1: Full suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all green; `derive.test.ts` included.

- [ ] **Step 2: End-to-end on Caterina (Docker up, prod build)**

Drive the KDS via Puppeteer and confirm, in order:
1. **Per-dish start** — start one dish of a 2-dish order; order moves to *In preparazione*; the other dish still shows *Avvia*.
2. **Order rollup** — mark all dishes pronti; order enters the *Pronti* column / shows ready.
3. **Reparto filter as station view** — filter to `Bar`; only drink rows show; starting a drink advances only that line.
4. **Per tavolo** — second order for the same table nests under the group with *+ aggiunta delle HH:MM*.
5. **Minimize** — collapse persists across a refetch.

- [ ] **Step 3: Downstream coherence**

With a service-role query, for an order whose dishes were advanced individually, assert the order-level `preparazione_at`/`pronto_at`/`servito_at` match the rollup rules, and load the customer tracker `http://caterina-sala-consilina.localhost:3000/ordine/<id>` to confirm it shows *In preparazione* until all dishes are pronto, then *Pronto*. Spot-check `/dashboard/statistiche` renders without error.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "KDS: fixes from end-to-end verification"
```

---

## Self-review notes

- **Spec coverage:** table view (T6), later-addition marker (T6), minimize (T7), per-dish start + reparto routing (T5), per-item state in JSONB + rollup (T1/T2), RPC (T2), actions (T3), feed prep-time (T4), downstream-unchanged (verified T8). View toggle keeping the kanban (T6). No new feature flag (none added). ✓
- **Type consistency:** `KitchenStage` from `actions.ts` used everywhere; `setItemStage(orderId, lineIndex, stage)` / `setOrderStage(orderId, stage)` signatures match T3↔T5; `set_kds_stage(p_order_id, p_line, p_stage)` params match T2↔T3; `ItemState`/`KItem` per-item fields match T1↔T4↔T5. ✓
- **No placeholders:** every code step is complete; the only deliberate "reuse existing markup" reference (OrderCard header/priority/ristampa) cites exact current lines (KitchenClient.tsx:709-805) rather than re-deriving behavior. ✓
