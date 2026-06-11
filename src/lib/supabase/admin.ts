import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Service-role client. SERVER ONLY — bypasses Row Level Security.
 *
 * Use for:
 *  - public menu reads (we select only safe columns; secrets never leave the server)
 *  - order creation from the public endpoint
 *  - webhook handlers (Stripe) and admin operations
 *
 * The `server-only` import above makes the build fail if this is ever imported
 * from a client component.
 */
export function createAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase service role not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
