import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Order } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import ReconClient from "./ReconClient";

export const dynamic = "force-dynamic";

function dayRange(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function ReconciliationPage({
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
    .eq("stato", "pagato")
    .gte("pagato_at", start)
    .lt("pagato_at", end)
    .order("pagato_at", { ascending: false });

  const orders = (data as Order[]) ?? [];
  const totalCents = orders.reduce(
    (s, o) => s + Math.round(Number(o.totale) * 100),
    0,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Riconciliazione pagamenti</h1>
        <form className="flex items-center gap-2 text-sm">
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

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="text-xs text-neutral-500">Incassato in app (giorno)</div>
        <div className="text-3xl font-bold">{formatEUR(totalCents)}</div>
        <div className="text-xs text-neutral-500">
          {orders.length} pagament{orders.length === 1 ? "o" : "i"}
        </div>
      </div>

      <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Questa spunta è un promemoria gestionale e non sostituisce l&apos;emissione
        dello scontrino fiscale.
      </p>

      <ReconClient orders={orders} />
    </div>
  );
}
