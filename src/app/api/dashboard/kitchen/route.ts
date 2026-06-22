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
      "id, tavolo, sala, asporto, items, totale, note, created_at, preparazione_at, pronto_at, servito_at, tempo_stimato, priorita, stato, allergeni",
    )
    .eq("restaurant_id", restaurant.id)
    .in("stato", ["ricevuto", "pagato"])
    .is("annullato_at", null)
    .or(`servito_at.is.null,servito_at.gte.${since2h}`)
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let orders = data ?? [];

  // Reparti / per-item prep time: resolve each line's department and prep time
  // from the current menu. Run when either feature is on — tempo_preparazione is
  // needed for the per-dish countdown even when reparto filtering is off.
  const repartoOn = isFeatureOn(restaurant, "reparto");
  const tempoOn = isFeatureOn(restaurant, "tempo_stimato");
  if (repartoOn || tempoOn) {
    const orderedIds = [
      ...new Set(
        orders.flatMap((o) =>
          (Array.isArray(o.items) ? (o.items as { item_id?: string }[]) : [])
            .map((it) => it.item_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const metaById = new Map<string, { reparto: string | null; tempo_preparazione: number | null }>();
    if (orderedIds.length) {
      const { data: rows } = await supabase
        .from("menu_items")
        .select("id, reparto, tempo_preparazione")
        .eq("restaurant_id", restaurant.id)
        .in("id", orderedIds);
      for (const r of (rows ?? []) as { id: string; reparto: string | null; tempo_preparazione: number | null }[]) {
        metaById.set(r.id, { reparto: r.reparto, tempo_preparazione: r.tempo_preparazione });
      }
    }
    orders = orders.map((o) => ({
      ...o,
      items: (Array.isArray(o.items) ? (o.items as { item_id?: string }[]) : []).map((it) => {
        const meta = it.item_id ? metaById.get(it.item_id) : undefined;
        return { ...it, reparto: meta?.reparto ?? null, tempo_preparazione: meta?.tempo_preparazione ?? null };
      }),
    }));
  }

  return NextResponse.json({ ok: true, orders });
}
