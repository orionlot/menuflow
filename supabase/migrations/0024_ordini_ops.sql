-- 0024 — Ordini operations: cancel, room/zone, delivery type, and persisted
-- service requests (call-waiter / ask-for-bill) for the dashboard. Additive.

-- ── orders: cancellation, room, destination type, delivery address ──
alter table public.orders
  add column if not exists annullato_at timestamptz,
  add column if not exists sala text,
  add column if not exists tipo text not null default 'tavolo',
  add column if not exists indirizzo text;

-- Backfill destination type from the existing asporto flag (delivery is new).
update public.orders
set tipo = case when asporto then 'asporto' else 'tavolo' end
where tipo = 'tavolo' and asporto is true;

-- ── service_requests: a customer at a table calls the waiter / asks the bill ──
create table if not exists public.service_requests (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tavolo        text not null,
  tipo          text not null default 'cameriere', -- 'cameriere' | 'conto'
  created_at    timestamptz not null default now(),
  gestita_at    timestamptz
);
create index if not exists service_requests_restaurant_idx
  on public.service_requests (restaurant_id, created_at desc);

alter table public.service_requests enable row level security;

-- Owner reads + updates (mark handled) their own restaurant's requests. Inserts
-- come from the service-role API (/api/chiamata), which bypasses RLS.
drop policy if exists "owner reads own service requests" on public.service_requests;
create policy "owner reads own service requests" on public.service_requests
  for select using (exists (
    select 1 from public.restaurants r
    where r.id = service_requests.restaurant_id and r.owner_id = auth.uid()
  ));

drop policy if exists "owner updates own service requests" on public.service_requests;
create policy "owner updates own service requests" on public.service_requests
  for update using (exists (
    select 1 from public.restaurants r
    where r.id = service_requests.restaurant_id and r.owner_id = auth.uid()
  )) with check (exists (
    select 1 from public.restaurants r
    where r.id = service_requests.restaurant_id and r.owner_id = auth.uid()
  ));

-- Live updates for the dashboard.
do $$ begin
  alter publication supabase_realtime add table public.service_requests;
exception when duplicate_object then null; end $$;
