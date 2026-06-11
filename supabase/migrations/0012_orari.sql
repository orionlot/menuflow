-- Fase 4 — orari di apertura. jsonb { giorni:int[], da:"HH:MM", a:"HH:MM" }.
-- null/empty = sempre aperto. Fuori orario gli ordini sono bloccati quando la
-- funzione "orari" è attiva (vedi src/lib/orari.ts).
alter table public.restaurants
  add column if not exists orari jsonb;
