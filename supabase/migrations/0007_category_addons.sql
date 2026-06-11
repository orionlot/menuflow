-- Aggiunte per categoria: gruppi di extra che valgono per intere categorie.
-- Es. "Patatine fritte +3€" applicato a tutte le voci della categoria "Pizze".
-- Struttura per gruppo: { id, nome, tipo, obbligatorio, categorie[], scelte[] }.
alter table public.restaurants
  add column if not exists aggiunte jsonb not null default '[]';
