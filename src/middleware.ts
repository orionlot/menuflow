import { NextResponse, type NextRequest } from "next/server";
import { ROOT_DOMAIN } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Multi-tenant router.
 *
 * Resolves the tenant from the Host header and rewrites public traffic to
 * `app/[domain]/…`. App surfaces are NOT rewritten:
 *   /dashboard, /admin → refresh auth session, serve as-is
 *   /api               → serve as-is
 *
 * Local testing: browsers resolve `*.localhost` to 127.0.0.1, so
 *   http://pizzeria-mario.localhost:3000  ==  the "pizzeria-mario" tenant.
 * Production: `slug.menuflow.it` or a custom domain in the custom_domains table.
 */
function tenantIdentifier(host: string): string | null {
  if (!host) return null;
  const root = ROOT_DOMAIN.toLowerCase();

  if (host === root || host === `www.${root}`) return null;
  if (host === "localhost" || host === "127.0.0.1") return null;

  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(root.length + 1)).split(".")[0];
    return label === "www" ? null : label;
  }
  if (host.endsWith(".localhost")) {
    return host.slice(0, -".localhost".length).split(".")[0] || null;
  }
  // Anything else is treated as a custom domain (looked up in custom_domains).
  return host;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth-protected app surfaces: keep the session fresh, never rewrite.
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    return updateSession(request);
  }
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  // Public self-service signup — never rewrite to a tenant.
  if (pathname.startsWith("/onboarding")) {
    return NextResponse.next();
  }
  // Marketing/pitch page (app/presentazione) — never rewrite to a tenant.
  if (pathname === "/presentazione") {
    return NextResponse.next();
  }

  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const identifier = tenantIdentifier(host);

  // Root/apex domain → marketing/landing (app/page.tsx).
  if (!identifier) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${identifier}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Everything except Next internals and static asset files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
