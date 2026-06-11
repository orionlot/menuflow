-- Module 2 — Notifiche: track which orders the restaurateur has already seen.
-- null = non letto (new). Lets the Ordini dashboard show an unread badge + count
-- and play a sound when a new order arrives (no email, dashboard-only).
alter table public.orders
  add column if not exists visto_at timestamptz;

create index if not exists orders_unread_idx
  on public.orders (restaurant_id, visto_at, created_at);
