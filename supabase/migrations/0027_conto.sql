-- Table-level bill settlement ("Estingui conto").
-- An order belongs to an OPEN conto when it's a confirmed dine-in sale that
-- has not been settled yet. Settling stamps `conto_chiuso_at` (it does NOT
-- cancel the order — `stato`/`annullato_at` are untouched, so it stays counted
-- in incasso/statistiche).
alter table public.orders add column if not exists conto_chiuso_at timestamptz;

-- Speeds up the "open contos for this restaurant" scan (the only query that
-- reads this column), keeping settled history out of the index.
create index if not exists orders_conto_aperto_idx
  on public.orders (restaurant_id, tavolo)
  where conto_chiuso_at is null;
