import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceCartServerSide } from "@/lib/pricing";
import { notifyNewOrder } from "@/lib/telegram";
import { isStripeConfigured } from "@/lib/env";
import { isFeatureOn } from "@/lib/config/features";
import { hitRateLimit } from "@/lib/ratelimit";
import { isOpenNow } from "@/lib/orari";
import { createConnectPaymentIntent } from "@/lib/stripe/connect";
import type { Order, Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

function clean(s: unknown, max = 280): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim().slice(0, max);
  return v.length ? v : null;
}

export async function POST(req: Request) {
  if (!(await hitRateLimit(`ordine:${req.headers.get("x-forwarded-for") ?? "anon"}`, 60, 60_000))) {
    return NextResponse.json({ ok: false, error: "Troppe richieste." }, { status: 429 });
  }
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
  }

  let body: {
    slug?: string;
    tavolo?: string;
    note?: string;
    coperti?: number;
    mancia?: number;
    items?: {
      item_id: string;
      qta: number;
      opzioni?: { gruppo: string; scelta: string }[];
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body non valido." }, { status: 400 });
  }

  const slug = clean(body.slug, 120);
  if (!slug) {
    return NextResponse.json({ ok: false, error: "Slug mancante." }, { status: 400 });
  }

  try {
    const { data: restaurantRow, error: rErr } = await admin
      .from("restaurants")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    const restaurant = restaurantRow as Restaurant | null;

    if (rErr) {
      // DB problem → treat as backend unavailable (maintenance mode).
      return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
    }
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "Locale non trovato." }, { status: 404 });
    }
    if (!restaurant.attivo) {
      return NextResponse.json(
        { ok: false, error: "Servizio temporaneamente non disponibile." },
        { status: 409 },
      );
    }
    if (isFeatureOn(restaurant, "orari") && !isOpenNow(restaurant.orari)) {
      return NextResponse.json(
        { ok: false, error: "Siamo chiusi: ordini non disponibili in questo momento." },
        { status: 409 },
      );
    }

    // Table number is mandatory (the customer must say which table).
    const tavolo = clean(body.tavolo, 40);
    if (!tavolo) {
      return NextResponse.json(
        { ok: false, error: "Inserisci il numero del tavolo." },
        { status: 400 },
      );
    }

    // SECURITY: recompute total from DB prices; never trust the client.
    const { lines, itemsTotaleCents } = await priceCartServerSide(
      admin,
      restaurant.id,
      body.items ?? [],
      restaurant.aggiunte ?? [],
      { enforceScorte: isFeatureOn(restaurant, "scorte") },
    );

    const note = clean(body.note, 280);
    const payments = restaurant.pagamenti_attivi;

    // Coperto: applied server-side per the restaurant's configured mode.
    const copertoAmount = Math.max(0, Number(restaurant.coperto || 0));
    let coperti: number | null = null;
    let copertoCents = 0;
    if (restaurant.coperto_modalita === "persona") {
      const c = Number(body.coperti);
      if (!Number.isInteger(c) || c < 1 || c > 50) {
        return NextResponse.json(
          { ok: false, error: "Indica il numero di coperti." },
          { status: 400 },
        );
      }
      coperti = c;
      copertoCents = Math.round(copertoAmount * 100) * c;
    } else if (restaurant.coperto_modalita === "ordine") {
      copertoCents = Math.round(copertoAmount * 100);
    } else if (restaurant.coperto_modalita === "servizio") {
      copertoCents = Math.round((itemsTotaleCents * copertoAmount) / 100);
    }

    let manciaCents = 0;
    if (payments && restaurant.accetta_mancia) {
      const m = Math.round(Number(body.mancia) * 100);
      if (Number.isFinite(m) && m > 0) manciaCents = Math.min(m, 100000); // cap €1000
    }

    const totaleCents = itemsTotaleCents + copertoCents + manciaCents;
    const totale = totaleCents / 100;

    const { data: orderRow, error: oErr } = await admin
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        tavolo,
        items: lines,
        totale,
        mancia: manciaCents / 100,
        coperti,
        coperto_tot: copertoCents / 100,
        note,
        stato: payments ? "in_attesa_pagamento" : "ricevuto",
      })
      .select("*")
      .single();
    const order = orderRow as Order | null;

    if (oErr || !order) {
      return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
    }

    // ── Case A: no online payments → order is valid now, notify Orders bot ──
    if (!payments) {
      // Decrement stock for items that track it.
      if (isFeatureOn(restaurant, "scorte")) {
        const ids = lines.map((l) => l.item_id);
        const { data: stock } = await admin
          .from("menu_items")
          .select("id, scorta")
          .in("id", ids);
        const byId = new Map(
          (stock ?? []).map((s) => [s.id as string, s.scorta as number | null]),
        );
        await Promise.all(
          lines
            .filter((l) => byId.get(l.item_id) != null)
            .map((l) =>
              admin
                .from("menu_items")
                .update({ scorta: Math.max(0, (byId.get(l.item_id) as number) - l.qta) })
                .eq("id", l.item_id),
            ),
        );
      }
      await notifyNewOrder(restaurant, order);
      return NextResponse.json({ ok: true, mode: "placed", orderId: order.id });
    }

    // ── Case B: payments on → order NOT valid until Stripe webhook confirms ──
    // Do NOT notify here; the Payments bot fires only from the webhook.
    if (!restaurant.pagamenti_test && isStripeConfigured() && restaurant.stripe_connect_id) {
      const pi = await createConnectPaymentIntent({
        amountCents: Math.round(totale * 100),
        connectedAccountId: restaurant.stripe_connect_id,
        orderId: order.id,
        restaurantId: restaurant.id,
      });
      await admin
        .from("orders")
        .update({ stripe_payment_intent: pi.id })
        .eq("id", order.id);

      return NextResponse.json({
        ok: true,
        mode: "payment",
        orderId: order.id,
        stripeConfigured: true,
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
        devSimulateAvailable: false,
      });
    }

    // Test mode (or no real Stripe): allow the simulated payment so the full
    // paid→notify→reconcile flow is testable without charging the customer.
    return NextResponse.json({
      ok: true,
      mode: "payment",
      orderId: order.id,
      stripeConfigured: false,
      devSimulateAvailable:
        restaurant.pagamenti_test || process.env.NODE_ENV !== "production",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Errore durante l'invio dell'ordine.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
