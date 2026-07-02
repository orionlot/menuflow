/**
 * Per-device dashboard roles ("modalità"): after login the restaurateur picks
 * how this device is used — full dashboard, waiter or cook. The choice lives
 * in an httpOnly cookie (no localStorage) and is a FOCUS filter, not a
 * security boundary: same account, anyone can switch role from the sidebar.
 *
 * The middleware enforces it with pure path logic (no DB queries).
 */

export type Ruolo = "all" | "cameriere" | "cuoco";

export const RUOLO_COOKIE = "mf_ruolo";

/** ~6 months, in seconds. */
export const RUOLO_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export const RUOLI: { id: Ruolo; label: string }[] = [
  { id: "all", label: "All view" },
  { id: "cameriere", label: "Cameriere" },
  { id: "cuoco", label: "Cuoco" },
];

export function parseRuolo(v: unknown): Ruolo | null {
  return v === "all" || v === "cameriere" || v === "cuoco" ? v : null;
}

export function homeForRole(r: Ruolo): string {
  if (r === "cuoco") return "/dashboard/cucina";
  if (r === "cameriere") return "/dashboard/sala";
  return "/dashboard";
}

/** Path prefixes each limited role may visit (segment-safe match). */
const CAMERIERE_PREFIXES = [
  "/dashboard/sala",
  "/dashboard/ordini",
  "/dashboard/conti",
  "/dashboard/prenotazioni",
  "/dashboard/stampa", // bill print, reachable from Conti
];
const CUOCO_PREFIXES = ["/dashboard/cucina"];

/** Reachable regardless of role — login and the role picker itself. */
const ALWAYS_PREFIXES = ["/dashboard/login", "/dashboard/ruolo"];

function startsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * Whether `pathname` (under /dashboard) is reachable for the given role.
 * `null` role = cookie not set yet → only login + role picker are reachable,
 * so the first visit lands on the picker.
 */
export function allowedForRole(pathname: string, ruolo: Ruolo | null): boolean {
  if (ALWAYS_PREFIXES.some((p) => startsWithSegment(pathname, p))) return true;
  if (ruolo === "all") return true;
  if (ruolo === "cameriere") return CAMERIERE_PREFIXES.some((p) => startsWithSegment(pathname, p));
  if (ruolo === "cuoco") return CUOCO_PREFIXES.some((p) => startsWithSegment(pathname, p));
  return false; // no cookie yet → force the picker
}
