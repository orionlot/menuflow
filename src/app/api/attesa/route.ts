import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureOn } from "@/lib/config/features";
import { hitRateLimit } from "@/lib/ratelimit";
import type { Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

/**
 * Current kitchen queue wait estimate for a tenant (public): the sum of the
 * estimated prep minutes of all orders still pending — i.e. not yet ready
 * (da preparare + in preparazione). Used by the public menu's "tempo stimato
 * per il servizio". Best-effort; an indicative figure only. Gated like the
 * other public endpoints: throttled, suspended/feature-off tenants return 0.
 */
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "anon";
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
  const { data } = await admin
    .from("orders")
    .select("tempo_stimato")
    .eq("restaurant_id", restaurant.id)
    .in("stato", ["ricevuto", "pagato"])
    .is("annullato_at", null)
    .is("pronto_at", null)
    .is("servito_at", null);
  const minuti = (data ?? []).reduce(
    (s, o) => s + (Number((o as { tempo_stimato: number | null }).tempo_stimato) || 0),
    0,
  );
  return NextResponse.json({ ok: true, minuti });
}
