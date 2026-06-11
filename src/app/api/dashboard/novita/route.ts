import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Live feed for the Ordini dashboard: the selected day's orders (RLS-scoped),
 * plus active service calls (`chiamate`) — empty until Module 5 lands. The
 * client polls this to show the unread badge, auto-refresh, and ring a sound.
 */
export async function GET(req: Request) {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: "Non autorizzato." }, { status: 401 });
  }

  const url = new URL(req.url);
  const day = (url.searchParams.get("day") || new Date().toISOString().slice(0, 10)).slice(
    0,
    10,
  );
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, orders: data ?? [], chiamate: [] });
}
