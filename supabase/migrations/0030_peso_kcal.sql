-- Optional weight (grams) + calories (kcal) for nutrition display on the menu.
-- On ingredients these are per portion/unit, so a composable dish auto-sums them;
-- on menu_items they are an optional manual total/override. All nullable.
alter table public.ingredients
  add column if not exists peso numeric,
  add column if not exists kcal numeric;

alter table public.menu_items
  add column if not exists peso numeric,
  add column if not exists kcal numeric;
