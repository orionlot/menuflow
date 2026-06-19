-- Per-tenant legal/privacy data, used to fill the (shared) Cookie Policy and
-- Privacy Policy templates: data controller (titolare), VAT, addresses, contact
-- email, domain, etc. Editable by the restaurateur and by the platform admin.
-- Additive + defaulted; the policy pages fall back to sensible defaults when a
-- field is empty.
alter table public.restaurants
  add column if not exists dati_legali jsonb not null default '{}';
