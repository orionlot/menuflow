"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { aggregateConto, contoGroupKey, NO_SALA, type ContoLine } from "@/lib/conto";

type ContiActions = {
  estinguiConto: (orderIds: string[]) => Promise<void>;
  toggleScontrino: (orderId: string, value: boolean) => Promise<void>;
};

type Conto = {
  key: string;
  tavolo: string;
  sala: string | null;
  orders: Order[];
  ids: string[];
  apertoDa: string; // oldest created_at iso
  coperti: number;
  prodottiCents: number;
  copertoCents: number;
  manciaCents: number;
  totCents: number;
  lines: ContoLine[];
  daBattere: string[]; // ids of paid orders without scontrino
};

function buildConti(orders: Order[]): Conto[] {
  const groups = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.tavolo) continue;
    const key = contoGroupKey(o.sala, o.tavolo);
    const arr = groups.get(key);
    if (arr) arr.push(o);
    else groups.set(key, [o]);
  }

  const conti: Conto[] = [];
  for (const [key, ords] of groups) {
    const sorted = [...ords].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const agg = aggregateConto(sorted);
    conti.push({
      key,
      tavolo: sorted[0].tavolo as string,
      sala: sorted[0].sala,
      orders: sorted,
      ids: sorted.map((o) => o.id),
      apertoDa: sorted[0].created_at,
      coperti: agg.coperti,
      prodottiCents: agg.prodottiCents,
      copertoCents: agg.copertoCents,
      manciaCents: agg.manciaCents,
      totCents: agg.totCents,
      lines: agg.lines,
      daBattere: sorted.filter((o) => o.stato === "pagato" && !o.scontrino_registrato).map((o) => o.id),
    });
  }
  // Most-recently-active tables first.
  return conti.sort((a, b) => b.apertoDa.localeCompare(a.apertoDa));
}

function apertoLabel(iso: string, now: number): { text: string; tone: "ok" | "warn" | "late" } {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  const tone = min >= 90 ? "late" : min >= 45 ? "warn" : "ok";
  const text = min < 60 ? `aperto da ${min} min` : `aperto da ${Math.floor(min / 60)}h ${min % 60}m`;
  return { text, tone };
}

