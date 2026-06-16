import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyServiceRequest } from "@/lib/telegram";
import { hitRateLimit } from "@/lib/ratelimit";
import { isFeatureOn } from "@/lib/config/features";
import type { Restaurant } from "@/types/db";

export const dynamic = "force-dynamic";

/** Customer at a table calls the waiter / asks for the bill → Orders bot. */
export async function POST(req: Request) {
  if (!(await hitRateLimit(`chiamata:${req.headers.get("x-forwarded-for") ?? "anon"}`, 6, 60_000))) {
    return NextResponse.json({ ok: false, error: "Troppe richieste." }, { status: 429 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let body: { slug?: string; tavolo?: string; tipo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body non valido." }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim().toLowerCase();
  const tavolo = String(body.tavolo ?? "").trim().slice(0, 40);
  const tipo = body.tipo === "conto" ? "conto" : "cameriere";
  if (!slug || !tavolo) {
    return NextResponse.json({ ok: false, error: "Dati mancanti." }, { status: 400 });
  }

  const { data } = await admin.from("restaurants").select("*").eq("slug", slug).maybeSingle();
  const restaurant = data as Restaurant | null;
  if (!restaurant || !restaurant.attivo || !isFeatureOn(restaurant, "richiesta_servizio")) {
    return NextResponse.json({ ok: false, error: "Non disponibile." }, { status: 404 });
  }

  // Persist for the dashboard (Richieste di servizio) + notify the Orders bot.
  await admin
    .from("service_requests")
    .insert({ restaurant_id: restaurant.id, tavolo, tipo });
  await notifyServiceRequest(restaurant, tavolo, tipo);
  return NextResponse.json({ ok: true });
}
