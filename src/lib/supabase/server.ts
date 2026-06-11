import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Auth-aware server client (RLS enforced). Use in Server Components, Route
 * Handlers, and Server Actions for the restaurateur dashboard so each user
 * only sees their own tenant's data.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components cannot set cookies; this throws there and is safely
        // ignored. Route Handlers / Server Actions / middleware can set them.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* no-op in RSC render */
        }
      },
    },
  });
}
