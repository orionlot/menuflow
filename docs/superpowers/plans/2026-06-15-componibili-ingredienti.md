# Componibili & scorta ingredienti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) — tasks are sequential and share files (db.ts, menu.ts, MenuClient, MenuManager), so do NOT parallelise. Steps use `- [ ]`.

**Goal:** Restaurateurs track per-ingredient stock; "composable" categories (e.g. Poke) let the customer pick ingredient quantities bounded by that ingredient's remaining stock (sold-out = not selectable), enforced and decremented server-side. Ship a preset Poke for testing.

**Architecture:** New `ingredients` table per restaurant with atomic stock (`scorta`). Per-category composition config in `restaurants.composizione` (JSONB, mirrors `aggiunte`) referencing ingredient ids. The order line carries a `composizione` array; `priceLines` re-prices it and validates qty ≤ stock; `api/ordine` (case A) and `markOrderPaid` (case B) decrement ingredient stock atomically. Gated behind a new "componibili" feature (Plus).

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres+RLS), TypeScript, Tailwind v4, Vitest (pure logic).

---

## Data shapes (locked)

```ts
// db.ts
export interface Ingredient {
  id: string;
  restaurant_id: string;
  nome: string;
  prezzo: number;        // EUR; default 0 = "incluso"
  scorta: number | null; // null = illimitato, 0 = esaurito
  unita: string | null;  // "porzione", "g"… display only
  ordine: number;
}
// public/runtime ingredient (no restaurant_id needed client-side)
export interface PublicIngredient { id: string; nome: string; prezzo: number; scorta: number | null; unita: string | null; }

export interface ComposizioneScelta { ingredient_id: string; prezzo?: number | null } // override; else ingredient.prezzo
export interface ComposizioneGruppo {
  id: string;
  nome: string;        // "Proteine"
  categorie: string[]; // categories the group applies to, e.g. ["Poke"]
  min: number;         // min total portions in the group (0 = optional)
  max: number;         // max total portions in the group
  ingredienti: ComposizioneScelta[];
}

// order line composition (client → server, and stored on OrderItem)
export interface OrderComposizione { ingredient_id: string; nome: string; qta: number; prezzo: number }
```

`Restaurant` gains `composizione: ComposizioneGruppo[]`. `OrderItem` gains `composizione?: OrderComposizione[]`. `PublicRestaurant` gains `composizione: ComposizioneGruppo[]` and `ingredienti: PublicIngredient[]`. `MenuItem` is unchanged (composition is category-driven). Client `CartLine` gains `composizione: OrderComposizione[]`.

---

## File structure

- Migration: `supabase/migrations/0015_componibili.sql` (new)
- Types: `src/types/db.ts` (modify)
- Sanitizers: `src/lib/menu.ts` (modify) + `src/lib/menu.test.ts` (extend)
- Pricing: `src/lib/pricing-core.ts` (modify) + `src/lib/pricing-core.test.ts` (extend); `src/lib/pricing.ts` (modify)
- Order: `src/app/api/ordine/route.ts` (modify); `src/lib/orders.ts` (modify)
- Public read: `src/lib/tenant.ts` (modify); `src/app/[domain]/page.tsx` (modify); `src/app/[domain]/MenuClient.tsx` (modify)
- Feature: `src/lib/config/features.ts` (modify)
- Dashboard: `src/app/dashboard/(app)/menu/IngredientiEditor.tsx` (new), `ComposizioneEditor.tsx` (new), `MenuManager.tsx` (modify), `menu/page.tsx` (modify), `src/app/dashboard/actions.ts` (modify)
- Seed: `supabase/seed.sql` (modify)

---

### Task 1: Migration 0015 — ingredients table + composizione column

**Files:** Create `supabase/migrations/0015_componibili.sql`

- [ ] Write the migration:
```sql
-- Per-restaurant ingredients with shared stock (atomic decrement on order).
create table if not exists public.ingredients (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  nome          text not null,
  prezzo        numeric(8,2) not null default 0,
  scorta        int,                 -- null = illimitato, 0 = esaurito
  unita         text,                -- display only
  ordine        int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists ingredients_restaurant_idx on public.ingredients (restaurant_id);

alter table public.ingredients enable row level security;
create policy "owner manages own ingredients" on public.ingredients
  for all to authenticated
  using (exists (select 1 from public.restaurants r
    where r.id = ingredients.restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r
    where r.id = ingredients.restaurant_id and r.owner_id = auth.uid()));

-- Per-category composition config (JSONB, mirrors aggiunte).
alter table public.restaurants
  add column if not exists composizione jsonb not null default '[]';

do $$ begin
  alter publication supabase_realtime add table public.ingredients;
exception when duplicate_object then null; end $$;
```
- [ ] Verify locally (if DB up): `npm run db:reset` applies cleanly. Otherwise rely on `supabase db push` on deploy. Commit.

