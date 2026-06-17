import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { funzioniAttive } from "@/lib/config/features";
import type {
  MenuItem,
  PlanId,
  PublicIngredient,
  PublicRestaurant,
  Restaurant,
} from "@/types/db";

const SAFE_RESTAURANT_COLUMNS =
  "id, slug, nome, sottotitolo, logo_url, colore_primario, colore_secondario, tema, layout, piano, multilingua, lingue, pagamenti_attivi, coperto, coperto_modalita, coperto_label, accetta_mancia, aggiunte, composizione, composizione_taglie, funzionalita, funzionalita_admin, google_review_url, orari, aperto_override, chiusure, annuncio, note_config, etichette, sale, categoria_tempi, capienza_default, reparti, attivo";

/**
 * Resolve a tenant from the `[domain]` route param, which is either:
 *  - a restaurant slug (from `slug.menuflow.it` or `slug.localhost`), or
 *  - a full custom-domain host (from the custom_domains table).
 *
 * Returns only browser-safe columns; stripe/telegram/owner secrets never leave
 * the server. Cached per-request via React `cache`.
 */
function toPublic(row: unknown): PublicRestaurant | null {
  if (!row || typeof row !== "object") return null;
  const ctx = row as {
    piano: PlanId;
    funzionalita?: Record<string, boolean>;
    funzionalita_admin?: Record<string, boolean>;
  };
  return {
    ...(row as Omit<PublicRestaurant, "funzioni_attive">),
    funzioni_attive: funzioniAttive(ctx),
  };
}

export const resolveTenant = cache(
  async (domainParam: string): Promise<PublicRestaurant | null> => {
    const admin = createAdminClient();
    const id = decodeURIComponent(domainParam).toLowerCase();

    // 1) try slug
    const bySlug = await admin
      .from("restaurants")
      .select(SAFE_RESTAURANT_COLUMNS)
      .eq("slug", id)
      .maybeSingle();
    if (bySlug.data) return toPublic(bySlug.data);

    // 2) try custom domain
    const domain = await admin
      .from("custom_domains")
      .select("restaurant_id")
      .eq("domain", id)
      .maybeSingle();
    if (!domain.data) return null;

    const byId = await admin
      .from("restaurants")
      .select(SAFE_RESTAURANT_COLUMNS)
      .eq("id", domain.data.restaurant_id)
      .maybeSingle();
    return toPublic(byId.data);
  },
);

/** Full restaurant row incl. secrets — SERVER ONLY (order/payment internals). */
export async function getRestaurantInternal(
  restaurantId: string,
): Promise<Restaurant | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();
  return (data as Restaurant) ?? null;
}

/** Available + sold-out menu items for the public page (safe columns only). */
export async function getMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("menu_items")
    .select(
      "id, restaurant_id, categoria, nome, nome_i18n, descrizione, descrizione_i18n, prezzo, foto_url, disponibile, ordine, allergeni, opzioni, consigliato, scorta, ingredienti, composizione, composizione_taglie, nota, tempo_preparazione, peso, kcal, reparto, prezzo_asporto, etichette, solo_pranzo, solo_cena, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("categoria", { ascending: true })
    .order("ordine", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as MenuItem[]) ?? [];
}

/** Public ingredient list (with live stock) for composable categories. */
export async function getPublicIngredients(
  restaurantId: string,
): Promise<PublicIngredient[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ingredients")
    .select("id, nome, nome_i18n, categoria, prezzo, scorta, unita, peso, kcal, ordine")
    .eq("restaurant_id", restaurantId)
    .order("ordine", { ascending: true });
  return ((data as PublicIngredient[]) ?? []).map((i) => ({
    ...i,
    prezzo: Number(i.prezzo),
  }));
}

/** Top-selling item ids over the last `days` (≥3 sales), for "più ordinati" badges. */
export async function getPopularItemIds(
  restaurantId: string,
  days = 30,
  limit = 4,
): Promise<string[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await admin
    .from("orders")
    .select("items")
    .eq("restaurant_id", restaurantId)
    .in("stato", ["ricevuto", "pagato"])
    .gte("created_at", since);
  const counts = new Map<string, number>();
  for (const o of (data ?? []) as { items: { item_id: string; qta: number }[] }[]) {
    for (const it of o.items ?? []) {
      if (it.item_id) counts.set(it.item_id, (counts.get(it.item_id) ?? 0) + (it.qta || 1));
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
