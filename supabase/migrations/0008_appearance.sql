-- Module 1 — Aspetto: a per-tenant secondary/accent colour + a small set of
-- layout choices (rounded vs square borders, product-photo position, which
-- categories hide photos, header style, list density). Stored as one jsonb blob
-- so it stays additive and easy to extend; defaults live in
-- src/lib/config/layout.ts.
alter table public.restaurants
  add column if not exists colore_secondario text,
  add column if not exists layout jsonb not null default '{}'::jsonb;