### Task 2: Types (db.ts)

**Files:** Modify `src/types/db.ts`
- [ ] Add `Ingredient`, `PublicIngredient`, `ComposizioneScelta`, `ComposizioneGruppo`, `OrderComposizione` (shapes above).
- [ ] `Restaurant`: add `composizione: ComposizioneGruppo[]`.
- [ ] `OrderItem`: add `composizione?: OrderComposizione[]`.
- [ ] `PublicRestaurant`: add `composizione: ComposizioneGruppo[]` and `ingredienti: PublicIngredient[]`.
- [ ] `BrandingPatch` / `ItemPatch`: unchanged (composition saved via its own action).
- [ ] Verify: `npm run build` (type-check) passes. Commit.

### Task 3: Sanitizers (menu.ts) — TDD

**Files:** Modify `src/lib/menu.ts`; extend `src/lib/menu.test.ts`
- [ ] **Test first** (`menu.test.ts`): `sanitizeComposizione` keeps valid groups (cap 12 groups, 30 ingredients/group), trims names, clamps min≥0 / max≥1 / min≤max, requires `categorie` non-empty + `ingredienti` non-empty, coerces ingredient_id to string, optional `prezzo` ≥0 rounded to cents. Drops invalid groups.
- [ ] Run test → fails.
- [ ] Implement `sanitizeComposizione(raw): ComposizioneGruppo[]` (mirror `sanitizeAggiunte` structure).
- [ ] Run test → passes. Commit.

### Task 4: Pricing core — validate + price composizione vs stock — TDD

**Files:** Modify `src/lib/pricing-core.ts`; extend `src/lib/pricing-core.test.ts`
- [ ] Extend `IncomingCartLine` with `composizione?: { ingredient_id: string; qta: number }[]`.
- [ ] Add a pure `priceComposizione(args)` (or fold into `priceLines`) that takes: the item's category, the restaurant `composizione: ComposizioneGruppo[]`, an ingredient map `Map<id,{nome,prezzo,scorta}>`, and the chosen `composizione`. It must:
  - reject ingredient ids not in any group valid for the item's category → `"Ingrediente non valido"`;
  - per ingredient: `qta` integer ≥1; if `scorta != null && qta > scorta` → `scorta>0` "Scorte insufficienti per {nome}: ne restano {scorta}." else "Ingrediente esaurito: {nome}";
  - per group: total qty within `[min, max]` → "Scegli almeno N / al massimo N per {gruppo}";
  - return `{ deltaCents, lines: OrderComposizione[] }` where price = override ?? ingredient.prezzo.
- [ ] `priceLines` signature gains `composizione: ComposizioneGruppo[]` and `ingredients: Map<...>`; adds the composition delta to `unitCents`; attaches `composizione` to the returned `OrderItem`.
- [ ] **Tests**: valid poke (tonno×2 within stock 3, salmone×1), reject tonno×4 (stock 3), reject sold-out tonno (scorta 0), reject unknown ingredient, reject group max exceeded, price = base + Σ(prezzo×qty). Run → pass. Commit.

### Task 5: pricing.ts + api/ordine — fetch, enforce, decrement atomically

**Files:** Modify `src/lib/pricing.ts`, `src/app/api/ordine/route.ts`, `src/lib/orders.ts`
- [ ] `priceCartServerSide`: when the tenant has `composizione`, fetch `ingredients` (id,nome,prezzo,scorta) for the restaurant, build the map, pass `composizione` + map + each item's category into `priceLines`.
- [ ] `api/ordine` body item type gains `composizione?: { ingredient_id, qta }[]`; pass through.
- [ ] **Atomic decrement** helper (in `orders.ts` or a new `src/lib/ingredients.ts`): for each consumed ingredient, run a single `update ingredients set scorta = greatest(0, scorta - n) where id = ? and restaurant_id = ? and scorta is not null`. Aggregate consumption = Σ across order lines of (qta_ingrediente × line.qta).
- [ ] Case A (no payments): after order insert, if feature on, decrement ingredient stock (atomic). Keep existing menu_items.scorta path.
- [ ] Case B: in `markOrderPaid`, inside the race-safe `if (updated)` block, decrement ingredient stock from the stored `order.items[].composizione`.
- [ ] Gate all of the above on `isFeatureOn(restaurant, "componibili")`.
- [ ] Verify: `npm run build`. Commit.

### Task 6: Feature flag

**Files:** Modify `src/lib/config/features.ts`
- [ ] Add `"componibili"` to `FeatureId`; FEATURES entry `{ id:"componibili", nome:"Prodotti componibili", descrizione:"Categorie componibili dagli ingredienti con scorta per ingrediente.", pianoMinimo:"plus", defaultOn:false }`.
- [ ] Extend `features.test.ts` minimal (plus-gated). Commit.

### Task 7: Public read — expose composizione + ingredients

