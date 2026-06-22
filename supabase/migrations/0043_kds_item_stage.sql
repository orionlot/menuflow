-- KDS per-item kitchen state lives inside orders.items (JSONB). This function
-- advances ONE line (or all lines when p_line is null) and recomputes the
-- order-level rollup stamps in the same UPDATE, so downstream consumers that
-- read order-level preparazione_at/pronto_at/servito_at keep working unchanged.
-- SECURITY INVOKER: the caller's RLS (owner_id = auth.uid()) applies.

create or replace function public.set_kds_stage(p_order_id uuid, p_line int, p_stage text)
returns void
language plpgsql
security invoker
as $$
declare
  v_items jsonb;
  v_now timestamptz := now();
  v_item jsonb;
  v_idx int;
  v_len int;
  v_prep timestamptz; v_pronto timestamptz; v_serv timestamptz;
  v_min_prep timestamptz; v_max_ready timestamptz; v_max_serv timestamptz;
  v_all_ready boolean := true;
  v_all_serv boolean := true;
begin
  if p_stage not in ('da_preparare','in_preparazione','pronti','serviti') then
    raise exception 'Stato cucina non valido';
  end if;

  select items into v_items from public.orders where id = p_order_id for update;
  if v_items is null then
    raise exception 'Ordine non trovato';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Ordine non valido: items non è un array';
  end if;
  v_len := jsonb_array_length(v_items);

  -- Apply the requested stage to the target line(s).
  for v_idx in 0 .. v_len - 1 loop
    if p_line is null or v_idx = p_line then
      v_item := v_items -> v_idx;
      if p_stage = 'da_preparare' then
        v_item := v_item - 'preparazione_at' - 'pronto_at' - 'servito_at';
      elsif p_stage = 'in_preparazione' then
        v_item := (v_item - 'pronto_at' - 'servito_at')
          || jsonb_build_object('preparazione_at', coalesce(v_item->'preparazione_at', to_jsonb(v_now)));
      elsif p_stage = 'pronti' then
        v_item := (v_item - 'servito_at')
          || jsonb_build_object(
               'preparazione_at', coalesce(v_item->'preparazione_at', to_jsonb(v_now)),
               'pronto_at', coalesce(v_item->'pronto_at', to_jsonb(v_now)));
      elsif p_stage = 'serviti' then
        v_item := v_item
          || jsonb_build_object('servito_at', coalesce(v_item->'servito_at', to_jsonb(v_now)));
      end if;
      v_items := jsonb_set(v_items, array[v_idx::text], v_item);
    end if;
  end loop;

  -- Recompute the order-level rollup from the items.
  if v_len = 0 then
    v_all_ready := false; v_all_serv := false;
  else
    for v_idx in 0 .. v_len - 1 loop
      v_item := v_items -> v_idx;
      v_prep := (v_item->>'preparazione_at')::timestamptz;
      v_pronto := (v_item->>'pronto_at')::timestamptz;
      v_serv := (v_item->>'servito_at')::timestamptz;
      if v_prep is not null and (v_min_prep is null or v_prep < v_min_prep) then v_min_prep := v_prep; end if;
      if coalesce(v_pronto, v_serv) is not null
         and (v_max_ready is null or coalesce(v_pronto, v_serv) > v_max_ready) then
        v_max_ready := coalesce(v_pronto, v_serv);
      end if;
      if v_serv is not null and (v_max_serv is null or v_serv > v_max_serv) then v_max_serv := v_serv; end if;
      if v_pronto is null and v_serv is null then v_all_ready := false; end if;
      if v_serv is null then v_all_serv := false; end if;
    end loop;
  end if;

  update public.orders set
    items = v_items,
    preparazione_at = v_min_prep,
    pronto_at = case when v_all_ready then v_max_ready else null end,
    servito_at = case when v_all_serv then v_max_serv else null end
  where id = p_order_id;
end;
$$;

-- One-time backfill: seed per-item stamps from the order-level stamps for every
-- order that already carries a kitchen stamp, so nothing looks reset post-deploy
-- (after this, orderStageOf(items) == the old stageOf(order) for these rows).
update public.orders o set items = (
  select jsonb_agg(
    it
    || case when o.preparazione_at is not null then jsonb_build_object('preparazione_at', to_jsonb(o.preparazione_at)) else '{}'::jsonb end
    || case when o.pronto_at is not null then jsonb_build_object('pronto_at', to_jsonb(o.pronto_at)) else '{}'::jsonb end
    || case when o.servito_at is not null then jsonb_build_object('servito_at', to_jsonb(o.servito_at)) else '{}'::jsonb end
  )
  from jsonb_array_elements(o.items) it
)
where jsonb_typeof(o.items) = 'array'
  and jsonb_array_length(o.items) > 0
  and (o.preparazione_at is not null or o.pronto_at is not null or o.servito_at is not null);
