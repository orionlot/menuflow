-- MenuFlow initial schema (multi-tenant menu + ordering platform)
-- See PROMPT_Claude_Code_MenuFlow.md section 3. owner_id is an additive field
-- (not in the original DDL) required to enforce per-restaurateur RLS.

-- ───────────────────────── tables ─────────────────────────

create table if not exists public.restaurants (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text unique not null,
  nome                    text not null,
  logo_url                text,
  colore_primario         text default '#c8453b',
  tema                    text default 'light',          -- 'light' | 'dark'
  piano                   text not null default 'base',  -- 'base' | 'plus' | 'pro'
  multilingua             boolean default false,
  lingue                  text[] default '{it}',
  pagamenti_attivi        boolean default false,         -- Stripe Connect on/off
  stripe_connect_id       text,                          -- restaurateur connected acct
  stripe_customer_id      text,                          -- Billing customer (we charge)
  telegram_chat_ordini    text,
  telegram_chat_pagamenti text,
  attivo                  boolean default true,          -- false = subscription suspended
  owner_id                uuid references auth.users(id) on delete set null,
  created_at              timestamptz default now()
);

create table if not exists public.menu_items (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid references public.restaurants(id) on delete cascade,
  categoria        text not null,
  nome             text not null,
  nome_i18n        jsonb default '{}'::jsonb,
  descrizione      text,
  descrizione_i18n jsonb default '{}'::jsonb,
  prezzo           numeric(8,2) not null,
  foto_url         text,
  disponibile      boolean default true,
  ordine           int default 0,
  created_at       timestamptz default now()
);

create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid references public.restaurants(id) on delete cascade,
  tavolo                text,
  items                 jsonb not null,                  -- [{item_id,nome,qta,prezzo}]
  totale                numeric(8,2) not null,
  note                  text,
  stato                 text default 'ricevuto',         -- ricevuto|in_attesa_pagamento|pagato|fallito
  pagato_at             timestamptz,
  scontrino_registrato  boolean default false,           -- management reminder, NOT fiscal
  stripe_payment_intent text,
  created_at            timestamptz default now()
);

create table if not exists public.custom_domains (
  domain        text primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade
);

create index if not exists menu_items_restaurant_idx on public.menu_items (restaurant_id);
create index if not exists orders_restaurant_created_idx on public.orders (restaurant_id, created_at desc);
create index if not exists custom_domains_restaurant_idx on public.custom_domains (restaurant_id);
create index if not exists restaurants_owner_idx on public.restaurants (owner_id);

-- ───────────────────────── RLS ─────────────────────────
-- Public menu reads + order writes go through the service role on the server
-- (selecting only safe columns), so anon needs NO direct table access.
-- Authenticated restaurateurs are scoped to their own tenant.

alter table public.restaurants   enable row level security;
alter table public.menu_items    enable row level security;
alter table public.orders        enable row level security;
alter table public.custom_domains enable row level security;

-- restaurants: owner read-only (plan/payment flags are admin-managed via service role)
create policy "owner reads own restaurant" on public.restaurants
  for select to authenticated
  using (owner_id = auth.uid());

-- menu_items: owner full CRUD within their restaurant
create policy "owner manages own menu" on public.menu_items
  for all to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = menu_items.restaurant_id and r.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.restaurants r
    where r.id = menu_items.restaurant_id and r.owner_id = auth.uid()
  ));

-- orders: owner can read + update (toggle scontrino_registrato) their orders
create policy "owner reads own orders" on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = orders.restaurant_id and r.owner_id = auth.uid()
  ));

create policy "owner updates own orders" on public.orders
  for update to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = orders.restaurant_id and r.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.restaurants r
    where r.id = orders.restaurant_id and r.owner_id = auth.uid()
  ));

create policy "owner reads own domains" on public.custom_domains
  for select to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = custom_domains.restaurant_id and r.owner_id = auth.uid()
  ));

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public)
values ('menu-photos', 'menu-photos', true)
on conflict (id) do nothing;

create policy "menu photos public read" on storage.objects
  for select using (bucket_id = 'menu-photos');

create policy "menu photos auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'menu-photos');

create policy "menu photos auth update" on storage.objects
  for update to authenticated using (bucket_id = 'menu-photos');

create policy "menu photos auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'menu-photos');
