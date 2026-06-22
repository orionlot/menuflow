import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Lifecycle = {
  stato: string;
  preparazione_at: string | null;
  pronto_at: string | null;
  servito_at: string | null;
};

/** Customer-facing lifecycle phase, derived from the payment + kitchen stamps. */
function faseOf(o: Lifecycle): string {
  if (o.stato === "in_attesa_pagamento") return "attesa_pagamento";
  if (o.stato === "fallito") return "fallito";
  if (o.servito_at) return "servito";
  if (o.pronto_at) return "pronto";
  if (o.preparazione_at) return "in_preparazione";
  return "ricevuto";
}

type ItemStamps = {
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
  a_seguire?: boolean;
};

/** Per-dish phase for the customer tracker, derived from the line's own stamps. */
function itemFaseOf(it: ItemStamps): "in_attesa" | "a_seguire" | "in_preparazione" | "pronto" | "servito" {
  if (it.servito_at) return "servito";
  if (it.pronto_at) return "pronto";
  if (it.preparazione_at) return "in_preparazione";
  if (it.a_seguire) return "a_seguire";
  return "in_attesa";
}

/**
 * Public order-status poll by id (unguessable UUID). Returns ONLY the
 * payment/kitchen lifecycle — no order contents — so the customer at the table
 * (or on the tracking page) can follow "ricevuto → in preparazione → pronto →
 * servito". The tracking page renders the order summary from its own
 * restaurant-scoped server read; this endpoint stays minimal on purpose.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!(await hitRateLimit(`ordine-status:${clientIp(req.headers)}`, 60, 60_000))) {
    return NextResponse.json({ ok: false, error: "Troppe richieste." }, { status: 429 });
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("orders")
      .select("stato, preparazione_at, pronto_at, servito_at, items")
      .eq("id", id)
      .maybeSingle();
    if (!data) return NextResponse.json({ ok: false }, { status: 404 });
    const o = data as Lifecycle & { items: ItemStamps[] | null };
    // Per-dish phases by line index (stages only — no names/prices), so the
    // tracker can update each dish live without re-exposing order contents.
    const itemFasi = Array.isArray(o.items) ? o.items.map(itemFaseOf) : [];
    return NextResponse.json({
      ok: true,
      stato: o.stato,
      preparazione_at: o.preparazione_at,
      pronto_at: o.pronto_at,
      servito_at: o.servito_at,
      fase: faseOf(o),
      itemFasi,
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
