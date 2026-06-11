-- ───────────── #3 Allergeni + #9 Opzioni (varianti/extra) ─────────────
alter table public.menu_items
  add column if not exists allergeni text[] not null default '{}',
  add column if not exists opzioni   jsonb  not null default '[]';

-- ───────────── #9 Mancia + Coperto ─────────────
alter table public.orders
  add column if not exists mancia  numeric(8,2) not null default 0,
  add column if not exists coperti int;
alter table public.restaurants
  add column if not exists coperto        numeric(8,2) not null default 0,
  add column if not exists accetta_mancia boolean      not null default false;

-- ───────────── #4 Storage: solo il service-role può scrivere ─────────────
-- Gli upload passano da una server action che verifica owner/admin e usa il
-- service role (bypassa RLS). Niente più scritture dirette dal client.
drop policy if exists "menu photos auth insert" on storage.objects;
drop policy if exists "menu photos auth update" on storage.objects;
drop policy if exists "menu photos auth delete" on storage.objects;
-- (la policy di lettura pubblica "menu photos public read" resta.)

-- ───────────── #8 Realtime ─────────────
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.menu_items;
exception when duplicate_object then null; end $$;
