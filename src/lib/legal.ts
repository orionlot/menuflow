import type { DatiLegali } from "@/types/db";

/** Canonical legal-data field keys — single source of truth, reused by the
 *  sanitizer, the FormData readers (owner + admin actions) and the editor form. */
export const DATI_LEGALI_FIELDS: (keyof DatiLegali)[] = [
  "titolare",
  "piva",
  "indirizzo",
  "sede_legale",
  "email",
  "pec",
  "telefono",
  "dominio",
  "aggiornato_il",
];

/** Whitelist + trim the legal-data object (each field optional, length-capped). */
export function sanitizeDatiLegali(raw: unknown): DatiLegali {
  const out: DatiLegali = {};
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of DATI_LEGALI_FIELDS) {
      const v = String(o[k] ?? "").trim().slice(0, 200);
      if (v) out[k] = v;
    }
  }
  return out;
}

/** Build a plain object from FormData using the canonical field list. */
export function datiLegaliFromForm(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of DATI_LEGALI_FIELDS) o[k] = String(fd.get(k) ?? "");
  return o;
}

/** Effective values for the policy templates, with sensible fallbacks so the
 *  pages are never blank: titolare → restaurant name. The site domain is shown
 *  ONLY when explicitly configured (never reflected from the request Host). */
export interface ResolvedLegali {
  titolare: string;
  piva: string | null;
  indirizzo: string | null;
  sedeLegale: string | null;
  email: string | null;
  pec: string | null;
  telefono: string | null;
  dominio: string | null;
  aggiornatoIl: string | null;
}

export function resolveDatiLegali(restaurant: {
  nome: string;
  dati_legali?: DatiLegali | null;
}): ResolvedLegali {
  const d = restaurant.dati_legali ?? {};
  return {
    titolare: d.titolare || restaurant.nome,
    piva: d.piva || null,
    indirizzo: d.indirizzo || null,
    sedeLegale: d.sede_legale || null,
    email: d.email || null,
    pec: d.pec || null,
    telefono: d.telefono || null,
    dominio: d.dominio || null,
    aggiornatoIl: d.aggiornato_il || null,
  };
}
