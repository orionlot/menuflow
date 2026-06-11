/**
 * Dynamic link building. The public tenant URL is always derived from the
 * CURRENT deployment origin (request host on the server, window.location on the
 * client) — so on Vercel the links point to your real domain, never localhost.
 *
 * Path form (`/<slug>`) is universal: it works on the apex/app domain AND on a
 * custom domain, because the middleware serves `app/[domain]` for unknown hosts.
 */

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

/** Subdomain form (needs a custom domain + wildcard DNS in production). */
export function tenantSubdomainUrl(
  origin: string,
  slug: string,
  tavolo?: string | null,
): string {
  try {
    const u = new URL(origin);
    const t = tavolo ? `?tavolo=${encodeURIComponent(tavolo)}` : "";
    return `${u.protocol}//${slug}.${u.host}${t}`;
  } catch {
    return buildTenantUrl(origin, slug, tavolo);
  }
}