**Files:** Modify `src/lib/tenant.ts`, `src/app/[domain]/page.tsx`
- [ ] `SAFE_RESTAURANT_COLUMNS`: add `composizione`. `toPublic`: include `composizione` (default `[]`).
- [ ] Add `getPublicIngredients(restaurantId): PublicIngredient[]` (service-role select id,nome,prezzo,scorta,unita,ordine) in tenant.ts.
- [ ] `page.tsx`: fetch ingredienti when `funzioni_attive.componibili`; pass `ingredienti` to MenuClient (tenant already carries `composizione`).
- [ ] Verify build. Commit.

### Task 8: Public composition UI (MenuClient OptionsModal)

**Files:** Modify `src/app/[domain]/MenuClient.tsx`
- [ ] `MenuClient` props gain `ingredienti: PublicIngredient[]`. Compute `composizioneFor(categoria)` = groups in `tenant.composizione` whose `categorie` includes the item's category (only when `funzioni_attive.componibili`).
- [ ] `tapAdd`: open the modal when the item has options OR a composition for its category.
- [ ] In OptionsModal: render composition groups after option groups. Per group: heading (nome, "min–max"), per ingredient a **stepper (− N +)**, value in `compo` state `Record<ingredientId, qty>`, `max = min(scorta ?? ∞, group.max − groupTotal + thisQty)`; ingredient with `scorta===0` → disabled + "Esaurito" badge; price label `+€` per portion.
- [ ] Validation `missing`: any group with total < min. Confirm builds `composizione: OrderComposizione[]` and passes to `addLine(item, chosen, composizione)`.
- [ ] `addLine`/`lineKey`/`CartLine`: include composizione in unitCents (Σ prezzo×qty) and in the dedupe key; cart sheet shows the composition lines.
- [ ] Order POST body includes `composizione: [{ingredient_id, qta}]` per line.
- [ ] Verify build + lint. Commit.

### Task 9: Dashboard — ingredients CRUD + per-category composition editor

**Files:** Create `IngredientiEditor.tsx`, `ComposizioneEditor.tsx`; modify `MenuManager.tsx`, `menu/page.tsx`, `actions.ts`
- [ ] Server actions (owner-scoped, service-role write, `revalidatePath`): `listIngredients` (or pass initial from page), `upsertIngredient(patch)`, `deleteIngredient(id)`, `updateComposizione(groups)`. Sanitize inputs (`sanitizeComposizione`; ingredient nome ≤60, prezzo≥0, scorta int≥0|null).
- [ ] `menu/page.tsx`: fetch ingredients + pass `restaurant.composizione`, `componibiliOn = isFeatureOn(restaurant,"componibili")`, and the new actions to MenuManager.
- [ ] `MenuManager`: when `componibiliOn`, add two `<details>` blocks above the category list: **Ingredienti** (`IngredientiEditor`, CRUD with stock field) and **Composizione per categoria** (`ComposizioneEditor`, template = `CategoryAddonsEditor`, picks ingredients + categorie + min/max).
- [ ] Use the admin design-system tokens/components for styling.
- [ ] Verify build + lint. Commit.

### Task 10: Seed a preset Poke

**Files:** Modify `supabase/seed.sql`
- [ ] On Pizzeria (or a dedicated demo) — add the `componibili` feature on via `funzionalita`. Insert ingredients with fixed UUIDs: Tonno (`scorta 3`, prezzo 2), Salmone (prezzo 1.5), Riso (scorta null), Avocado (scorta 8), Edamame, Mango, Salsa di soia, Maionese piccante. Add a menu_item "Poke Bowl" in category "Poke". Set `restaurants.composizione` with groups: Base (Riso, min1 max1), Proteine (Tonno/Salmone, min1 max2), Topping (Avocado/Edamame/Mango, min0 max3), Salse (min0 max2).
- [ ] Verify: after `db:reset`, the Poke shows on the menu; tonno limited to 3, sold-out hides it.

### Task 11: Verify & document

- [ ] `npm test` (pure logic green), `npm run lint`, `npm run build` (clean `.next`).
- [ ] Manual test instructions in the commit / chat: enable "Componibili" on the tenant, open Poke, try tonno×4 (blocked), set tonno scorta 0 in dashboard (disappears), place order (stock decrements).

---

## Self-review checklist
- Spec coverage: ingredient stock ✓ (Task1,9), composable categories ✓ (Task7,8,9), per-ingredient max from stock + sold-out ✓ (Task4,8), server enforcement + decrement ✓ (Task4,5), preset Poke ✓ (Task10). 
- Type consistency: `composizione` (ComposizioneGruppo[]) and `OrderComposizione` names used consistently across tasks. Ingredient map keyed by id everywhere.
- Atomicity: decrement uses single conditional UPDATE (no read-then-write race), unlike the existing menu_items path.
