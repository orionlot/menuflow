import type {
  CategoryAddon,
  ComposizioneGruppo,
  ItemOption,
  OrderComposizione,
  OrderItem,
  OrderItemOption,
  TagliaComposizione,
} from "@/types/db";
import { effectiveOptions } from "@/lib/menu";

export interface IncomingOption {
  gruppo: string;
  scelta: string;
}
export interface IncomingCartLine {
  item_id: string;
  qta: number;
  opzioni?: IncomingOption[];
  composizione?: { ingredient_id: string; qta: number }[];
  taglia_id?: string;
  nota?: string; // free-text customer note for this line (does not affect price)
}

export interface PricedCart {
  lines: OrderItem[];
  /** Items subtotal in cents (excludes coperto/mancia). */
  itemsTotaleCents: number;
}

/** Minimal item shape needed to price a cart (as read from `menu_items`). */
export interface PricedItem {
  id: string;
  nome: string;
  prezzo: number;
  disponibile: boolean;
  categoria: string;
  opzioni?: unknown;
  scorta?: number | null;
  /** Per-item composition groups (override category-level when non-empty). */
  composizione?: ComposizioneGruppo[];
  /** Per-item size variants (override category-level when non-empty). */
  composizione_taglie?: TagliaComposizione[];
  /** Separate takeaway price; used as the base when the order is asporto. */
  prezzo_asporto?: number | null;
}

/** Live ingredient info (price + stock) keyed by id, for composable products. */
export interface IngredientInfo {
  nome: string;
  prezzo: number;
  scorta: number | null;
}

/**
 * Validate & price a customer's chosen composition for a composable item.
 * SECURITY-CRITICAL: rejects ingredients not in a group for the item's category,
 * per-ingredient quantity above remaining stock, sold-out ingredients, and group
 * min/max violations. Returns the per-unit price delta (cents) and the order lines.
 * (Total stock across multiple units is enforced atomically at decrement time.)
 */
export function priceComposizione(
  /** The EFFECTIVE composition groups for this item (already resolved by the
   *  caller: the item's own groups if it is per-item composable, otherwise the
   *  category-level groups filtered to its category). */
  groups: ComposizioneGruppo[],
  ingredients: Map<string, IngredientInfo>,
  chosen: { ingredient_id: string; qta: number }[] = [],
  /** Per-group max overrides from the chosen size (gruppo_id -> max). */
  sizeMax: Record<string, number> = {},
): { deltaCents: number; lines: OrderComposizione[] } {
  const allowed = new Map<string, { group: ComposizioneGruppo; override: number | null }>();
  for (const g of groups)
    for (const s of g.ingredienti)
      allowed.set(s.ingredient_id, { group: g, override: s.prezzo ?? null });

  let deltaCents = 0;
  const lines: OrderComposizione[] = [];
  const perGroup = new Map<string, number>();

  for (const ch of chosen ?? []) {
    const qta = Number(ch.qta);
    if (!Number.isInteger(qta) || qta < 1) continue; // ignore blank/zero picks
    const a = allowed.get(ch.ingredient_id);
    const ing = ingredients.get(ch.ingredient_id);
    if (!a || !ing) throw new Error(`Ingrediente non valido: ${ch.ingredient_id}`);
    if (ing.scorta != null && qta > ing.scorta)
      throw new Error(
        ing.scorta > 0
          ? `Scorte insufficienti per ${ing.nome}: ne restano ${ing.scorta}.`
          : `Ingrediente esaurito: ${ing.nome}`,
      );
    const prezzo = a.override ?? ing.prezzo;
    deltaCents += Math.round(Number(prezzo) * 100) * qta;
    lines.push({ ingredient_id: ch.ingredient_id, nome: ing.nome, qta, prezzo: Number(prezzo) });
    perGroup.set(a.group.id, (perGroup.get(a.group.id) ?? 0) + qta);
  }

  for (const g of groups) {
    const total = perGroup.get(g.id) ?? 0;
    const effMax = sizeMax[g.id] ?? g.max;
    const effMin = Math.min(g.min, effMax);
    if (total > effMax) throw new Error(`Massimo ${effMax} per "${g.nome}"`);
    if (total < effMin) throw new Error(`Scegli almeno ${effMin} per "${g.nome}"`);
  }
  return { deltaCents, lines };
}

