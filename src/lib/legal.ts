import type { DatiLegali } from "@/types/db";

const FIELDS: (keyof DatiLegali)[] = [
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
    for (const k of FIELDS) {
      const v = String(o[k] ?? "").trim().slice(0, 200);
      if (v) out[k] = v;
    }
  }
  return out;
}

/** Effective values for the policy templates, with sensible fallbacks so the
 *  pages are never blank: titolare → restaurant name, dominio → resolved host. */
export interface ResolvedLegali {
  titolare: string;
  piva: string | null;
  indirizzo: string | null;
  sedeLegale: string | null;
  email: string | null;
  pec: string | null;
  telefono: string | null;
  dominio: string;
  aggiornatoIl: string | null;
  /** True when the controller identity hasn't been filled in yet. */
  incompleto: boolean;
}

export function resolveDatiLegali(
  restaurant: { nome: string; dati_legali?: DatiLegali | null },
  host?: string | null,
): ResolvedLegali {
  const d = restaurant.dati_legali ?? {};
  return {
    titolare: d.titolare || restaurant.nome,
    piva: d.piva || null,
    indirizzo: d.indirizzo || null,
    sedeLegale: d.sede_legale || null,
    email: d.email || null,
    pec: d.pec || null,
    telefono: d.telefono || null,
    dominio: d.dominio || host || "",
    aggiornatoIl: d.aggiornato_il || null,
    incompleto: !d.titolare || !d.email,
  };
}
