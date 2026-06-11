-- Fase 3 — feedback post-ordine: voto a stelle (1–5) lasciato dal cliente.
alter table public.orders
  add column if not exists voto smallint;
