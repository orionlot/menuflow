-- Fase 2 — funzioni "menu".
--  menu_items.consigliato — voce in evidenza (badge "★ Consigliato").
--  menu_items.scorta      — porzioni disponibili oggi (null = illimitato; 0 = esaurito).
--  restaurants.google_review_url — link recensioni Google per la card post-ordine.
alter table public.menu_items
  add column if not exists consigliato boolean not null default false,
  add column if not exists scorta integer;

alter table public.restaurants
  add column if not exists google_review_url text;
