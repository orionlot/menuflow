-- 0026 — Delivery: optional Google-Maps location link captured by the customer
-- (e.g. via "Invia posizione attuale" / geolocation). Additive.
alter table public.orders
  add column if not exists posizione text;
