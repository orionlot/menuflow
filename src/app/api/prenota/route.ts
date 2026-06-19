import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureOn } from "@/lib/config/features";
import { hitRateLimit, clientIp } from "@/lib/ratelimit";
import { validatePrenotazione } from "@/lib/prenotazioni";
import { notifyNewReservation } from "@/lib/telegram";
import type { Prenotazione, Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

/** A date (YYYY-MM-DD) in the restaurant's locale, offset by `addYears`. Used to
 *  bound reservations between today and ~1 year out. */
function romeDate(addYears = 0): string {
  const now = new Date();
  if (addYears) now.setUTCFullYear(now.getUTCFullYear() + addYears);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
}

export async function POST(req: Request) {
  if (!(await hitRateLimit(`prenota:${clientIp(req.headers)}`, 20, 60_000))) {
    return NextResponse.json({ ok: false, error: "Troppe richieste." }, { status: 429 });
  }
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body non valido." }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim().slice(0, 120);
  if (!slug) return NextResponse.json({ ok: false, error: "Slug mancante." }, { status: 400 });

  try {
    const { data: row, error: rErr } = await admin
      .from("restaurants")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (rErr) return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
    const restaurant = row as Restaurant | null;
    if (!restaurant) return NextResponse.json({ ok: false, error: "Locale non trovato." }, { status: 404 });
    if (!restaurant.attivo) {
      return NextResponse.json(
        { ok: false, error: "Servizio temporaneamente non disponibile." },
        { status: 409 },
      );
    }
    if (!isFeatureOn(restaurant, "prenotazioni")) {
      return NextResponse.json({ ok: false, error: "Prenotazioni non disponibili." }, { status: 403 });
    }

    const v = validatePrenotazione(body, { minDate: romeDate(), maxDate: romeDate(1) });
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

    const { data: inserted, error: iErr } = await admin
      .from("prenotazioni")
      .insert({ restaurant_id: restaurant.id, ...v.value })
      .select("*")
      .single();
    if (iErr || !inserted) {
      return NextResponse.json({ ok: false, maintenance: true }, { status: 503 });
    }

    await notifyNewReservation(restaurant, inserted as Prenotazione);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/prenota] failed:", err);
    return NextResponse.json({ ok: false, error: "Errore durante l'invio." }, { status: 500 });
  }
}
