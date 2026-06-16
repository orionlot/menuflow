-- Atomic per-product stock decrement for menu_items.scorta (the "scorte"
-- feature). Mirrors consume_ingredient (0015): a single conditional UPDATE so
-- there is no read-then-write race, floors at 0, and skips unlimited (null)
-- stock. Used for BOTH non-online orders (api/ordine Case A) and online-paid
-- orders (markOrderPaid), so per-product stock decrements regardless of how the
-- order is paid.
create or replace function public.consume_menu_item(p_id uuid, p_n int)
returns void language sql as $$
  update public.menu_items
  set scorta = greatest(0, scorta - p_n)
  where id = p_id and scorta is not null;
$$;
