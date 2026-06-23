import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/env";
import { appOrigin } from "@/lib/origin";
import { checkoutForOrder } from "@/lib/stripe/checkout-order";
import { hitRateLimit, clientIp } from "@/lib/ratelimit";
import type { Order, Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Paga ora" / retry: (re)create a hosted Checkout Session for an order still
 * awaiting payment (or whose previous attempt failed/expired). Delegates to
 * checkoutForOrder, which expires any prior open session first (no double charge).
 * Truth of "paid" stays the webhook; this only produces a payment URL.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!(await hitRateLimit(`ordine-pay:${clientIp(req.headers)}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "Troppe richieste." }, { status: 429 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
  }

  const { data: orderRow, error: orderErr } = await admin
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (orderErr) return NextResponse.json({ ok: false, error: "Errore interno." }, { status: 503 });
  const order = orderRow as Order | null;
  if (!order) return NextResponse.json({ ok: false, error: "Ordine non trovato." }, { status: 404 });
  if (order.stato !== "in_attesa_pagamento" && order.stato !== "fallito") {
    return NextResponse.json({ ok: false, error: "Ordine non pagabile." }, { status: 409 });
  }

  const { data: restRow, error: restErr } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", order.restaurant_id)
    .maybeSingle();
  if (restErr) return NextResponse.json({ ok: false, error: "Errore interno." }, { status: 503 });
  const restaurant = restRow as Restaurant | null;
  if (!restaurant || !restaurant.pagamenti_attivi) {
    return NextResponse.json({ ok: false, error: "Pagamenti non disponibili." }, { status: 409 });
  }

  if (!restaurant.pagamenti_test && isStripeConfigured() && restaurant.stripe_connect_id) {
    try {
      const checkoutUrl = await checkoutForOrder(admin, { order, restaurant, origin: await appOrigin() });
      if (!checkoutUrl) {
        return NextResponse.json(
          { ok: false, error: "Pagamento non disponibile. Riprova." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: true, mode: "payment", checkoutUrl });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Pagamento non disponibile. Riprova." },
        { status: 503 },
      );
    }
  }

  // Test mode / no real Stripe: let the dev simulator complete it instead.
  return NextResponse.json({
    ok: true,
    devSimulateAvailable: restaurant.pagamenti_test || process.env.NODE_ENV !== "production",
  });
}
