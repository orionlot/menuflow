import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Order } from "@/types/db";
import OrdiniClient from "./OrdiniClient";
import { isFeatureOn } from "@/lib/config/features";

export const dynamic = "force-dynamic";

function dayRange(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function OrdiniPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { restaurant } = await requireOwner();
  const sp = await searchParams;
  const day = sp.day ?? new Date().toISOString().slice(0, 10);
  const { start, end } = dayRange(day);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });
  const orders = (data as Order[]) ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">Ordini</h1>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-neutral-500">Giorno</label>
          <input
            type="date"
            name="day"
            defaultValue={day}
            className="rounded-md border border-neutral-300 px-2 py-1"
          />
          <button className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-100">
            Filtra
          </button>
        </form>
      </div>

      <OrdiniClient
        initialOrders={orders}
        day={day}
        stampaOn={isFeatureOn(restaurant, "stampa")}
        riepilogoOn={isFeatureOn(restaurant, "riepilogo")}
      />
    </div>
  );
}
