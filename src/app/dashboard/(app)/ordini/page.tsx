import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEUR } from "@/lib/config/plans";
import type { Order } from "@/types/db";

export const dynamic = "force-dynamic";

function statoBadge(o: Order): { text: string; cls: string } {
  if (o.stato === "in_attesa_pagamento")
    return { text: "In attesa pagamento", cls: "bg-amber-100 text-amber-700" };
  if (o.stato === "fallito")
    return { text: "Pagamento fallito", cls: "bg-red-100 text-red-700" };
  if (o.servito_at) return { text: "Servito", cls: "bg-neutral-200 text-neutral-600" };
  if (o.pronto_at) return { text: "Pronto", cls: "bg-green-100 text-green-700" };
  return { text: "In preparazione", cls: "bg-blue-100 text-blue-700" };
}

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Ordini</h1>
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

      {orders.length === 0 ? (
        <p className="text-neutral-500">Nessun ordine in questo giorno.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const b = statoBadge(o);
            return (
              <li key={o.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium">Tavolo {o.tavolo ?? "—"}</span>
                    <span className="ml-2 text-sm text-neutral-500">
                      {new Date(o.created_at).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>
                      {b.text}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold">
                    {formatEUR(Math.round(Number(o.totale) * 100))}
                  </span>
                </div>

                <ul className="mt-2 space-y-0.5 border-t border-neutral-100 pl-1 pt-2 text-sm">
                  {(o.items ?? []).map((it, i) => (
                    <li key={`${o.id}-${i}`} className="flex items-baseline justify-between gap-2">
                      <span className="text-neutral-700">
                        <span className="font-medium text-neutral-900">{it.qta}×</span> {it.nome}
                        {it.opzioni?.length ? (
                          <span className="text-neutral-400">
                            {" "}
                            ({it.opzioni.map((x) => x.scelta).join(", ")})
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-neutral-500">
                        {formatEUR(Math.round(Number(it.prezzo) * 100) * it.qta)}
                      </span>
                    </li>
                  ))}
                </ul>

                {(o.coperti || o.coperto_tot > 0 || o.mancia > 0 || o.note) && (
                  <p className="mt-2 pl-1 text-xs text-neutral-500">
                    {o.coperti ? `Coperti: ${o.coperti}` : ""}
                    {o.coperto_tot > 0
                      ? ` · Coperto: ${formatEUR(Math.round(Number(o.coperto_tot) * 100))}`
                      : ""}
                    {o.mancia > 0 ? ` · Mancia: ${formatEUR(Math.round(Number(o.mancia) * 100))}` : ""}
                    {o.note ? ` · 📝 ${o.note}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
