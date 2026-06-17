import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Current kitchen queue wait estimate for a tenant (public): the sum of the
 * estimated prep minutes of all orders still pending — i.e. not yet ready
 * (da preparare + in preparazione). Used by the public menu's "tempo stimato
 * per il servizio". Best-effort; an indicative figure only.
 */
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  const { data: r } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!r) return NextResponse.json({ ok: false }, { status: 404 });
  const { data } = await admin
    .from("orders")
    .select("tempo_stimato")
    .eq("restaurant_id", (r as { id: string }).id)
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
