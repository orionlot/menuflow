import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEUR } from "@/lib/config/plans";

export const dynamic = "force-dynamic";

type Row = {
  tavolo: string | null;
  asporto: boolean;
  totale: number;
  created_at: string;
};

/** Lightweight "Clienti" view: recent destinations (table / takeaway name) from
 *  orders, aggregated. The app has no customer accounts, so this summarises who
 *  ordered recently. */
export default async function ClientiPage() {
  const { restaurant } = await requireOwner();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("tavolo, asporto, totale, created_at")
    .eq("restaurant_id", restaurant.id)
    .in("stato", ["ricevuto", "pagato"])
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data as Row[]) ?? [];

  // Aggregate by destination (tavolo number, or takeaway/delivery name).
  const byKey = new Map<string, { nome: string; asporto: boolean; ordini: number; speso: number; last: string }>();
  for (const r of rows) {
    const nome = (r.tavolo ?? "—").trim() || "—";
    const key = `${r.asporto ? "a" : "t"}:${nome.toLowerCase()}`;
    const cur = byKey.get(key) ?? { nome, asporto: r.asporto, ordini: 0, speso: 0, last: r.created_at };
    cur.ordini += 1;
    cur.speso += Number(r.totale) || 0;
    if (r.created_at > cur.last) cur.last = r.created_at;
    byKey.set(key, cur);
  }
  const clienti = [...byKey.values()].sort((a, b) => (a.last < b.last ? 1 : -1));

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Clienti</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Tavoli e nominativi che hanno ordinato di recente (ultimi 200 ordini).
      </p>
      {clienti.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Ancora nessun ordine.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs font-semibold text-neutral-500">
              <tr>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5 text-right">Ordini</th>
                <th className="px-4 py-2.5 text-right">Totale speso</th>
                <th className="px-4 py-2.5 text-right">Ultimo ordine</th>
              </tr>
            </thead>
            <tbody>
              {clienti.map((c, i) => (
                <tr key={i} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-neutral-900">
                    {c.asporto ? c.nome : `Tavolo ${c.nome}`}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{c.asporto ? "Asporto" : "Sala"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.ordini}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatEUR(Math.round(c.speso * 100))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">
                    {new Date(c.last).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
