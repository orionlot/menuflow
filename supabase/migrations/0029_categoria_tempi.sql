-- Per-category average prep time (minutes), e.g. {"Antipasti": 10}. Used as the
-- fallback for the KDS countdown / queue estimate when a dish has no explicit
-- tempo_preparazione of its own.
alter table public.restaurants
  add column if not exists categoria_tempi jsonb not null default '{}'::jsonb;
