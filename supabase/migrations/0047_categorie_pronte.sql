-- Categories whose items skip the kitchen "to prepare / preparing" stages and
-- land directly in "Pronti" (ready to serve) the moment they're ordered — e.g.
-- water and bottled drinks that need no preparation. Configurable per restaurant
-- (a list of category names); empty array = feature off. Additive.
alter table public.restaurants
  add column if not exists categorie_pronte text[] not null default '{}';
