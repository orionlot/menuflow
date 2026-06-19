/**
 * Cookie registry — the SINGLE SOURCE OF TRUTH for every cookie the app uses.
 *
 * The consent banner (src/app/[domain]/CookieConsent.tsx) renders the categories
 * and per-cookie details straight from here, filtered to the cookies actually in
 * play for the current tenant (some only exist when a feature/payment is on).
 *
 * "Every new cookie is added to the banner automatically": there is no runtime
 * way to enumerate cookies you set, so the guarantee is enforced by a test
 * (cookies.test.ts) that scans the source for cookie names and fails if any is
 * not registered here. Adding a cookie therefore forces a registry entry, which
 * then shows up in the banner on its own.
 *
 * Pure + framework-agnostic (no next/headers) so it runs on both server and client.
 */
import type { FeatureId } from "./config/features";

export type ConsentCategory = "necessari" | "funzionali" | "statistiche" | "marketing";

/** Non-necessary categories — these are the ones the user can grant or deny. */
export const NON_NECESSARY: ConsentCategory[] = ["funzionali", "statistiche", "marketing"];

export interface CategoryDef {
  id: ConsentCategory;
  nome: string;
  descrizione: string;
  /** Necessary cookies can't be switched off. */
  sempre?: boolean;
}

/** Consent-mode categories, in display order. */
export const CONSENT_CATEGORIES: CategoryDef[] = [
  {
    id: "necessari",
    nome: "Necessari",
    descrizione:
      "Indispensabili per il funzionamento del sito e per ricordare le tue scelte sui cookie. Sempre attivi.",
    sempre: true,
  },
  {
    id: "funzionali",
    nome: "Funzionali",
    descrizione:
      "Ricordano scelte come il numero del tavolo e gli ordini fatti da questo dispositivo, per un'esperienza più comoda.",
  },
  {
    id: "statistiche",
    nome: "Statistiche",
    descrizione:
      "Ci aiutano a capire, in forma anonima e aggregata, come viene usato il menu per migliorarlo.",
  },
  {
    id: "marketing",
    nome: "Marketing",
    descrizione: "Usati per mostrarti contenuti o offerte pertinenti. Mai senza il tuo consenso.",
  },
];

export interface CookieDef {
  /** Exact cookie name, or a family prefix when `prefix` is true (e.g. "sb-"). */
  name: string;
  prefix?: boolean;
  category: ConsentCategory;
  /** Plain-language purpose, shown in the banner (Italian). */
  scopo: string;
  /** Human-readable lifetime, shown in the banner. */
  durata: string;
  provider: "MenuFlow" | "Stripe" | "Supabase";
  /** Which surface sets it. The consent banner only covers "public". */
  surface: "public" | "dashboard";
  /** This cookie only exists when its gate is satisfied for the tenant. */
  gate?: { feature?: FeatureId; pagamenti?: boolean };
}

export const COOKIE_REGISTRY: CookieDef[] = [
  {
    name: "mf_consent",
    category: "necessari",
    scopo: "Memorizza le tue preferenze sui cookie.",
    durata: "6 mesi",
    provider: "MenuFlow",
    surface: "public",
  },
  {
    name: "mf_tavolo",
    category: "funzionali",
    scopo: "Ricorda il numero del tavolo per non doverlo reinserire a ogni ordine.",
    durata: "4 ore",
    provider: "MenuFlow",
    surface: "public",
  },
  {
    name: "mf_ordini",
    category: "funzionali",
    scopo: 'Mostra lo stato degli ordini fatti da questo dispositivo ("Segui il tuo ordine").',
    durata: "2 ore",
    provider: "MenuFlow",
    surface: "public",
    gate: { feature: "tracking_ordine" },
  },
  {
    name: "__stripe_mid",
    category: "necessari",
    scopo: "Prevenzione delle frodi durante il pagamento online (Stripe).",
    durata: "1 anno",
    provider: "Stripe",
    surface: "public",
    gate: { pagamenti: true },
  },
  {
    name: "__stripe_sid",
    category: "necessari",
    scopo: "Prevenzione delle frodi durante il pagamento online (Stripe).",
    durata: "30 minuti",
    provider: "Stripe",
    surface: "public",
    gate: { pagamenti: true },
  },
  {
    name: "sb-",
    prefix: true,
    category: "necessari",
    scopo: "Sessione di accesso all'area di gestione del ristoratore.",
    durata: "Sessione",
    provider: "Supabase",
    surface: "dashboard",
  },
];

/** The cookies that apply to a given tenant's public menu, given its config. */
export function publicCookiesFor(opts: {
  funzioni?: Partial<Record<FeatureId, boolean>> | null;
  pagamenti?: boolean;
}): CookieDef[] {
  return COOKIE_REGISTRY.filter((c) => c.surface === "public").filter((c) => {
    if (!c.gate) return true;
    if (c.gate.feature && !opts.funzioni?.[c.gate.feature]) return false;
    if (c.gate.pagamenti && !opts.pagamenti) return false;
    return true;
  });
}

// ─── Consent state ──────────────────────────────────────────────────────────

export const CONSENT_COOKIE = "mf_consent";
/** Bump when the set of categories changes so visitors are re-asked. */
export const CONSENT_VERSION = 1;
/** ~6 months. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182;

export interface Consent {
  v: number;
  funzionali: boolean;
  statistiche: boolean;
  marketing: boolean;
}

/** Consent mode default: everything non-necessary is DENIED until the user opts in. */
export function defaultConsent(): Consent {
  return { v: CONSENT_VERSION, funzionali: false, statistiche: false, marketing: false };
}

export function grantAll(): Consent {
  return { v: CONSENT_VERSION, funzionali: true, statistiche: true, marketing: true };
}

/** Parse the consent cookie value. Returns null when absent, malformed, or from
 *  an older version (so the banner re-appears). */
export function parseConsent(raw?: string | null): Consent | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
    if (!o || o.v !== CONSENT_VERSION) return null;
    return {
      v: CONSENT_VERSION,
      funzionali: Boolean(o.funzionali),
      statistiche: Boolean(o.statistiche),
      marketing: Boolean(o.marketing),
    };
  } catch {
    return null;
  }
}

/** True when the given category may set cookies. Necessary is always allowed. */
export function hasConsent(c: Consent | null, cat: ConsentCategory): boolean {
  if (cat === "necessari") return true;
  return Boolean(c && c[cat]);
}

export function serializeConsent(c: Consent): string {
  return encodeURIComponent(JSON.stringify(c));
}
