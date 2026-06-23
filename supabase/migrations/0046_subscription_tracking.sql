-- Stripe Billing subscription tracking on the platform's own account. The binary
-- `attivo` is too coarse to represent the subscription's real state (past_due
-- during retries, the renewal date, the specific subscription id). Additive.
alter table public.restaurants
  add column if not exists stripe_subscription_id text,
  add column if not exists abbonamento_stato text,
  add column if not exists abbonamento_rinnovo timestamptz;
