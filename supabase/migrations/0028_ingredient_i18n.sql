-- Per-locale translations for ingredient names, mirroring menu_items.nome_i18n.
-- Base `nome` stays the Italian value; `nome_i18n` holds { "en": "...", ... }.
-- Surfaced on the public menu only (the kitchen comanda stays in the base name).
alter table public.ingredients
  add column if not exists nome_i18n jsonb not null default '{}'::jsonb;
