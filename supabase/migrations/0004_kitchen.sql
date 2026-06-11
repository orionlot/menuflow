-- Kitchen Display: track preparation lifecycle WITHOUT touching the payment
-- `stato` enum. An order is "in cucina" when it's a real order (ricevuto/pagato)
-- and not yet served. pronto_at = cook marked it ready (rings the bell for
-- waiters); servito_at = picked up by a waiter (leaves the screen).
alter table public.orders
  add column if not exists pronto_at   timestamptz,
  add column if not exists servito_at  timestamptz;

create index if not exists orders_kitchen_idx
  on public.orders (restaurant_id, servito_at, created_at);
