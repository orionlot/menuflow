-- Nutrition model v2 — calories per 100g + per-ingredient grams in the recipe.
--
-- Before: ingredients carried kcal "per portion"; a dish summed each listed
-- ingredient's per-portion kcal (assuming 1 portion each), with no notion of how
-- many grams of each ingredient the dish actually uses.
--
-- After: an ingredient carries `kcal_per_100g` (a stable nutritional constant)
-- and `peso` (grams of one standard portion). A dish's recipe stores the grams
-- of each ingredient. Dish weight = Σ grams; dish calories = Σ (grams/100 ×
-- kcal_per_100g). The grams default to the ingredient's `peso` when not set.

-- 1) Ingredient calories expressed per 100g. The old per-portion `kcal` had a
--    different meaning, so it is replaced (existing values must be re-entered).
alter table public.ingredients
  add column if not exists kcal_per_100g numeric;
alter table public.ingredients
  drop column if exists kcal;

-- 2) `menu_items.ingredienti` becomes a recipe: an array of
--    { "id": <ingredient_id>, "grammi": <number|null> } objects instead of a flat
--    array of id strings. grammi null ⇒ "use the ingredient's default portion".
--    Backfill: wrap existing string entries as objects; leave already-converted
--    objects untouched (idempotent); drop anything malformed.
update public.menu_items
set ingredienti = coalesce((
  select jsonb_agg(elem_obj)
  from (
    select case
             when jsonb_typeof(elem) = 'string'
               then jsonb_build_object('id', elem, 'grammi', null)
             when jsonb_typeof(elem) = 'object' and (elem ? 'id')
               then elem
             else null
           end as elem_obj
    from jsonb_array_elements(ingredienti) elem
  ) t
  where elem_obj is not null
), '[]'::jsonb)
where jsonb_typeof(ingredienti) = 'array'
  and ingredienti <> '[]'::jsonb;
