-- Course coordination ("servi a seguire"): a single order line can be HELD so
-- the kitchen doesn't start it yet — the waiter releases it later with "Manda
-- ora". The hold is a boolean `a_seguire` flag inside orders.items (JSONB).
-- This function sets/clears it on ONE line atomically (SELECT ... FOR UPDATE),
-- leaving the kitchen stamps untouched. SECURITY INVOKER: caller RLS applies.

create or replace function public.set_item_hold(p_order_id uuid, p_line int, p_held boolean)
returns void
language plpgsql
security invoker
as $$
declare
  v_items jsonb;
  v_item jsonb;
begin
  select items into v_items from public.orders where id = p_order_id for update;
  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'Ordine non trovato';
  end if;
  if p_line < 0 or p_line >= jsonb_array_length(v_items) then
    raise exception 'Riga non valida';
  end if;
  v_item := v_items -> p_line;
  if p_held then
    v_item := v_item || jsonb_build_object('a_seguire', true);
  else
    v_item := v_item - 'a_seguire';
  end if;
  update public.orders set items = jsonb_set(v_items, array[p_line::text], v_item) where id = p_order_id;
end;
$$;
