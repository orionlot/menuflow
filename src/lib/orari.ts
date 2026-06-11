import type { Orari } from "@/types/db";

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
