-- Hosted Stripe Checkout for customer table payments: track the latest open
-- Checkout Session id per order so a "Paga ora" retry can EXPIRE the previous
-- session before creating a new one (prevents a stale abandoned session from
-- being completed later → double charge). Additive, nullable. The paid
-- PaymentIntent id continues to live in orders.stripe_payment_intent.
alter table public.orders
  add column if not exists stripe_checkout_session text;
