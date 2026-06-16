-- Per-item composable products: a single menu item can carry its OWN composition
-- groups and size variants, independent of its category. When non-empty, these
-- override the category-level restaurants.composizione / composizione_taglie for
-- that item; when empty (the default) the category behaviour is unchanged.
-- Same JSONB shapes as the restaurant-level columns (ComposizioneGruppo[] /
-- TagliaComposizione[]); for item-level config the `categorie` field is unused.
alter table public.menu_items
  add column if not exists composizione jsonb not null default '[]';
alter table public.menu_items
  add column if not exists composizione_taglie jsonb not null default '[]';
