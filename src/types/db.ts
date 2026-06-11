/**
 * Hand-written types mirroring the Postgres schema (see
 * supabase/migrations/0001_init.sql). Kept in sync manually.
 */

export type OrderStatus =
  | "ricevuto"
  | "in_attesa_pagamento"
  | "pagato"
  | "fallito";

export type PlanId = "base" | "plus" | "pro";

/** How the cover charge is applied. */
export type CopertoModalita = "nessuno" | "persona" | "ordine" | "servizio";

/** Per-tenant menu layout choices (Module 1 — Aspetto). Stored as jsonb;
 *  defaults + validation live in src/lib/config/layout.ts. */
export interface MenuLayout {
  bordi: "arrotondati" | "squadrati";
  foto_pos: "lato" | "sopra";
  /** Categories whose product photos are hidden on the public menu. */
  foto_categorie_nascoste: string[];
  intestazione: "banner" | "minimal";
  densita: "comoda" | "compatta";
  font: "classico" | "moderno" | "elegante" | "tondo";
}

export interface Restaurant {
  id: string;
  slug: string;
  nome: string;
  sottotitolo: string | null;
  logo_url: string | null;
  colore_primario: string;
  colore_secondario: string | null;
  tema: "light" | "dark";
  layout: MenuLayout;
  piano: PlanId;
  multilingua: boolean;
  lingue: string[];
  pagamenti_attivi: boolean;
  stripe_connect_id: string | null;
  stripe_customer_id: string | null;
  telegram_chat_ordini: string | null;
  telegram_chat_pagamenti: string | null;
  telegram_topic_ordini: number | null;
  telegram_topic_pagamenti: number | null;
  coperto: number;
  coperto_modalita: CopertoModalita;
  coperto_label: string;
  accetta_mancia: boolean;
  aggiunte: CategoryAddon[];
  funzionalita: Record<string, boolean>;
  funzionalita_admin: Record<string, boolean>;
  google_review_url: string | null;
  attivo: boolean;
  owner_id: string | null;
  created_at: string;
}

/**
 * Subset of restaurant fields that are safe to send to the browser.
 * Secret-ish columns (stripe_*, telegram_*, owner_id) are intentionally omitted.
 */
export type PublicRestaurant = Pick<
  Restaurant,
  | "id"
  | "slug"
  | "nome"
  | "sottotitolo"
  | "logo_url"
  | "colore_primario"
  | "colore_secondario"
  | "tema"
  | "layout"
  | "piano"
  | "multilingua"
  | "lingue"
  | "pagamenti_attivi"
  | "coperto"
  | "coperto_modalita"
  | "coperto_label"
  | "accetta_mancia"
  | "aggiunte"
  | "google_review_url"
  | "attivo"
> & {
  /** Effective on/off per feature (plan ∪ admin entitlement, then owner switch). */
  funzioni_attive: Record<string, boolean>;
};

/** A choice within an option group, e.g. "+ Bacon" with a price delta. */
export interface OptionChoice {
  nome: string;
  prezzo: number; // delta in EUR (can be 0)
}
/** An option group on a menu item, e.g. "Aggiunte" (multi) or "Cottura" (single). */
export interface ItemOption {
  id: string;
  nome: string;
  tipo: "single" | "multi";
  obbligatorio: boolean;
  scelte: OptionChoice[];
}

/** An option group that applies to whole categories (restaurant-level add-ons). */
export interface CategoryAddon extends ItemOption {
  categorie: string[];
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  categoria: string;
  nome: string;
  nome_i18n: Record<string, string>;
  descrizione: string | null;
  descrizione_i18n: Record<string, string>;
  prezzo: number;
  foto_url: string | null;
  disponibile: boolean;
  ordine: number;
  allergeni: string[];
  opzioni: ItemOption[];
  consigliato: boolean;
  scorta: number | null;
  created_at: string;
}

/** A chosen option on an order line. */
export interface OrderItemOption {
  gruppo: string;
  scelta: string;
  prezzo: number;
}
export interface OrderItem {
  item_id: string;
  nome: string;
  qta: number;
  prezzo: number; // unit price INCLUDING chosen option deltas
  opzioni?: OrderItemOption[];
}

export interface Order {
  id: string;
  restaurant_id: string;
  tavolo: string | null;
  items: OrderItem[];
  totale: number;
  mancia: number;
  coperti: number | null;
  coperto_tot: number;
  note: string | null;
  stato: OrderStatus;
  pagato_at: string | null;
  scontrino_registrato: boolean;
  stripe_payment_intent: string | null;
  pronto_at: string | null;
  servito_at: string | null;
  visto_at: string | null;
  created_at: string;
}

export interface CustomDomain {
  domain: string;
  restaurant_id: string;
}

/** Whitelisted branding fields editable by the restaurateur and the admin. */
export interface BrandingPatch {
  nome?: string;
  sottotitolo?: string | null;
  colore_primario?: string;
  colore_secondario?: string | null;
  tema?: "light" | "dark";
  layout?: Partial<MenuLayout>;
  logo_url?: string | null;
  coperto?: number;
  coperto_modalita?: CopertoModalita;
  coperto_label?: string;
  accetta_mancia?: boolean;
  google_review_url?: string | null;
}
