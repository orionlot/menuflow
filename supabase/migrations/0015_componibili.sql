-- ───────────── Prodotti componibili + scorta ingredienti ─────────────
-- Per-restaurant ingredients with shared stock (decremented atomically on order).
create table if not exists public.ingredients (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  nome          text not null,
  prezzo        numeric(8,2) not null default 0,
  scorta        int,                 -- null = illimitato, 0 = esaurito
  unita         text,                -- display only ("porzione", "g"…)
  ordine        int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists ingredients_restaurant_idx on public.ingredients (restaurant_id);

alter table public.ingredients enable row level security;

-- Owner full CRUD within their own restaurant (same pattern as menu_items).
create policy "owner manages own ingredients" on public.ingredients
  for all to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = ingredients.restaurant_id and r.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.restaurants r
    where r.id = ingredients.restaurant_id and r.owner_id = auth.uid()
  ));

-- Per-category composition config (JSONB array of ComposizioneGruppo, mirrors aggiunte).
alter table public.restaurants
  add column if not exists composizione jsonb not null default '[]';

-- Live stock updates in the dashboard.
do $$ begin
  alter publication supabase_realtime add table public.ingredients;
exception when duplicate_object then null; end $$;

-- Atomic stock decrement (no read-then-write race): floors at 0, skips unlimited.
create or replace function public.consume_ingredient(p_id uuid, p_n int)
returns void language sql as $$
  update public.ingredients
  set scorta = greatest(0, scorta - p_n)
  where id = p_id and scorta is not null;
$$;
