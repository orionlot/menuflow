import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEUR } from "@/lib/config/plans";
import type { Order } from "@/types/db";
import { aggregateConto, MAX_CONTO_ORDERS } from "@/lib/conto";
import AutoPrint from "../../stampa/[id]/AutoPrint";

export const dynamic = "force-dynamic";

const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8 };

export default async function ContoStampaPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { restaurant } = await requireOwner();
  const sp = await searchParams;
  const ids = (sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_CONTO_ORDERS);

  const notFound = <p style={{ padding: 20 }}>Conto non trovato.</p>;
  if (!ids.length) return notFound;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .in("id", ids)
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: true });
  const orders = (data as Order[]) ?? [];
  if (!orders.length) return notFound;

  const { lines, copertoCents, manciaCents, totCents, coperti } = aggregateConto(orders);
  const tavolo = orders[0].tavolo ?? "—";
  const sala = orders[0].sala;
  const when = new Date().toLocaleString("it-IT");

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
      <div style={{ textAlign: "center", fontSize: 12 }}>Conto</div>
      <hr />
      <div style={row}>
        <span>Tavolo</span>
        <b>{tavolo}</b>
      </div>
      {sala && (
        <div style={row}>
          <span>Sala</span>
          <span>{sala}</span>
        </div>
      )}
      <div style={row}>
        <span>Ordini</span>
        <span>{orders.length}{coperti > 0 ? ` · ${coperti} coperti` : ""}</span>
      </div>
      <div style={{ fontSize: 12 }}>{when}</div>
      <hr />
      {lines.map((l, i) => (
        <div key={i} style={row}>
          <span>
            {l.qta}× {l.nome}
            {l.taglia ? ` · ${l.taglia}` : ""}
            {l.opzioni ? ` (${l.opzioni})` : ""}
          </span>
          <span>{formatEUR(l.totCents)}</span>
        </div>
      ))}
      <hr />
      {copertoCents > 0 && (
        <div style={row}>
          <span>Coperto</span>
          <span>{formatEUR(copertoCents)}</span>
        </div>
      )}
      {manciaCents > 0 && (
        <div style={row}>
          <span>Mancia</span>
          <span>{formatEUR(manciaCents)}</span>
        </div>
      )}
      <div style={{ ...row, fontWeight: 700, fontSize: 15 }}>
        <span>TOTALE</span>
        <span>{formatEUR(totCents)}</span>
      </div>
      <div style={{ marginTop: 10, textAlign: "center", fontSize: 11 }}>
        Promemoria gestionale — non è uno scontrino fiscale.
      </div>
    </main>
  );
}
