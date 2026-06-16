import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEUR } from "@/lib/config/plans";
import { isFeatureOn } from "@/lib/config/features";
import type { Order } from "@/types/db";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8 };
const sub: React.CSSProperties = { paddingLeft: 12, fontSize: 11, lineHeight: 1.35 };

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

  // Resolve each dish's listed ingredients + description for the comanda. These
  // live on the menu item (not the order snapshot), so look them up by item id.
  const descrizioneOn = isFeatureOn(restaurant, "descrizione");
  const ingredientiOn = isFeatureOn(restaurant, "ingredienti");
  const itemIds = [...new Set((o.items ?? []).map((it) => it.item_id).filter(Boolean))];
  const menuById = new Map<string, { descrizione: string | null; ingredienti: string[] }>();
  const ingNameById = new Map<string, string>();
  if (itemIds.length) {
    const { data: mi } = await supabase
      .from("menu_items")
      .select("id, descrizione, ingredienti")
      .eq("restaurant_id", restaurant.id)
      .in("id", itemIds);
    for (const m of (mi ?? []) as { id: string; descrizione: string | null; ingredienti: string[] }[]) {
      menuById.set(m.id, { descrizione: m.descrizione, ingredienti: m.ingredienti ?? [] });
    }
    if (ingredientiOn) {
      const ingIds = [...new Set([...menuById.values()].flatMap((m) => m.ingredienti))];
      if (ingIds.length) {
        const { data: ings } = await supabase
          .from("ingredients")
          .select("id, nome")
          .eq("restaurant_id", restaurant.id)
          .in("id", ingIds);
        for (const g of (ings ?? []) as { id: string; nome: string }[]) ingNameById.set(g.id, g.nome);
      }
    }
  }

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
      {(o.items ?? []).map((it, i) => {
        const mi = it.item_id ? menuById.get(it.item_id) : undefined;
        const ingNames =
          ingredientiOn && mi?.ingredienti.length
            ? mi.ingredienti.map((iid) => ingNameById.get(iid)).filter(Boolean)
            : [];
        const compo = it.composizione ?? [];
        return (
          <div key={i} style={{ marginBottom: 4 }}>
            <div style={row}>
              <span>
                {it.qta}× {it.nome}
                {it.taglia ? ` · ${it.taglia}` : ""}
                {it.opzioni?.length ? ` (${it.opzioni.map((x) => x.scelta).join(", ")})` : ""}
              </span>
              <span>{formatEUR(Math.round(Number(it.prezzo) * 100) * it.qta)}</span>
            </div>
            {compo.length > 0 && (
              <div style={sub}>{compo.map((c) => `${c.qta}× ${c.nome}`).join(", ")}</div>
            )}
            {ingNames.length > 0 && <div style={sub}>Ingredienti: {ingNames.join(", ")}</div>}
            {descrizioneOn && mi?.descrizione ? <div style={sub}>{mi.descrizione}</div> : null}
            {it.nota ? <div style={sub}>Nota: {it.nota}</div> : null}
          </div>
        );
      })}
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
