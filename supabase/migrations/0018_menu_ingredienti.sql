-- ───────────── Ingredienti per prodotto (lista, sola visualizzazione) ─────────────
-- Per-item list of ingredient ids (referencing public.ingredients), shown to the
-- customer comma-joined. Read-only on the menu; the composable feature stays separate.
alter table public.menu_items
  add column if not exists ingredienti jsonb not null default '[]';
