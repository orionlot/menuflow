-- Per-menu branding: a tagline/subtitle shown under the restaurant name.
-- (colore_primario, tema, logo_url already exist in 0001.)
alter table public.restaurants
  add column if not exists sottotitolo text;
