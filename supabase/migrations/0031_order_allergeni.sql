-- Allergens the customer declares on an order at checkout (allergen ids from
-- src/lib/config/allergeni.ts). Surfaced prominently on the kitchen card so the
-- cook knows there is an allergic guest at the table.
alter table public.orders
  add column if not exists allergeni text[] not null default '{}'::text[];
