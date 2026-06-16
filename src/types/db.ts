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

/** Opening hours (Fase 4). giorni: 0=Dom..6=Sab; empty/null = sempre aperto. */
export interface Orari {
  giorni: number[];
  da: string;
  a: string;
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
  pagamenti_test: boolean;
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
  composizione: ComposizioneGruppo[];
  composizione_taglie: TagliaComposizione[];
  funzionalita: Record<string, boolean>;
  funzionalita_admin: Record<string, boolean>;
  google_review_url: string | null;
  orari: Orari | null;
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
  | "composizione"
  | "composizione_taglie"
  | "google_review_url"
  | "orari"
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

/** A single ingredient with shared, per-restaurant stock (composable products). */
export interface Ingredient {
  id: string;
  restaurant_id: string;
  nome: string;
  categoria: string; // optional grouping label (e.g. "Riso", "Pesce")
  prezzo: number; // EUR; 0 = "incluso"
  scorta: number | null; // null = illimitato, 0 = esaurito
  unita: string | null; // display only ("porzione", "g"…)
  ordine: number;
}
/** Browser-safe ingredient (no restaurant_id). */
export type PublicIngredient = Omit<Ingredient, "restaurant_id">;

/** A composition group references ingredients (by id) for one or more categories. */
export interface ComposizioneScelta {
  ingredient_id: string;
  prezzo?: number | null; // override; falls back to Ingredient.prezzo
}
export interface ComposizioneGruppo {
  id: string;
  nome: string;
  categorie: string[]; // categories this group composes (e.g. ["Poke"])
  min: number; // min total portions in the group (0 = optional)
  max: number; // max total portions in the group
  ingredienti: ComposizioneScelta[];
}

/** A size variant for a composable category (e.g. Medium / Large). It caps the
 *  max per group; the min stays the group's own. May add a price surcharge. */
export interface TagliaComposizione {
  id: string;
  nome: string; // "Medium", "Large"
  categorie: string[]; // categories this size applies to (e.g. ["Poke"])
  max: Record<string, number>; // gruppo_id -> max selections for this size
  prezzo: number; // surcharge added to the item base price (EUR; 0 = no extra)
}

/** A chosen ingredient (with quantity) on an order line. */
export interface OrderComposizione {
  ingredient_id: string;
  nome: string;
  qta: number;
  prezzo: number; // unit price applied (override ?? ingredient price)
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
  ingredienti: string[]; // ingredient ids for the display-only "Ingredienti" list
  /** Per-item composition groups. When non-empty, this product is composable on
   *  its own (overrides the category-level Restaurant.composizione for it). The
   *  groups' `categorie` field is unused at the item level. */
  composizione: ComposizioneGruppo[];
  /** Per-item size variants (overrides category-level when non-empty). */
  composizione_taglie: TagliaComposizione[];
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
  prezzo: number; // unit price INCLUDING chosen option deltas + composition
  opzioni?: OrderItemOption[];
  composizione?: OrderComposizione[];
  taglia?: string; // chosen size name (e.g. "Large"), display only
}

export interface Order {
  id: string;
  restaurant_id: string;
  tavolo: string | null; // table number, or the customer name when `asporto`
  asporto: boolean;
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
  voto: number | null;
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
