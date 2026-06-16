/**
 * Dynamic link building. The public tenant URL is always derived from the
 * CURRENT deployment origin (request host on the server, window.location on the
 * client) — so on Vercel the links point to your real domain, never localhost.
 *
 * Path form (`/<slug>`) is universal: it works on the apex/app domain AND on a
 * custom domain, because the middleware serves `app/[domain]` for unknown hosts.
 */
import { ROOT_DOMAIN } from "@/lib/env";

export function tenantPath(slug: string, tavolo?: string | null): string {
  const t = tavolo ? `?tavolo=${encodeURIComponent(tavolo)}` : "";
  return `/${slug}${t}`;
}

export function buildTenantUrl(
  origin: string,
  slug: string,
  tavolo?: string | null,
): string {
  return `${origin.replace(/\/+$/, "")}${tenantPath(slug, tavolo)}`;
}

/**
 * True if `url` is an https Google-Maps location link — used to validate the
 * customer-supplied delivery position on BOTH the client and the server (since
 * it's surfaced as a link the restaurateur clicks, an arbitrary host would be a
 * phishing vector). Only google.<tld> hosts and Maps' own share host
 * (maps.app.goo.gl); the generic goo.gl shortener is intentionally excluded.
 */
export function isMapsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return /^([a-z0-9-]+\.)*google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h) || h === "maps.app.goo.gl";
  } catch {
    return false;
  }
}

/**
 * Subdomain form (`slug.<root>`) — needs wildcard DNS in production. The subdomain
 * is built from the CONFIGURED apex (ROOT_DOMAIN), never from the current request
 * host: opening the dashboard at `slug.<root>` would otherwise yield
 * `slug.slug.<root>` (duplicated label). Localhost dev keeps `slug.localhost:port`.
 */
export function tenantSubdomainUrl(
  origin: string,
  slug: string,
  tavolo?: string | null,
): string {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    const t = tavolo ? `?tavolo=${encodeURIComponent(tavolo)}` : "";
    if (host === "localhost" || host.endsWith(".localhost")) {
      return `${u.protocol}//${slug}.localhost${u.port ? `:${u.port}` : ""}${t}`;
    }
    return `${u.protocol}//${slug}.${ROOT_DOMAIN}${t}`;
  } catch {
    return buildTenantUrl(origin, slug, tavolo);
  }
}

