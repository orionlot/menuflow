-- Availability + announcement + per-product notes (additive).
--
-- Manual open/close override (null = auto: use orari + chiusure; true = forced
-- open; false = forced closed). Overrides the fixed daily hours.
alter table public.restaurants
  add column if not exists aperto_override boolean;

-- Scheduled closures (holidays / extraordinary closed days). Array of
-- { da:"YYYY-MM-DD", a?:"YYYY-MM-DD", motivo?:string } (single day if `a` omitted).
alter table public.restaurants
  add column if not exists chiusure jsonb not null default '[]'::jsonb;

-- Front-of-house announcement banner. { testo:string, attivo:boolean }.
alter table public.restaurants
  add column if not exists annuncio jsonb not null default '{}'::jsonb;

-- Category-scoped customer-note config. Array of
-- { id, categorie:string[], label?:string, obbligatoria?:boolean }.
alter table public.restaurants
  add column if not exists note_config jsonb not null default '[]'::jsonb;

-- Per-product customer-note override. { attiva:boolean, label?:string, obbligatoria?:boolean }.
alter table public.menu_items
  add column if not exists nota jsonb not null default '{}'::jsonb;
