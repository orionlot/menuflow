import type { PlanId } from "@/lib/config/plans";

/**
 * Optional features the restaurateur (and admin) can switch on/off. Three layers:
 *  1. PLAN — `pianoMinimo` defines whether the plan includes it by default.
 *  2. ADMIN — `funzionalita_admin[id]` can grant/revoke per tenant (overrides plan).
 *  3. OWNER — `funzionalita[id]` is the restaurateur's switch, within entitlement.
 * Effective ON = entitled AND owner switch (or `defaultOn` if untouched).
 */
export type FeatureId =
  | "piatto_consigliato"
  | "recensioni"
  | "profilo_allergie"
  | "orari"
  | "stampa"
  | "feedback"
  | "riepilogo"
  | "scorte"
  | "componibili"
  | "descrizione"
  | "ingredienti"
  | "asporto";

export interface FeatureDef {
  id: FeatureId;
  nome: string;
  descrizione: string;
  /** Lowest plan that includes it by default. */
  pianoMinimo: PlanId;
  /** Switch state once entitled and the owner hasn't chosen yet. */
  defaultOn: boolean;
}

const PLAN_RANK: Record<PlanId, number> = { base: 0, plus: 1, pro: 2 };

export const FEATURES: FeatureDef[] = [
  {
    id: "piatto_consigliato",
    nome: "Piatto consigliato",
    descrizione: "Badge “★ Consigliato” sulle voci che metti in evidenza.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "recensioni",
    nome: "Spinta recensioni Google",
    descrizione: "Dopo l’ordine invita il cliente a lasciare una recensione Google.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "profilo_allergie",
    nome: "Profilo allergie",
    descrizione:
      "Il cliente seleziona le sue allergie e le voci a rischio vengono evidenziate.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "orari",
    nome: "Orari di apertura",
    descrizione: "Mostra aperto/chiuso e blocca gli ordini fuori orario.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "stampa",
    nome: "Stampa comanda",
    descrizione: "Pulsante per stampare il biglietto dell’ordine (qualsiasi stampante).",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "feedback",
    nome: "Feedback post-ordine",
    descrizione: "Voto a stelle dopo l’ordine, raccolto nella dashboard.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "riepilogo",
    nome: "Riepilogo giornaliero",
    descrizione: "Recap di fine giornata: incasso, ordini, scontrini da battere.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "scorte",
    nome: "Scorte semplici",
    descrizione: "Porzioni disponibili al giorno, con auto-esaurito a zero.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "componibili",
    nome: "Prodotti componibili",
    descrizione:
      "Categorie componibili dagli ingredienti, con scorta per ingrediente.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "descrizione",
    nome: "Descrizione breve",
    descrizione: "Campo descrizione sul prodotto, mostrato sotto il nome nel menu.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "ingredienti",
    nome: "Ingredienti del prodotto",
    descrizione:
      "Spunta gli ingredienti del piatto: compaiono in elenco, separati da virgola.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "asporto",
    nome: "Ordini da asporto",
    descrizione:
      "Il cliente sceglie «Da asporto» col nome per il ritiro; se i pagamenti sono attivi può pagare in cassa.",
    pianoMinimo: "base",
    defaultOn: false,
  },
];

export const FEATURES_BY_ID = new Map(FEATURES.map((f) => [f.id, f]));

interface FeatureCtx {
  piano: PlanId;
  funzionalita?: Record<string, boolean> | null;
  funzionalita_admin?: Record<string, boolean> | null;
}

export function planAllows(piano: PlanId, id: FeatureId): boolean {
  const f = FEATURES_BY_ID.get(id);
  return f ? PLAN_RANK[piano] >= PLAN_RANK[f.pianoMinimo] : false;
}

/** Whether the tenant is ALLOWED to use a feature (plan default; admin can override). */
export function isEntitled(r: FeatureCtx, id: FeatureId): boolean {
  const override = r.funzionalita_admin?.[id];
  if (typeof override === "boolean") return override;
  return planAllows(r.piano, id);
}

/** Whether a feature is actually ACTIVE (entitled AND switched on by the owner). */
export function isFeatureOn(r: FeatureCtx, id: FeatureId): boolean {
  if (!isEntitled(r, id)) return false;
  const v = r.funzionalita?.[id];
  return typeof v === "boolean" ? v : (FEATURES_BY_ID.get(id)?.defaultOn ?? false);
}

/** Effective on/off map for every feature — for the public menu / behaviours. */
export function funzioniAttive(r: FeatureCtx): Record<FeatureId, boolean> {
  const out = {} as Record<FeatureId, boolean>;
  for (const f of FEATURES) out[f.id] = isFeatureOn(r, f.id);
  return out;
}

/** Whitelist a stored/incoming map to known feature ids with boolean values. */
export function sanitizeFunzionalita(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (raw && typeof raw === "object") {
    for (const f of FEATURES) {
      const v = (raw as Record<string, unknown>)[f.id];
      if (typeof v === "boolean") out[f.id] = v;
    }
  }
  return out;
}
