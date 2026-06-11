-- Pagamenti al tavolo: modalità test (admin). Quando true il pagamento è
-- SIMULATO (finto), quando false è REALE via Stripe Connect. Default true:
-- un locale nuovo non incassa davvero finché l'admin non disattiva il test.
alter table public.restaurants
  add column if not exists pagamenti_test boolean not null default true;
