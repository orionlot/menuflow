-- Homepage "vetrina" (showcase carousel). The restaurateur flags a few products
-- as featured ("prodotti del giorno / di stagione / a scelta"); the public menu
-- shows them in a brand-coloured auto-advancing carousel at the top, each slide
-- carrying an optional customisable announcement. Both columns are additive and
-- nullable/defaulted so existing rows keep their current behaviour (off).
alter table public.menu_items
  add column if not exists in_vetrina boolean not null default false;

alter table public.menu_items
  add column if not exists vetrina_annuncio text;

-- Partial index: the public read filters featured items per restaurant, and only
-- a handful of rows per tenant are ever in the vetrina.
create index if not exists menu_items_vetrina_idx
  on public.menu_items (restaurant_id)
  where in_vetrina;
