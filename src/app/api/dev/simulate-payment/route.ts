import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markOrderPaid } from "@/lib/orders";
import { isStripeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * DEV ONLY. Simulates a successful Stripe Connect payment webhook so the full
 * paid → Payments-bot → reconciliation flow can be tested locally without
 * Stripe keys. Disabled in production and whenever Stripe IS configured (in
 * that case the real webhook is the only source of truth — briefing §6).
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: "Non disponibile." }, { status: 403 });
  }

  let orderId: string | undefined;
  try {
    orderId = (await req.json())?.orderId;
  } catch {
    /* ignore */
  }
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId mancante." }, { status: 400 });
  }

  const admin = createAdminClient();
  const order = await markOrderPaid(admin, { orderId });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Ordine non trovato." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}
