import type { CategoryAddon, ItemOption, OrderItem, OrderItemOption } from "@/types/db";
import { effectiveOptions } from "@/lib/menu";

export interface IncomingOption {
  gruppo: string;
  scelta: string;
}
export interface IncomingCartLine {
  item_id: string;
  qta: number;
  opzioni?: IncomingOption[];
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
  opts: { enforceScorte?: boolean } = {},
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

    const unitCents = Math.round(Number(item.prezzo) * 100) + optionDeltaCents;
    itemsTotaleCents += unitCents * qta;

    lines.push({
      item_id: item.id,
      nome: item.nome,
      qta,
      prezzo: unitCents / 100,
      ...(orderOpts.length ? { opzioni: orderOpts } : {}),
    });
  }

  if (itemsTotaleCents <= 0) throw new Error("Totale non valido.");

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
