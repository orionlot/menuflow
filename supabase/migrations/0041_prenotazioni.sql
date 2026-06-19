-- Table reservations ("prenotazioni"). Request-based: the customer submits a
-- request, the restaurateur confirms/declines from the dashboard. No availability
-- engine in v1 (no slot inventory / double-booking prevention).
--
-- Inserts happen via the service-role client (like orders) after server-side
-- validation; anon has no direct table access. The owner reads + updates their
-- own reservations via RLS (keyed on restaurants.owner_id, same as orders).
create table if not exists public.prenotazioni (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  nome          text not null,
  telefono      text not null,
  data          date not null,
  ora           text not null,                 -- "HH:MM" (local to the restaurant)
  coperti       int  not null default 1 check (coperti >= 1 and coperti <= 200),
  sala          text,
  note          text,
  stato         text not null default 'in_attesa'
                  check (stato in ('in_attesa', 'confermata', 'rifiutata', 'annullata')),
  created_at    timestamptz not null default now()
);

create index if not exists prenotazioni_restaurant_data_idx
  on public.prenotazioni (restaurant_id, data);

alter table public.prenotazioni enable row level security;

-- Owner reads their own reservations.
create policy "owner reads own reservations" on public.prenotazioni
  for select to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = prenotazioni.restaurant_id and r.owner_id = auth.uid()
  ));

-- Owner updates the status of their own reservations.
create policy "owner updates own reservations" on public.prenotazioni
  for update to authenticated
  using (exists (
    select 1 from public.restaurants r
    where r.id = prenotazioni.restaurant_id and r.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.restaurants r
    where r.id = prenotazioni.restaurant_id and r.owner_id = auth.uid()
  ));
