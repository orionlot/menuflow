import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MenuItem, PublicRestaurant, Restaurant } from "@/types/db";

const SAFE_RESTAURANT_COLUMNS =
  "id, slug, nome, sottotitolo, logo_url, colore_primario, tema, piano, multilingua, lingue, pagamenti_attivi, coperto, coperto_modalita, coperto_label, accetta_mancia, aggiunte, attivo";

/**
 * Resolve a tenant from the `[domain]` route param, which is either:
 *  - a restaurant slug (from `slug.menuflow.it` or `slug.localhost`), or
 *  - a full custom-domain host (from the custom_domains table).
 *
 * Returns only browser-safe columns; stripe/telegram/owner secrets never leave
 * the server. Cached per-request via React `cache`.
 */
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
    if (bySlug.data) return bySlug.data as PublicRestaurant;

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
    return (byId.data as PublicRestaurant) ?? null;
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
      "id, restaurant_id, categoria, nome, nome_i18n, descrizione, descrizione_i18n, prezzo, foto_url, disponibile, ordine, allergeni, opzioni, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .order("categoria", { ascending: true })
    .order("ordine", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as MenuItem[]) ?? [];
}
