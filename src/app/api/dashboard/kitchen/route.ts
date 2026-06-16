import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Live kitchen feed: real orders (ricevuto/pagato) not yet served, last 24h. */
export async function GET() {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: "Non autorizzato." }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, tavolo, asporto, items, totale, note, created_at, pronto_at, stato")
    .eq("restaurant_id", restaurant.id)
    .in("stato", ["ricevuto", "pagato"])
    .is("servito_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, orders: data ?? [] });
}
