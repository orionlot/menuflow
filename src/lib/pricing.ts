import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryAddon, ComposizioneGruppo } from "@/types/db";
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

  // Composable products: load ingredient stock so the core can validate
  // quantities against live stock and price the composition.
  let ingredients = new Map<string, IngredientInfo>();
  if (composizione.length) {
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

  return priceLines(
    (items ?? []) as PricedItem[],
    cart,
    aggiunte,
    opts,
    composizione,
    ingredients,
  );
}
