-- Phase 0 — foundation for the backend redesign (additive).
--
-- Per-dish fields:
--  - tempo_preparazione: prep time in minutes (drives the KDS countdown).
--  - reparto: kitchen department label (Pizzeria/Cucina/Friggitoria/…) for KDS routing.
--  - prezzo_asporto: separate takeaway/delivery price (used when the order is asporto).
--  - etichette: reusable label ids (Vegetariano, Senza lattosio, …).
--  - solo_pranzo / solo_cena: meal-period visibility flags.
alter table public.menu_items
  add column if not exists tempo_preparazione int,
  add column if not exists reparto text not null default '',
  add column if not exists prezzo_asporto numeric(8,2),
  add column if not exists etichette jsonb not null default '[]'::jsonb,
  add column if not exists solo_pranzo boolean not null default false,
  add column if not exists solo_cena boolean not null default false;

-- Kitchen lifecycle: explicit "in preparazione" start + estimated time + priority.
--  - preparazione_at: set on the cook's first click (state "in preparazione" + timer anchor).
--  - tempo_stimato: estimated minutes computed at order creation (max prep time of its items).
--  - priorita: alta|media|bassa (nullable).
alter table public.orders
  add column if not exists preparazione_at timestamptz,
  add column if not exists tempo_stimato int,
  add column if not exists priorita text;

-- Restaurant-level catalogs:
--  - reparti: configurable kitchen departments (array of { id, nome, colore }).
--  - etichette: reusable dish labels (array of { id, nome }).
alter table public.restaurants
  add column if not exists reparti jsonb not null default '[]'::jsonb,
  add column if not exists etichette jsonb not null default '[]'::jsonb;

-- Seed a sensible default department set for restaurants that have none yet.
update public.restaurants
set reparti = '[
  {"id":"cucina","nome":"Cucina","colore":"#f59e0b"},
  {"id":"pizzeria","nome":"Pizzeria","colore":"#ef4444"},
  {"id":"friggitoria","nome":"Friggitoria","colore":"#eab308"},
  {"id":"griglia","nome":"Griglia","colore":"#a855f7"},
  {"id":"dolci","nome":"Dolci","colore":"#ec4899"},
  {"id":"bar","nome":"Bar","colore":"#3b82f6"}
]'::jsonb
where reparti = '[]'::jsonb;
