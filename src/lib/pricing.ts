import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryAddon, ComposizioneGruppo, TagliaComposizione } from "@/types/db";
import {
  priceLines,
  type IncomingCartLine,
  type IngredientInfo,
  type PricedCart,
  type PricedItem,
} from "@/lib/pricing-core";

export type { IncomingOption, IncomingCartLine, PricedCart } from "@/lib/pricing-core";

/**
 * SECURITY-CRITICAL: never trust prices/quantities/options from the client.
 * Re-reads each item's real price, availability AND option deltas from the DB,
 * then delegates to the pure `priceLines` core to recompute the line totals.
 * Throws on missing/foreign/sold-out items, bad quantities, or invalid options.
 */
export async function priceCartServerSide(
  admin: SupabaseClient,
  restaurantId: string,
  cart: IncomingCartLine[],
  aggiunte: CategoryAddon[] = [],
  opts: { enforceScorte?: boolean } = {},
  composizione: ComposizioneGruppo[] = [],
  taglie: TagliaComposizione[] = [],
  /** Whether the `componibili` feature is on. When off, per-item composition
   *  config stored on menu_items is ignored, so disabling the feature (or a plan
   *  downgrade) reverts products to plain behaviour and never blocks an order. */
  componibili = false,
): Promise<PricedCart> {
  if (!Array.isArray(cart) || cart.length === 0) {
    throw new Error("Carrello vuoto.");
  }

  const ids = [...new Set(cart.map((l) => l.item_id))];
  const { data: items, error } = await admin
    .from("menu_items")
    .select(
      "id, nome, prezzo, disponibile, restaurant_id, categoria, opzioni, scorta, composizione, composizione_taglie",
    )
    .in("id", ids)
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);

  const itemRows = (items ?? []) as PricedItem[];

  // Feature gate: ignore per-item composition config unless `componibili` is on,
  // so stale config on a product never affects pricing/validation after the
  // feature is turned off (or a plan downgrade removes it).
  if (!componibili)
    for (const i of itemRows) {
      i.composizione = [];
      i.composizione_taglie = [];
    }

  // Composable products: load ingredient stock so the core can validate
  // quantities against live stock and price the composition. Needed when the
  // restaurant has category-level composition OR any ordered item is per-item
  // composable.
  let ingredients = new Map<string, IngredientInfo>();
  const needIngredients =
    composizione.length > 0 ||
    itemRows.some((i) => Array.isArray(i.composizione) && i.composizione.length > 0);
  if (needIngredients) {
    const { data: ing } = await admin
      .from("ingredients")
      .select("id, nome, prezzo, scorta")
      .eq("restaurant_id", restaurantId);
    const rows = (ing ?? []) as {
      id: string;
      nome: string;
      prezzo: number;
      scorta: number | null;
    }[];
    ingredients = new Map(
      rows.map((r) => [r.id, { nome: r.nome, prezzo: Number(r.prezzo), scorta: r.scorta }]),
    );
  }

  return priceLines(itemRows, cart, aggiunte, opts, composizione, ingredients, taglie);
}
