import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * SECURITY-CRITICAL: never trust prices/quantities/options from the client.
 * Re-reads each item's real price, availability AND option deltas from the DB
 * and recomputes the line total. Throws on missing/foreign/sold-out items, bad
 * quantities, or invalid option selections. The returned numbers are what we charge.
 */
export async function priceCartServerSide(
  admin: SupabaseClient,
  restaurantId: string,
  cart: IncomingCartLine[],
  aggiunte: CategoryAddon[] = [],
  opts: { enforceScorte?: boolean } = {},
): Promise<PricedCart> {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Carrello vuoto.");
  }

  const ids = [...new Set(cart.map((l) => l.item_id))];
  const { data: items, error } = await admin
    .from("menu_items")
    .select("id, nome, prezzo, disponibile, restaurant_id, categoria, opzioni, scorta")
    .in("id", ids)
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);

  const byId = new Map((items ?? []).map((i) => [i.id as string, i]));

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
    const scorta = (item as { scorta?: number | null }).scorta;
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
        categoria: item.categoria as string,
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
