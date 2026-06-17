-- Auto-print dedup stamp. When "Stampa automatica comande" is on, the comanda
-- can be printed from BOTH the Kitchen Display and the Ordini page (and from
-- several tabs/devices). To print each comanda exactly once, the first surface
-- to see a new order atomically claims it by setting this timestamp; any other
-- surface sees it already set and skips. Null = not yet auto-printed.
alter table public.orders
  add column if not exists comanda_stampata_at timestamptz;
