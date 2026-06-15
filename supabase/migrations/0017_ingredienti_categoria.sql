-- ───────────── Categoria sugli ingredienti (per la tabella inventario) ─────────────
-- Optional grouping/label for ingredients (e.g. "Riso", "Pesce", "Salse").
alter table public.ingredients
  add column if not exists categoria text not null default '';