export default function ContiClient({
  initialOrders,
  restaurantId,
  actions,
}: {
  initialOrders: Order[];
  restaurantId: string;
  actions: ContiActions;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [salaFilter, setSalaFilter] = useState<string>("all");
  const [persone, setPersone] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number>(() => Date.now());
  // Ids being settled: keep them hidden across realtime refreshes until the
  // server stops returning them, so an unrelated refresh can't flash a card back.
  const settlingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // A settle commits asynchronously; once the server refetch no longer returns
    // an id, the settle landed and we can stop tracking it.
    for (const id of settlingRef.current) {
      if (!initialOrders.some((o) => o.id === id)) settlingRef.current.delete(id);
    }
    setOrders(initialOrders.filter((o) => !settlingRef.current.has(o.id)));
  }, [initialOrders]);

  // Tick "aperto da" once a minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // Live board: a new order or a settle from another device refreshes the page.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel(`conti-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId, router]);

  const conti = useMemo(() => buildConti(orders), [orders]);

  // Room filter chips — only when there's something to choose between.
  const salaOptions = useMemo(() => [...new Set(conti.map((c) => c.sala).filter(Boolean))] as string[], [conti]);
  const hasNoSala = conti.some((c) => !c.sala);
  const showSalaFilter = salaOptions.length + (hasNoSala ? 1 : 0) >= 2;

  const visible = conti.filter((c) => {
    if (salaFilter === "all") return true;
    if (salaFilter === NO_SALA) return !c.sala;
    return c.sala === salaFilter;
  });

  const totApertiCents = visible.reduce((s, c) => s + c.totCents, 0);

  function getPersone(c: Conto): number {
    return persone[c.key] ?? Math.max(1, c.coperti);
  }
  function setP(key: string, n: number) {
    setPersone((p) => ({ ...p, [key]: Math.max(1, n) }));
  }

  async function estingui(c: Conto) {
    if (!confirm(`Estinguere il conto del tavolo ${c.tavolo}? Totale ${formatEUR(c.totCents)}.`)) return;
    const idSet = new Set(c.ids);
    c.ids.forEach((id) => settlingRef.current.add(id));
    setPending((p) => new Set(p).add(c.key));
    setOrders((prev) => prev.filter((o) => !idSet.has(o.id))); // optimistic: card disappears
    try {
      await actions.estinguiConto(c.ids);
      // settlingRef ids clear themselves once the server refetch drops them.
    } catch {
      c.ids.forEach((id) => settlingRef.current.delete(id));
      router.refresh(); // restore from server on failure
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(c.key);
        return n;
      });
    }
  }

  async function segnaBattuto(c: Conto) {
    const ids = new Set(c.daBattere);
    setOrders((prev) => prev.map((o) => (ids.has(o.id) ? { ...o, scontrino_registrato: true } : o)));
    try {
      await Promise.all(c.daBattere.map((id) => actions.toggleScontrino(id, true)));
    } catch {
      router.refresh();
    }
  }

  function stampaConto(c: Conto) {
    window.open(`/dashboard/conto/stampa?ids=${c.ids.join(",")}`, "_blank");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Conti aperti</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Ordini raggruppati per tavolo. Estingui il conto quando il tavolo paga.
          </p>
        </div>
        {visible.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm">
            <span className="text-neutral-500">{visible.length} {visible.length === 1 ? "tavolo" : "tavoli"} ·</span>{" "}
            <span className="font-semibold">{formatEUR(totApertiCents)}</span>
          </div>
        )}
      </div>

      {showSalaFilter && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[{ key: "all", label: "Tutte le sale" },
            ...salaOptions.map((s) => ({ key: s, label: s })),
            ...(hasNoSala ? [{ key: NO_SALA, label: "Senza sala" }] : [])].map((f) => (
            <button
              key={f.key}
              onClick={() => setSalaFilter(f.key)}
              aria-pressed={salaFilter === f.key}
              className={`cursor-pointer rounded-full px-3 py-1 text-sm font-medium transition ${
                salaFilter === f.key
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-[var(--brand-soft)] hover:text-brand"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm font-medium text-neutral-700">Nessun conto aperto al momento.</p>
          <p className="mt-1 text-sm text-neutral-500">
            I tavoli con ordini compariranno qui finché non estingui il conto.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const ap = apertoLabel(c.apertoDa, now);
            const busy = pending.has(c.key);
            const n = getPersone(c);
            const apTone =
              ap.tone === "late"
                ? "bg-red-100 text-red-700"
                : ap.tone === "warn"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-neutral-100 text-neutral-500";
            return (
              <div
                key={c.key}
                className={`flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition ${busy ? "opacity-50" : ""}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">Tavolo {c.tavolo}</h2>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {c.sala && (
                        <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 font-medium text-brand">
                          {c.sala}
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 font-medium ${apTone}`}>{ap.text}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-neutral-500">
                    <div>{c.orders.length} {c.orders.length === 1 ? "ordine" : "ordini"}</div>
                    {c.coperti > 0 && <div>{c.coperti} coperti</div>}
                  </div>
                </div>

                {/* Scontrino reminder (management-only) */}
                {c.daBattere.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">⚠️ Scontrino da battere ({c.daBattere.length})</span>
                      <button
                        onClick={() => segnaBattuto(c)}
                        className="cursor-pointer rounded-md bg-amber-600 px-2 py-0.5 font-medium text-white hover:bg-amber-700"
                      >
                        Segna battuto
                      </button>
                    </div>
                    <p className="mt-1 text-amber-900/80">
                      Promemoria gestionale, non sostituisce lo scontrino fiscale.
                    </p>
                  </div>
                )}

                {/* Aggregated items */}
                <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
                  {c.lines.map((l, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 text-neutral-700">
                        <span className="font-medium text-neutral-900">{l.qta}×</span> {l.nome}
                        {l.taglia ? <span className="text-neutral-500"> · {l.taglia}</span> : null}
                        {l.opzioni ? <span className="text-neutral-400"> ({l.opzioni})</span> : null}
                      </span>
                      <span className="shrink-0 text-neutral-500">{formatEUR(l.totCents)}</span>
                    </li>
                  ))}
                </ul>

                {/* Totals */}
                <div className="mt-3 space-y-0.5 border-t border-neutral-100 pt-3 text-sm">
                  <div className="flex justify-between text-neutral-500">
                    <span>Prodotti</span>
                    <span>{formatEUR(c.prodottiCents)}</span>
                  </div>
                  {c.copertoCents > 0 && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Coperto</span>
                      <span>{formatEUR(c.copertoCents)}</span>
                    </div>
                  )}
                  {c.manciaCents > 0 && (
                    <div className="flex justify-between text-neutral-500">
                      <span>Mancia</span>
                      <span>{formatEUR(c.manciaCents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 text-lg font-bold">
                    <span>Totale</span>
                    <span>{formatEUR(c.totCents)}</span>
                  </div>
                </div>

                {/* Dividi alla romana */}
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                  <span className="text-neutral-600">Alla romana</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setP(c.key, n - 1)}
                        aria-label="Meno persone"
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-neutral-300 font-bold text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                        disabled={n <= 1}
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-semibold">{n}</span>
                      <button
                        onClick={() => setP(c.key, n + 1)}
                        aria-label="Più persone"
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-neutral-300 font-bold text-neutral-600 hover:bg-neutral-100"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-semibold text-brand">{formatEUR(Math.round(c.totCents / n))}/p</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => estingui(c)}
                    disabled={busy}
                    className="flex-1 cursor-pointer rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
                  >
                    Estingui conto
                  </button>
                  <button
                    onClick={() => stampaConto(c)}
                    className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50"
                  >
                    🖨 Stampa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
