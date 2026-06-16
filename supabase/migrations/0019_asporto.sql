-- ───────────── Ordini da asporto ─────────────
-- Marks an order as takeaway. For asporto, `tavolo` holds the customer name
-- (for pickup) instead of a table number; coperto does not apply.
alter table public.orders
  add column if not exists asporto boolean not null default false;
