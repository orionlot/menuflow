/**
 * Centralised environment access + feature-availability flags.
 *
 * The app is designed to run locally even when external services (Stripe,
 * Telegram) are NOT configured: integrations degrade to stubs/no-ops and the
 * UI/flows that don't depend on them keep working.
 */

export const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "menuflow.it";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Server-only. Never import this into a client component. */
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Emails allowed into /admin (comma-separated in env). */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_ORDINI_TOKEN ||
      process.env.TELEGRAM_BOT_PAGAMENTI_TOKEN,
  );
}

/**
 * Distributed rate-limit store (Upstash Redis REST). Optional: when unset, the
 * limiter degrades to a per-instance in-memory window — fine for local/dev, but
 * weak under horizontal scale on Vercel (each instance counts on its own).
 */
export const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
export const UPSTASH_REDIS_REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export function isRateLimitStoreConfigured(): boolean {
  return Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);
}

export const STORAGE_BUCKET = "menu-photos";
