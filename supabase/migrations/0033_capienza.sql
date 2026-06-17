-- Kitchen concurrency for the customer wait estimate: how many dishes the
-- kitchen prepares at once for items without a reparto (or when reparti aren't
-- used). Per-reparto overrides live in restaurants.reparti[].capienza (jsonb).
-- null/unset ⇒ treated as 1 (serial).
alter table public.restaurants
  add column if not exists capienza_default int;
