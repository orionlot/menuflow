import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Order } from "@/types/db";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90];

// CSV for Italian Excel: ";" separator, UTF-8 BOM, comma decimals.
const SEP = ";";
function field(v: string): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}
function eur(n: number): string {
  return Number(n).toFixed(2).replace(".", ",");
}

export async function GET(req: Request) {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: "Non autorizzato." }, { status: 401 });
  }

  const url = new URL(req.url);
  const r = Number(url.searchParams.get("range"));
  const range = RANGES.includes(r) ? r : 30;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - range + 1);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .in("stato", ["ricevuto", "pagato"])
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  const orders = (data as Order[]) ?? [];

  const header = [
    "Data",
    "Ora",
    "Tavolo",
    "Stato",
    "N. articoli",
    "Totale (EUR)",
    "Scontrino registrato",
    "Prodotti",
    "Note",
  ];

  const rows = orders.map((o) => {
    const d = new Date(o.created_at);
    const nArt = (o.items ?? []).reduce((s, i) => s + i.qta, 0);
    const prodotti = (o.items ?? []).map((i) => `${i.qta}x ${i.nome}`).join(" | ");
    return [
      d.toLocaleDateString("it-IT"),
      d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      o.tavolo ?? "",
      o.stato,
      String(nArt),
      eur(o.totale),
      o.scontrino_registrato ? "Sì" : "No",
      prodotti,
      o.note ?? "",
    ];
  });

  const totCents = orders.reduce((s, o) => s + Math.round(Number(o.totale) * 100), 0);
  const totalRow = ["", "", "", "", "TOTALE", eur(totCents / 100), "", "", ""];

  const csv =
    "﻿" +
    [header, ...rows, [], totalRow]
      .map((line) => line.map((c) => field(c)).join(SEP))
      .join("\r\n");

  const today = new Date().toISOString().slice(0, 10);
  const filename = `menuflow_${restaurant.slug}_${range}g_${today}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
