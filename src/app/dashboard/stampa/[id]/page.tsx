import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEUR } from "@/lib/config/plans";
import type { Order } from "@/types/db";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8 };

export default async function StampaPage({ params }: { params: Promise<{ id: string }> }) {
  const { restaurant } = await requireOwner();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();
  const o = data as Order | null;
  if (!o) return <p style={{ padding: 20 }}>Ordine non trovato.</p>;

  const when = new Date(o.created_at).toLocaleString("it-IT");

  return (
    <main
      style={{
        width: "80mm",
        margin: "0 auto",
        padding: "10px 12px",
        fontFamily: "ui-monospace, Menlo, monospace",
        color: "#000",
        background: "#fff",
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <AutoPrint />
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 17 }}>{restaurant.nome}</div>
      <div style={{ textAlign: "center", fontSize: 12 }}>Comanda</div>
      <hr />
      <div style={row}>
        <span>Tavolo</span>
        <b>{o.tavolo ?? "—"}</b>
      </div>
      <div style={{ fontSize: 12 }}>{when}</div>
      <hr />
      {(o.items ?? []).map((it, i) => (
        <div key={i} style={row}>
          <span>
            {it.qta}× {it.nome}
            {it.opzioni?.length ? ` (${it.opzioni.map((x) => x.scelta).join(", ")})` : ""}
          </span>
          <span>{formatEUR(Math.round(Number(it.prezzo) * 100) * it.qta)}</span>
        </div>
      ))}
      <hr />
      {o.coperto_tot > 0 && (
        <div style={row}>
          <span>Coperto</span>
          <span>{formatEUR(Math.round(Number(o.coperto_tot) * 100))}</span>
        </div>
      )}
      {o.mancia > 0 && (
        <div style={row}>
          <span>Mancia</span>
          <span>{formatEUR(Math.round(Number(o.mancia) * 100))}</span>
        </div>
      )}
      <div style={{ ...row, fontWeight: 700, fontSize: 15 }}>
        <span>TOTALE</span>
        <span>{formatEUR(Math.round(Number(o.totale) * 100))}</span>
      </div>
      {o.note && <div style={{ marginTop: 6 }}>Note: {o.note}</div>}
      <div style={{ marginTop: 10, textAlign: "center", fontSize: 11 }}>
        Promemoria gestionale — non è uno scontrino fiscale.
      </div>
    </main>
  );
}
