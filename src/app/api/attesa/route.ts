import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureOn } from "@/lib/config/features";
import { hitRateLimit, clientIp } from "@/lib/ratelimit";
import { addLoad, capienzaFor, effectivePrep, waitMinutes, type RepartoLoad } from "@/lib/attesa";
import type { Order, Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

/**
 * Current kitchen queue wait estimate for a tenant (public): the sum of the
 * estimated prep minutes of all orders still pending — i.e. not yet ready
 * (da preparare + in preparazione). Used by the public menu's "tempo stimato
 * per il servizio". Best-effort; an indicative figure only. Gated like the
 * other public endpoints: throttled, suspended/feature-off tenants return 0.
 */
export async function GET(req: Request) {
  const ip = clientIp(req.headers);
  if (!(await hitRateLimit(`attesa:${ip}`, 30, 60_000))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data: r } = await admin
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  const restaurant = r as Restaurant | null;
  // No live estimate for unknown / suspended tenants, or when the feature is off.
  if (!restaurant || !restaurant.attivo || !isFeatureOn(restaurant, "attesa_stimata")) {
    return NextResponse.json({ ok: true, minuti: 0 });
  }
  // Pending dishes (da preparare + in preparazione).
  const { data: pend } = await admin
    .from("orders")
    .select("items")
    .eq("restaurant_id", restaurant.id)
    .in("stato", ["ricevuto", "pagato"])
    .is("annullato_at", null)
    .is("pronto_at", null)
    .is("servito_at", null);
  const orders = (pend as Pick<Order, "items">[]) ?? [];

  const itemIds = [
    ...new Set(orders.flatMap((o) => (o.items ?? []).map((it) => it.item_id).filter(Boolean))),
  ];
  const metaById = new Map<string, { reparto: string; prep: number }>();
  if (itemIds.length) {
    const { data: mi } = await admin
      .from("menu_items")
      .select("id, reparto, tempo_preparazione, categoria")
      .eq("restaurant_id", restaurant.id)
      .in("id", itemIds);
    for (const m of (mi ?? []) as {
      id: string;
      reparto: string | null;
      tempo_preparazione: number | null;
      categoria: string | null;
    }[]) {
      metaById.set(m.id, {
        reparto: m.reparto || "",
        prep: effectivePrep(m.tempo_preparazione, m.categoria, restaurant.categoria_tempi),
      });
    }
  }

  // Build the per-station load from pending dishes.
  const loads: Record<string, RepartoLoad> = {};
  for (const o of orders) {
    for (const it of o.items ?? []) {
      const meta = it.item_id ? metaById.get(it.item_id) : undefined;
      if (!meta) continue;
      addLoad(
        loads,
        meta.reparto,
        it.qta,
        meta.prep,
        capienzaFor(meta.reparto, restaurant.reparti, restaurant.capienza_default),
      );
    }
  }

  // Return both the total and the per-station load so the menu can fold in the
  // customer's own cart and recompute consistently.
  return NextResponse.json({ ok: true, minuti: waitMinutes(loads), loads });
}
