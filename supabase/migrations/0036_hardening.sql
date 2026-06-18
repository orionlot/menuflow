-- Hardening pass (additive, safe to run on existing data).
--
-- 1) Money-path index: the Stripe webhooks look orders up by stripe_payment_intent
--    (lib/orders.ts markOrderPaid/markOrderFailed). Without an index that is a
--    full table scan across all tenants/history on every (often retried) webhook.
--    Partial: cash orders never set the column, so the index stays tiny.
create index if not exists orders_payment_intent_idx
  on public.orders (stripe_payment_intent)
  where stripe_payment_intent is not null;

-- 2) Reconciliation index: that screen filters/sorts paid orders by pagato_at,
--    but the only time index leads with created_at.
create index if not exists orders_pagato_idx
  on public.orders (restaurant_id, pagato_at)
  where stato = 'pagato';

-- 3) Domain CHECK constraints. The legal values previously lived only in a SQL
--    comment + TS unions; the DB would silently accept an out-of-domain value
--    that then vanishes from every in('stato',[...]) filter (revenue/KDS/recon).
--    NOT VALID: enforce all NEW writes without validating (possibly pre-existing)
--    history, so this is safe to apply on a live DB. Idempotent via drop-if-exists.
alter table public.orders drop constraint if exists orders_stato_check;
alter table public.orders
  add constraint orders_stato_check
  check (stato in ('ricevuto', 'in_attesa_pagamento', 'pagato', 'fallito')) not valid;

alter table public.orders drop constraint if exists orders_tipo_check;
alter table public.orders
  add constraint orders_tipo_check
  check (tipo in ('tavolo', 'asporto', 'delivery')) not valid;

alter table public.orders drop constraint if exists orders_priorita_check;
alter table public.orders
  add constraint orders_priorita_check
  check (priorita is null or priorita in ('alta', 'media', 'bassa')) not valid;

alter table public.restaurants drop constraint if exists restaurants_coperto_modalita_check;
alter table public.restaurants
  add constraint restaurants_coperto_modalita_check
  check (coperto_modalita in ('nessuno', 'persona', 'ordine', 'servizio')) not valid;

-- 4) Webhook idempotency ledger. Stripe can deliver an event more than once and
--    out of order; recording processed event ids lets the webhooks skip replays.
create table if not exists public.stripe_events (
  id          text primary key,           -- Stripe event.id (evt_…)
  type        text not null,
  received_at timestamptz not null default now()
);
-- Service-role only (webhooks use the admin client); RLS on with no policy = deny all.
alter table public.stripe_events enable row level security;

-- 5) Realtime cleanup: menu_items and ingredients are in the supabase_realtime
--    publication but NO client subscribes to them — every menu edit / stock
--    decrement decodes WAL + runs RLS to deliver to nobody. Drop them (guarded so
--    a fresh DB where they were never added doesn't error).
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_items') then
    alter publication supabase_realtime drop table public.menu_items;
  end if;
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ingredients') then
    alter publication supabase_realtime drop table public.ingredients;
  end if;
end $$;