/**
 * SECURITY-CRITICAL, pure pricing core. Given the items already fetched from the
 * DB, validate the cart and recompute the line totals — no DB / no I/O, so it is
 * fully unit-testable. Throws (with these exact messages) on missing/foreign/
 * sold-out items, bad quantities, insufficient stock, or invalid option choices.
 * The returned numbers are what we charge.
 */
export function priceLines(
  items: PricedItem[],
  cart: IncomingCartLine[],
  aggiunte: CategoryAddon[] = [],
  opts: { enforceScorte?: boolean; asportoPrezzo?: boolean } = {},
  composizione: ComposizioneGruppo[] = [],
  ingredients: Map<string, IngredientInfo> = new Map(),
  taglie: TagliaComposizione[] = [],
): PricedCart {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Carrello vuoto.");
  }

  const byId = new Map(items.map((i) => [i.id, i]));

  const lines: OrderItem[] = [];
  let itemsTotaleCents = 0;

  for (const line of cart) {
    const item = byId.get(line.item_id);
    if (!item) throw new Error(`Voce non trovata: ${line.item_id}`);
    if (!item.disponibile) throw new Error(`Voce esaurita: ${item.nome}`);

    const qta = Number(line.qta);
    if (!Number.isInteger(qta) || qta < 1 || qta > 99) {
      throw new Error(`Quantità non valida per ${item.nome}`);
    }

    // Stock check (only when the "scorte" feature is on for this tenant).
    const scorta = item.scorta;
    if (opts.enforceScorte && scorta != null && qta > scorta) {
      throw new Error(
        scorta > 0
          ? `Scorte insufficienti per ${item.nome}: ne restano ${scorta}.`
          : `Voce esaurita: ${item.nome}`,
      );
    }

    // ── Validate & price options against the DB definition ──
    // Effective groups = item's own options + category add-ons for its category.
    const groups: ItemOption[] = effectiveOptions(
      {
        categoria: item.categoria,
        opzioni: Array.isArray(item.opzioni) ? (item.opzioni as ItemOption[]) : [],
      },
      aggiunte,
    );
    const chosen = Array.isArray(line.opzioni) ? line.opzioni : [];
    const orderOpts: OrderItemOption[] = [];
    let optionDeltaCents = 0;
    const countByGroup = new Map<string, number>();

    for (const ch of chosen) {
      const g = groups.find((gr) => gr.nome === ch.gruppo);
      if (!g) throw new Error(`Opzione non valida per ${item.nome}: ${ch.gruppo}`);
      const c = g.scelte.find((s) => s.nome === ch.scelta);
      if (!c) throw new Error(`Scelta non valida per ${item.nome}: ${ch.scelta}`);
      optionDeltaCents += Math.round(Number(c.prezzo) * 100);
      orderOpts.push({ gruppo: g.nome, scelta: c.nome, prezzo: Number(c.prezzo) });
      countByGroup.set(g.nome, (countByGroup.get(g.nome) ?? 0) + 1);
    }
    for (const g of groups) {
      const cnt = countByGroup.get(g.nome) ?? 0;
      if (g.tipo === "single" && cnt > 1)
        throw new Error(`Una sola scelta per "${g.nome}" (${item.nome})`);
      if (g.obbligatorio && cnt < 1)
        throw new Error(`Selezione richiesta: "${g.nome}" (${item.nome})`);
    }

    // ── Resolve the EFFECTIVE composition + sizes for this item ──
    // A product that carries ANY per-item config is "per-item composable" and is
    // self-contained: it uses ONLY its own groups + sizes (never inherits the
    // category-level ones). Otherwise it falls back to the category-level config
    // filtered to its category. (The caller blanks the per-item fields when the
    // `componibili` feature is off, so disabling the feature reverts the product
    // to the plain/category behaviour.)
    const perItem =
      (item.composizione?.length ?? 0) > 0 || (item.composizione_taglie?.length ?? 0) > 0;
    const itemComposizione = perItem
      ? item.composizione ?? []
      : composizione.filter((g) => g.categorie.includes(item.categoria));
    const itemTaglie = perItem
      ? item.composizione_taglie ?? []
      : taglie.filter((t) => t.categorie.includes(item.categoria));

    let sizeMax: Record<string, number> = {};
    let tagliaNome: string | undefined;
    let tagliaPrezzoCents = 0;
    if (itemTaglie.length) {
      const t = itemTaglie.find((x) => x.id === line.taglia_id);
      if (!t) throw new Error(`Scegli una taglia per ${item.nome}`);
      sizeMax = t.max ?? {};
      tagliaNome = t.nome;
      tagliaPrezzoCents = Math.max(0, Math.round((Number(t.prezzo) || 0) * 100));
    }

    const compo = priceComposizione(
      itemComposizione,
      ingredients,
      line.composizione,
      sizeMax,
    );

    // Base price: the takeaway price when the order is asporto and the item has
    // one set; otherwise the regular price.
    const baseEuro =
      opts.asportoPrezzo && item.prezzo_asporto != null ? item.prezzo_asporto : item.prezzo;
    const unitCents =
      Math.round(Number(baseEuro) * 100) +
      optionDeltaCents +
      compo.deltaCents +
      tagliaPrezzoCents;
    itemsTotaleCents += unitCents * qta;

    const nota = typeof line.nota === "string" ? line.nota.trim().slice(0, 200) : "";
    lines.push({
      item_id: item.id,
      nome: item.nome,
      qta,
      prezzo: unitCents / 100,
      ...(orderOpts.length ? { opzioni: orderOpts } : {}),
      ...(compo.lines.length ? { composizione: compo.lines } : {}),
      ...(tagliaNome ? { taglia: tagliaNome } : {}),
      ...(nota ? { nota } : {}),
    });
  }

  if (itemsTotaleCents < 0) throw new Error("Totale non valido.");

  return { lines, itemsTotaleCents };
}

