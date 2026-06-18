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

/** A scheduled closure (holiday / extraordinary closed day). `a` omitted = single day. */
export interface Chiusura {
  da: string; // "YYYY-MM-DD"
  a?: string; // "YYYY-MM-DD" (inclusive end; defaults to `da`)
  motivo?: string;
}

/** Front-of-house announcement banner (colours follow the brand). */
export interface Annuncio {
  testo: string;
  attivo: boolean;
}

/** Category-scoped customer-note config (mirrors CategoryAddon, minus choices). */
export interface NoteConfig {
  id: string;
  categorie: string[];
  label?: string;
  obbligatoria?: boolean;
}

/** Per-product customer-note override (wins over the category-level note_config). */
export interface ItemNota {
  attiva: boolean;
  label?: string;
  obbligatoria?: boolean;
}

/** A configurable kitchen department (KDS routing). */
export interface Reparto {
  id: string;
  nome: string;
  colore?: string;
  /** How many dishes this station prepares at once (parallel capacity) for the
   *  wait estimate. Unset ⇒ falls back to restaurants.capienza_default. */
  capienza?: number;
}

/** A table on the floor plan. x/y are 0–100 % of the canvas. */
export interface SalaTavolo {
  id: string;
  nome: string;
  x: number;
  y: number;
  posti?: number;
  /** Free notes shown as bubbles on the table (max 5), e.g. "vicino finestra". */
  note?: string[];
  /** Shape on the map; defaults to a rounded square when unset. */
  forma?: "quadrato" | "rotondo" | "rettangolare";
}
/** A room of the floor plan, holding positioned tables. */
export interface Sala {
  id: string;
  nome: string;
  tavoli: SalaTavolo[];
}

/** Kitchen order priority. */
export type Priorita = "alta" | "media" | "bassa";

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
  /** Manual open/close override of the fixed hours: null=auto, true=open, false=closed. */
  aperto_override: boolean | null;
  chiusure: Chiusura[];
  annuncio: Annuncio;
  note_config: NoteConfig[];
  reparti: Reparto[];
  /** Reusable dish-label catalog (label names, e.g. "Vegetariano"). */
  etichette: string[];
  /** Floor-plan rooms + positioned tables (Sala builder). */
  sale: Sala[];
  /** Per-category average prep minutes, e.g. { "Antipasti": 10 } — fallback for the KDS estimate. */
  categoria_tempi: Record<string, number>;
  /** Default kitchen concurrency (dishes prepared at once) for the wait estimate
   *  when an item has no reparto / reparti aren't used. null ⇒ 1 (serial). */
  capienza_default: number | null;
  /** Back-office theme, independent of the public `tema`. null = light. */
  dashboard_tema: "light" | "dark" | null;
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
  | "aperto_override"
  | "chiusure"
  | "annuncio"
  | "note_config"
  | "etichette"
  | "sale"
  | "categoria_tempi"
  | "capienza_default"
  | "reparti"
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
  nome_i18n: Record<string, string>; // per-locale name, e.g. { "en": "Rice" }
  categoria: string; // optional grouping label (e.g. "Riso", "Pesce")
  prezzo: number; // EUR; 0 = "incluso"
  scorta: number | null; // null = illimitato, 0 = esaurito
  unita: string | null; // display only ("porzione", "g"…)
  peso: number | null; // grams of one standard portion (default recipe amount + composable portion weight)
  kcal_per_100g: number | null; // calories per 100g (a stable nutritional constant)
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

/** One entry in a dish's recipe: an ingredient and how many grams of it the dish
 *  uses. `grammi` null ⇒ fall back to the ingredient's default portion (`peso`). */
export interface RicettaVoce {
  id: string; // ingredient id (refs public.ingredients)
  grammi: number | null;
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
  ingredienti: RicettaVoce[]; // the dish recipe: ingredient ids + grams used (drives weight/kcal)
  /** Per-item composition groups. When non-empty, this product is composable on
   *  its own (overrides the category-level Restaurant.composizione for it). The
   *  groups' `categorie` field is unused at the item level. */
  composizione: ComposizioneGruppo[];
  /** Per-item size variants (overrides category-level when non-empty). */
  composizione_taglie: TagliaComposizione[];
  /** Per-product customer-note override (wins over the category-level note_config). */
  nota: ItemNota;
  /** Prep time in minutes (drives the KDS countdown). */
  tempo_preparazione: number | null;
  /** Optional manual total weight (g) — overrides the auto-sum of ingredient weights. */
  peso: number | null;
  /** Optional manual total kcal — overrides the auto-sum of ingredient calories. */
  kcal: number | null;
  /** Kitchen department id (refs Restaurant.reparti); "" = unassigned. */
  reparto: string;
  /** Separate takeaway/delivery price (used when the order is asporto). */
  prezzo_asporto: number | null;
  /** Reusable label ids (refs Restaurant.etichette). */
  etichette: string[];
  solo_pranzo: boolean;
  solo_cena: boolean;
  /** Featured in the homepage "vetrina" carousel (gated by the `vetrina` flag). */
  in_vetrina: boolean;
  /** Optional per-product announcement shown on its vetrina slide. */
  vetrina_annuncio: string | null;
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
  nota?: string; // free-text customer note for this line (does not affect price)
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
  /** Cook's first click → state "in preparazione" + KDS countdown anchor. */
  preparazione_at: string | null;
  pronto_at: string | null;
  servito_at: string | null;
  visto_at: string | null;
  voto: number | null;
  /** Estimated prep minutes (max prep time of the order's items, at creation). */
  tempo_stimato: number | null;
  priorita: Priorita | null;
  /** Set when the order is cancelled (leaves the kitchen + sales, stays in history). */
  annullato_at: string | null;
  /** Set when the table's bill is settled ("Estingui conto"). Management-only;
   * does NOT cancel the order, so it stays counted in incasso/statistiche. */
  conto_chiuso_at: string | null;
  /** Optional room / zone label (e.g. "Interno", "Dehors"). */
  sala: string | null;
  /** Destination type: a table order, takeaway, or home delivery. */
  tipo: OrderTipo;
  /** Delivery address (only for `tipo === "delivery"`). */
  indirizzo: string | null;
  /** Optional Google-Maps location link for a delivery (http/https only). */
  posizione: string | null;
  /** Allergens the customer declared at checkout (allergen ids); cook-visible on the KDS. */
  allergeni: string[];
  /** Set when the comanda has been auto-printed (claimed by the first surface
   * that saw the order). Dedups auto-print across KDS + Ordini + multiple tabs. */
  comanda_stampata_at: string | null;
  created_at: string;
}

export type OrderTipo = "tavolo" | "asporto" | "delivery";

/** A customer-at-table service request (call waiter / ask for the bill). */
export interface ServiceRequest {
  id: string;
  restaurant_id: string;
  tavolo: string;
  tipo: "cameriere" | "conto";
  created_at: string;
  gestita_at: string | null;
}

export interface CustomDomain {
  domain: string;
  restaurant_id: string;
}

/** Idempotency ledger of processed Stripe webhook event ids. Service-role only. */
export interface StripeEvent {
  id: string;
  type: string;
  received_at: string;
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
  annuncio?: Annuncio;
}
