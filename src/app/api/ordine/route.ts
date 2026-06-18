import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceCartServerSide } from "@/lib/pricing";
import { computeCopertoCents, computeManciaCents } from "@/lib/pricing-core";
import { notifyNewOrder } from "@/lib/telegram";
import { isStripeConfigured } from "@/lib/env";
import { isFeatureOn } from "@/lib/config/features";
import { ALLERGENI_BY_ID } from "@/lib/config/allergeni";
import { decrementIngredientStock, composableCategories } from "@/lib/ingredients";
import { decrementMenuItemStock } from "@/lib/menu-stock";
import { isMapsUrl } from "@/lib/urls";
import { hitRateLimit, clientIp } from "@/lib/ratelimit";
import { isServiceOpen } from "@/lib/orari";
import { createConnectPaymentIntent } from "@/lib/stripe/connect";
import type { Order, Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

function clean(s: unknown, max = 280): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim().slice(0, max);
  return v.length ? v : null;
}

/** Validate the customer-supplied delivery position (optional). Returns a
 *  normalized Google-Maps URL or null. Shares `isMapsUrl` with the client. */
function cleanMapsUrl(s: unknown, max = 500): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim().slice(0, max);
  if (!v || !isMapsUrl(v)) return null;
  return new URL(v).toString();
}

/**
 * Remember a just-placed order in the `mf_ordini` cookie (2h) so the customer
 * can follow it from the menu ("Segui il tuo ordine"). Not httpOnly — the menu
 * reads it client-side to list recent orders. Best-effort: never fails the order.
 * No localStorage/sessionStorage (project rule); a cookie is the allowed store.
 */
async function recordOrderCookie(slug: string, orderId: string) {
  try {
    const store = await cookies();
    const now = Date.now();
    let list: { id: string; slug: string; at: number }[] = [];
    const raw = store.get("mf_ordini")?.value;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        /* ignore malformed cookie */
      }
    }
    list = list.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.at === "number" &&
        now - e.at < 7_200_000 &&
        e.id !== orderId,
    );
    list.unshift({ id: orderId, slug, at: now });
    store.set("mf_ordini", JSON.stringify(list.slice(0, 10)), {
      maxAge: 7200,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  } catch {
    /* cookie is best-effort */
  }
}

/**
 * Remember the table number (4h) so a second order from the same table doesn't
 * have to re-enter it. Only for table orders — the menu pre-fills from this
 * cookie when there's no ?tavolo= in the URL. Not httpOnly (read client-side).
 */