export type CopertoModalita = "nessuno" | "persona" | "ordine" | "servizio";

/**
 * Coperto (cover charge) in cents, per the restaurant's configured mode:
 * - persona:  fixed amount × number of covers
 * - ordine:   fixed amount once per order
 * - servizio: a percentage of the items subtotal
 * - nessuno / anything else: 0
 * `coperti` is only used by "persona" and must already be validated (>= 1).
 */
export function computeCopertoCents(
  modalita: CopertoModalita | string | null | undefined,
  coperto: number | null | undefined,
  coperti: number,
  itemsTotaleCents: number,
): number {
  const amount = Math.max(0, Number(coperto || 0));
  if (modalita === "persona") return Math.round(amount * 100) * coperti;
  if (modalita === "ordine") return Math.round(amount * 100);
  if (modalita === "servizio") return Math.round((itemsTotaleCents * amount) / 100);
  return 0;
}

/**
 * Tip (mancia) in cents. Only honoured when online payments are on AND the
 * restaurant accepts tips; ignores non-positive / NaN input; capped at €1000.
 */
export function computeManciaCents(
  payments: boolean,
  accettaMancia: boolean,
  mancia: unknown,
): number {
  if (!payments || !accettaMancia) return 0;
  const m = Math.round(Number(mancia) * 100);
  if (Number.isFinite(m) && m > 0) return Math.min(m, 100000);
  return 0;
}
