-- ───────────── Taglie per prodotti componibili (Medium / Large …) ─────────────
-- A size caps the max selections per composition group for a category.
-- Stored per-restaurant; price is unchanged by size (sizes only change quantities).
alter table public.restaurants
  add column if not exists composizione_taglie jsonb not null default '[]';
