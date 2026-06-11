-- Feature activation system. Two jsonb maps of { featureId: boolean }:
--  funzionalita        — the restaurateur's own on/off switches.
--  funzionalita_admin  — per-tenant admin overrides of entitlement (grant/revoke
--                        beyond the plan default). Effective availability =
--                        admin override if set, else the plan default
--                        (see src/lib/config/features.ts).
alter table public.restaurants
  add column if not exists funzionalita       jsonb not null default '{}'::jsonb,
  add column if not exists funzionalita_admin jsonb not null default '{}'::jsonb;
