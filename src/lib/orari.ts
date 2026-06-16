import type { Chiusura, Orari } from "@/types/db";

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Current weekday (0=Sun..6=Sat) and minutes-of-day in Europe/Rome. */
function romeNow(): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { day: map[wd] ?? 0, minutes: (hour % 24) * 60 + minute };
}

/** Open right now? Not configured (no days) ⇒ always open. */
export function isOpenNow(orari: Orari | null | undefined): boolean {
  if (!orari || !orari.giorni?.length) return true;
  const { day, minutes } = romeNow();
  if (!orari.giorni.includes(day)) return false;
  const da = toMin(orari.da);
  const a = toMin(orari.a);
  if (da == null || a == null) return true;
  return minutes >= da && minutes <= a;
}

const GIORNI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

export function orariLabel(orari: Orari | null | undefined): string | null {
  if (!orari || !orari.giorni?.length) return null;
  const g = [...orari.giorni].sort((x, y) => x - y).map((d) => GIORNI[d] ?? "?").join(" ");
  return `${g} ${orari.da}–${orari.a}`;
}

/** Today's date as "YYYY-MM-DD" in Europe/Rome. */
function romeToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Minimal restaurant shape for availability (works for Restaurant + PublicRestaurant). */
export interface AvailabilityCtx {
  aperto_override?: boolean | null;
  chiusure?: Chiusura[] | null;
  orari?: Orari | null;
}

/** The scheduled closure covering `date` (default: today in Rome), if any.
 *  ISO "YYYY-MM-DD" strings compare lexicographically, so range checks are safe. */
export function activeChiusura(
  chiusure: Chiusura[] | null | undefined,
  date: string = romeToday(),
): Chiusura | null {
  for (const c of chiusure ?? []) {
    if (!c?.da) continue;
    const end = c.a && c.a >= c.da ? c.a : c.da;
    if (date >= c.da && date <= end) return c;
  }
  return null;
}

/** Effective open/closed. The manual override and scheduled closures ALWAYS
 *  apply (they are the basic open/close control). The fixed weekly hours apply
 *  only when the "orari" feature is enabled (`opts.orariEnabled`). Precedence:
 *  manual override → active closure → weekly hours (if enabled) → open. */
export function isServiceOpen(
  r: AvailabilityCtx,
  opts: { orariEnabled?: boolean } = {},
): boolean {
  if (r.aperto_override === true) return true;
  if (r.aperto_override === false) return false;
  if (activeChiusura(r.chiusure)) return false;
  return opts.orariEnabled ? isOpenNow(r.orari) : true;
}

/** Whitelist scheduled closures: valid ISO dates, optional end ≥ start, capped. */
export function sanitizeChiusure(raw: unknown): Chiusura[] {
  if (!Array.isArray(raw)) return [];
  const isDate = (s: unknown): s is string =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  return raw
    .slice(0, 60)
    .map((c) => {
      const o = (c ?? {}) as Partial<Chiusura>;
      if (!isDate(o.da)) return null;
      const out: Chiusura = { da: o.da };
      if (isDate(o.a) && o.a >= o.da) out.a = o.a;
      const motivo = typeof o.motivo === "string" ? o.motivo.trim().slice(0, 80) : "";
      if (motivo) out.motivo = motivo;
      return out;
    })
    .filter((c): c is Chiusura => c != null);
}

export function sanitizeOrari(raw: unknown): Orari | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<Orari>;
  const giorni = Array.isArray(o.giorni)
    ? [...new Set(o.giorni.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))]
    : [];
  if (!giorni.length) return null;
  const da = typeof o.da === "string" && /^\d{1,2}:\d{2}$/.test(o.da) ? o.da : "12:00";
  const a = typeof o.a === "string" && /^\d{1,2}:\d{2}$/.test(o.a) ? o.a : "23:00";
  return { giorni, da, a };
}