async function rememberTavolo(slug: string, tavolo: string) {
  try {
    const store = await cookies();
    store.set("mf_tavolo", JSON.stringify({ slug, tavolo, at: Date.now() }), {
      maxAge: 4 * 60 * 60,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: Request) {
  if (!(await hitRateLimit(`ordine:${clientIp(req.headers)}`, 60, 60_000))) {
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
    sala?: string;
    asporto?: boolean;
    tipo?: string;
    indirizzo?: string;
    posizione?: string;
    paga_in_cassa?: boolean;
    note?: string;
    coperti?: number;
    mancia?: number;
    allergeni?: string[];
    items?: {
      item_id: string;
      qta: number;
      opzioni?: { gruppo: string; scelta: string }[];
      composizione?: { ingredient_id: string; qta: number }[];
      taglia_id?: string;
      nota?: string;
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
    if (!isServiceOpen(restaurant, { orariEnabled: isFeatureOn(restaurant, "orari") })) {
      return NextResponse.json(
        { ok: false, error: "Siamo chiusi: ordini non disponibili in questo momento." },
        { status: 409 },
      );
    }

    // Destination: a table number, or the customer name for takeaway/delivery.
    // Delivery is a takeaway-style order (no coperto) that also carries an address.
    const asportoOn = isFeatureOn(restaurant, "asporto");
    const deliveryOn = isFeatureOn(restaurant, "delivery");
    const delivery = deliveryOn && body.tipo === "delivery";
    // Delivery is takeaway-style (no coperto) even if the asporto feature is off.
    const asporto = (asportoOn && Boolean(body.asporto)) || delivery;
    const tipo = delivery ? "delivery" : asporto ? "asporto" : "tavolo";
    const tavolo = clean(body.tavolo, 40);
    if (!tavolo) {
      return NextResponse.json(
        {
          ok: false,
          error: asporto
            ? "Inserisci il nome per il ritiro."
            : "Inserisci il numero del tavolo.",
        },
        { status: 400 },
      );
    }
    const indirizzo = delivery ? clean(body.indirizzo, 200) : null;
    if (delivery && !indirizzo) {
      return NextResponse.json(
        { ok: false, error: "Inserisci l'indirizzo di consegna." },
        { status: 400 },
      );
    }
    const posizione = delivery ? cleanMapsUrl(body.posizione, 500) : null;

    // SECURITY: recompute total from DB prices; never trust the client.
    const componibiliOn = isFeatureOn(restaurant, "componibili");
    const { lines, itemsTotaleCents } = await priceCartServerSide(
      admin,
      restaurant.id,
      body.items ?? [],
      restaurant.aggiunte ?? [],
      {
        enforceScorte: isFeatureOn(restaurant, "scorte"),
        asportoPrezzo: asporto && isFeatureOn(restaurant, "prezzo_asporto"),
      },
      componibiliOn ? (restaurant.composizione ?? []) : [],
      componibiliOn ? (restaurant.composizione_taglie ?? []) : [],
      componibiliOn,
    );

    // Estimated prep time = longest EFFECTIVE prep among the ordered dishes,
    // where effective = the item's own tempo_preparazione, or (fallback) the
    // restaurant's average for that item's category. Anchors the kitchen
    // countdown once a cook starts preparation. Best-effort: a query failure
    // just leaves it null (the countdown then simply doesn't show).
    let tempoStimato: number | null = null;
    const orderedIds = [...new Set(lines.map((l) => l.item_id).filter(Boolean))] as string[];
    if (isFeatureOn(restaurant, "tempo_stimato") && orderedIds.length) {
      const { data: prepRows } = await admin
        .from("menu_items")
        .select("tempo_preparazione, categoria")
        .eq("restaurant_id", restaurant.id)
        .in("id", orderedIds);
      const catTimes = (restaurant.categoria_tempi ?? {}) as Record<string, number>;
      const times = (prepRows ?? [])
        .map((r) => {
          const row = r as { tempo_preparazione: number | null; categoria: string | null };
          return typeof row.tempo_preparazione === "number" && row.tempo_preparazione > 0
            ? row.tempo_preparazione
            : Number(catTimes[row.categoria ?? ""]) || 0;
        })
        .filter((t) => t > 0);
      if (times.length) tempoStimato = Math.max(...times);
    }

    const note = clean(body.note, 280);
    // Takeaway can pay at the counter → treat as a non-online (case A) order.
    const payAtCounter = asporto && Boolean(body.paga_in_cassa);
    const useOnline = restaurant.pagamenti_attivi && !payAtCounter;

    // Coperto: applied server-side per the restaurant's configured mode.
    // Asporto has no cover charge; "persona" otherwise needs a valid count.
    let coperti: number | null = null;
    if (!asporto && restaurant.coperto_modalita === "persona") {
      const c = Number(body.coperti);
      if (!Number.isInteger(c) || c < 1 || c > 50) {
        return NextResponse.json(
          { ok: false, error: "Indica il numero di coperti." },
          { status: 400 },
        );
      }
      coperti = c;
    }
    const copertoCents = asporto
      ? 0
      : computeCopertoCents(
          restaurant.coperto_modalita,
          restaurant.coperto,
          coperti ?? 0,
          itemsTotaleCents,
        );
    // The in-app tip only applies to an online payment.
    const manciaCents = computeManciaCents(
      useOnline,
      restaurant.accetta_mancia,
      body.mancia,
    );

    const totaleCents = itemsTotaleCents + copertoCents + manciaCents;
    const totale = totaleCents / 100;

    // Allergens the customer declared (only when the feature is on); keep known ids.
    const allergeni = isFeatureOn(restaurant, "allergeni_ordine")
      ? [...new Set((body.allergeni ?? []).filter((a) => ALLERGENI_BY_ID.has(a)))].slice(0, 14)
      : [];

    // Sala chosen by the customer (only when the feature is on + it's a real room).
    const sala =
      !asporto && isFeatureOn(restaurant, "sala_ordine") && body.sala
        ? (restaurant.sale ?? []).some((s) => s.nome === body.sala)
          ? body.sala
          : null
        : null;

    const { data: orderRow, error: oErr } = await admin
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        tavolo,
        sala,
        asporto,
        tipo,
        indirizzo,
        posizione,
        items: lines,
        totale,
        mancia: manciaCents / 100,
        coperti,
        coperto_tot: copertoCents / 100,
        tempo_stimato: tempoStimato,
        allergeni,
        note,
        stato: useOnline ? "in_attesa_pagamento" : "ricevuto",
      })
      .select("*")
      .single();
    const order = orderRow as Order | null;

    if (oErr || !order) {
      return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
    }

    // Remember it for the customer's "Segui il tuo ordine" list (2h cookie).
    await recordOrderCookie(slug, order.id);
    if (tipo === "tavolo") await rememberTavolo(slug, tavolo);

    // ── Case A: no online payment (payments off OR pay-at-counter) → valid now ──
    if (!useOnline) {
      // Decrement per-product stock for items that track it.
      if (isFeatureOn(restaurant, "scorte")) {
        await decrementMenuItemStock(admin, lines);
      }
      // Decrement ingredient stock: composable products consume their chosen
      // composition; simple products consume their listed ingredients.
      const componibiliOn = isFeatureOn(restaurant, "componibili");
      const ingredientiOn = isFeatureOn(restaurant, "ingredienti");
      if (componibiliOn || ingredientiOn) {
        await decrementIngredientStock(
          admin,
          lines,
          { composizione: componibiliOn, ingredienti: ingredientiOn },
          composableCategories(restaurant.composizione, componibiliOn),
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
    // Unexpected failure: log it (monitoring) and return a GENERIC message — never
    // leak internal error text to the diner — with 500 so error alerting fires.
    console.error("[api/ordine] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error: "Errore durante l'invio dell'ordine. Riprova o rivolgiti allo staff." },
      { status: 500 },
    );
  }
}
