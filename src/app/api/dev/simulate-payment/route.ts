import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markOrderPaid } from "@/lib/orders";
import { isStripeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Simulates a successful Stripe Connect payment so the full paid → Payments-bot
 * → reconciliation flow can be tested without charging. Allowed when the order's
 * restaurant is in admin-controlled "test" mode, or in local dev without Stripe
 * configured. NEVER allowed for a restaurant running real payments.
 */
export async function POST(req: Request) {
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
  const { data: ord } = await admin
    .from("orders")
    .select("restaurant_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!ord) {
    return NextResponse.json({ ok: false, error: "Ordine non trovato." }, { status: 404 });
  }
  const { data: rest } = await admin
    .from("restaurants")
    .select("pagamenti_test")
    .eq("id", ord.restaurant_id)
    .maybeSingle();

  const testMode = Boolean(rest?.pagamenti_test);
  const allowed = testMode || (process.env.NODE_ENV !== "production" && !isStripeConfigured());
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Non disponibile." }, { status: 403 });
  }

  const order = await markOrderPaid(admin, { orderId });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Ordine non trovato." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, order });
}
