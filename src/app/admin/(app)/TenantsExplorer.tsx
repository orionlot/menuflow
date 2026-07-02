"use client";

import { useMemo, useState, type ReactNode } from "react";

export type TenantMeta = {
  id: string;
  nome: string;
  slug: string;
  piano: string;
  attivo: boolean;
  /** The server-rendered card for this tenant (forms + actions intact). */
  node: ReactNode;
};

type StatoFilter = "tutti" | "attivi" | "sospesi";

/** Client-side search + filters over the server-rendered tenant cards.
 *  Pure presentation: filtering hides/shows the pre-rendered nodes, no data
 *  fetching and no change to the underlying forms/actions. */
export default function TenantsExplorer({
  items,
  plans,
}: {
  items: TenantMeta[];
  plans: { id: string; label: string }[];
}) {
  const [q, setQ] = useState("");
  const [piano, setPiano] = useState<string>("tutti");
  const [stato, setStato] = useState<StatoFilter>("tutti");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter(
      (t) =>
        (!query || t.nome.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query)) &&
        (piano === "tutti" || t.piano === piano) &&
        (stato === "tutti" || (stato === "attivi" ? t.attivo : !t.attivo)),
    );
  }, [items, q, piano, stato]);

  const chip = (active: boolean) =>
    `cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${
      active
        ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-sm"
        : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800"
    }`;

  return (
    <div>
      {/* Search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca per nome o slug…"
            aria-label="Cerca ristorante"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["tutti", "attivi", "sospesi"] as const).map((s) => (
            <button key={s} onClick={() => setStato(s)} className={chip(stato === s)}>
              {s === "tutti" ? "Tutti" : s === "attivi" ? "Attivi" : "Sospesi"}
            </button>
          ))}
          <span aria-hidden className="mx-1 h-4 w-px bg-slate-200" />
          <button onClick={() => setPiano("tutti")} className={chip(piano === "tutti")}>
            Ogni piano
          </button>
          {plans.map((p) => (
            <button key={p.id} onClick={() => setPiano(p.id)} className={chip(piano === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
        {filtered.length} {filtered.length === 1 ? "ristorante" : "ristoranti"}
        {filtered.length !== items.length ? ` su ${items.length}` : ""}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Nessun ristorante corrisponde ai filtri.
        </p>
      ) : (
        <div className="space-y-3">{filtered.map((t) => <div key={t.id}>{t.node}</div>)}</div>
      )}
    </div>
  );
}
