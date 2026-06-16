-- 0025 — Sala (floor plan). Per-tenant room/table layout the restaurateur draws;
-- in service mode, tapping a table starts an order. Additive JSONB on restaurants.
--
-- Shape: sale = [ { id, nome, tavoli: [ { id, nome, x, y, posti? } ] } ]
--   x/y are 0–100 percentages of the canvas (responsive positioning).
alter table public.restaurants
  add column if not exists sale jsonb not null default '[]'::jsonb;
