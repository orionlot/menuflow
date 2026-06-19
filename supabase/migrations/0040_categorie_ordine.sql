-- Custom category ordering on the public menu. Until now categories were always
-- shown alphabetically; this lets the restaurateur arrange them as they prefer.
-- An ordered list of category names; categories not listed (e.g. newly added)
-- fall back to alphabetical after the listed ones. Additive + defaulted.
alter table public.restaurants
  add column if not exists categorie_ordine text[] not null default '{}';
