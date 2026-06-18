/**
 * Next.js instrumentation. `onRequestError` is the central sink for server-side
 * errors thrown out of route handlers, server actions, and RSC rendering — today
 * it logs to the platform (Vercel) logs so failures are visible instead of being
 * discovered from customer complaints. Wire Sentry/OpenTelemetry here when a DSN
 * is configured (e.g. `Sentry.captureException(err)` inside onRequestError, and
 * `Sentry.init(...)` inside register()).
 */

export function register(): void {
  // Tracing / error-monitoring init goes here (no-op until a provider is wired).
}

export function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
): void {
  const where = `${request?.method ?? "?"} ${request?.path ?? "?"}`;
  console.error(`[onRequestError] ${where}`, err);
}
