import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureOn } from "@/lib/config/features";

export const dynamic = "force-dynamic";

/**
 * Live kitchen feed: active orders (ricevuto/pagato, not yet served) plus the
 * ones served in the last 2h (so the "Serviti" column and the metrics footer
 * have something to show). Bounded to the last 24h. When the `reparto` feature
 * is on, each order line is tagged with its dish's department so the board can
 * filter by reparto.
 */
export async function GET() {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: "Non autorizzato." }, { status: 401 });
  }

  const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const supabase = await createSupabaseServerClient();
  // Show every still-active order (never served) regardless of age — a genuinely
  // outstanding ticket must not silently age out — plus orders served in the last
  // 2h (for the Serviti column + metrics). A defensive cap bounds the payload.
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, tavolo, asporto, items, totale, note, created_at, preparazione_at, pronto_at, servito_at, tempo_stimato, priorita, stato",
    )
    .eq("restaurant_id", restaurant.id)
    .in("stato", ["ricevuto", "pagato"])
    .or(`servito_at.is.null,servito_at.gte.${since2h}`)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let orders = data ?? [];

  // Reparti: resolve each line's department from the current menu so the cook
  // can filter the board by station. Only when the feature is enabled, and only
  // for the dishes actually present in the returned orders.
  if (isFeatureOn(restaurant, "reparto")) {
    const orderedIds = [
      ...new Set(
        orders.flatMap((o) =>
          (Array.isArray(o.items) ? (o.items as { item_id?: string }[]) : [])
            .map((it) => it.item_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const repartoById = new Map<string, string>();
    if (orderedIds.length) {
      const { data: rows } = await supabase
        .from("menu_items")
        .select("id, reparto")
        .eq("restaurant_id", restaurant.id)
        .in("id", orderedIds);
      for (const r of (rows ?? []) as { id: string; reparto: string | null }[]) {
        if (r.reparto) repartoById.set(r.id, r.reparto);
      }
    }
    orders = orders.map((o) => ({
      ...o,
      items: (Array.isArray(o.items) ? (o.items as { item_id?: string }[]) : []).map((it) => ({
        ...it,
        reparto: it.item_id ? repartoById.get(it.item_id) ?? null : null,
      })),
    }));
  }

  return NextResponse.json({ ok: true, orders });
}
