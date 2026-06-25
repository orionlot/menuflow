"use client";

import { useMemo, useState, useTransition } from "react";
import type { Prenotazione, PrenotazioneStato } from "@/types/db";

type Filter = "da_confermare" | "agenda" | "tutte";

const STATO_META: Record<PrenotazioneStato, { label: string; cls: string }> = {
  in_attesa: { label: "Da confermare", cls: "bg-amber-100 text-amber-700" },
  confermata: { label: "Confermata", cls: "bg-green-100 text-green-700" },
  rifiutata: { label: "Rifiutata", cls: "bg-neutral-200 text-neutral-500" },
  annullata: { label: "Annullata", cls: "bg-neutral-200 text-neutral-500" },
};

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const s = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Oggi" / "Domani" / weekday+date. `today`/`tomorrow` are YYYY-MM-DD (Europe/Rome). */
function dayLabel(iso: string, today: string, tomorrow: string): string {
  if (iso === today) return "Oggi";
  if (iso === tomorrow) return "Domani";
  return formatDay(iso);
}

export default function PrenotazioniClient({
  initial,
  setStatus,
  today,
}: {
  initial: Prenotazione[];
  setStatus: (id: string, stato: PrenotazioneStato) => Promise<void>;
  /** YYYY-MM-DD (Europe/Rome) computed server-side — avoids any hydration drift. */
  today: string;
}) {
  const [rows, setRows] = useState<Prenotazione[]>(initial);
  const [filter, setFilter] = useState<Filter>("da_confermare");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Tomorrow derived deterministically from the server `today` (no clock call).
  const tomorrow = useMemo(() => {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat("en-CA").format(d);
  }, [today]);

  const pendingCount = rows.filter((r) => r.stato === "in_attesa").length;
  const confermateCount = rows.filter((r) => r.stato === "confermata").length;

  const visible = useMemo(() => {
    if (filter === "da_confermare") return rows.filter((r) => r.stato === "in_attesa");
    if (filter === "agenda") return rows.filter((r) => r.stato === "confermata");
    return rows;
  }, [rows, filter]);

  // Group the visible reservations by day (already sorted by data, ora server-side).
  const byDay = useMemo(() => {
    const m = new Map<string, Prenotazione[]>();
    for (const r of visible) {
      const arr = m.get(r.data);
      if (arr) arr.push(r);
      else m.set(r.data, [r]);
    }
    return [...m.entries()];
  }, [visible]);

  function update(id: string, stato: PrenotazioneStato) {
    setError(null);
    const prevStato = rows.find((r) => r.id === id)?.stato;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stato } : r)));
    startTransition(async () => {
      try {
        await setStatus(id, stato);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore nel salvataggio.");
        // Revert ONLY this row to its prior status (don't discard other edits).
        if (prevStato) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stato: prevStato } : r)));
      }
    });
  }

  const TABS: { id: Filter; label: string }[] = [
    { id: "da_confermare", label: `Da confermare${pendingCount ? ` (${pendingCount})` : ""}` },
    { id: "agenda", label: `Agenda${confermateCount ? ` (${confermateCount})` : ""}` },
    { id: "tutte", label: "Tutte" },
  ];

  const emptyText =
    filter === "da_confermare"
      ? "Nessuna richiesta da confermare."
      : filter === "agenda"
        ? "Nessuna prenotazione confermata in arrivo."
        : "Ancora nessuna prenotazione.";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Prenotazioni</h1>
        <div className="flex rounded-full border border-neutral-200 p-0.5 text-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-full px-3 py-1.5 font-medium transition ${
                filter === t.id ? "bg-[var(--brand-soft)] text-brand" : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-sm font-medium text-red-600">{error}</p>}

      {byDay.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-6">
          {byDay.map(([day, list]) => {
            const coperti = list.reduce((s, r) => s + r.coperti, 0);
            return (
              <section key={day}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                    {filter === "agenda" ? dayLabel(day, today, tomorrow) : formatDay(day)}
                  </h2>
                  {filter === "agenda" && (
                    <span className="text-xs font-medium text-neutral-400">
                      {list.length} {list.length === 1 ? "prenotazione" : "prenotazioni"} · {coperti} coperti
                    </span>
                  )}
                </div>

                {filter === "agenda" ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((r) => (
                      <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-xl font-bold leading-none">{r.ora}</span>
                          <span className="text-xs font-medium text-neutral-500">👥 {r.coperti}</span>
                        </div>
                        <div className="mt-2 font-semibold">{r.nome}</div>
                        <div className="mt-0.5 text-sm text-neutral-500">
                          <a href={`tel:${r.telefono}`} className="hover:text-brand">
                            ☎ {r.telefono}
                          </a>
                          {r.sala ? ` · 🪑 ${r.sala}` : ""}
                        </div>
                        {r.note && <div className="mt-1 text-sm text-neutral-500">📝 {r.note}</div>}
                        <button
                          disabled={pending}
                          onClick={() => update(r.id, "annullata")}
                          className="mt-3 text-xs font-semibold text-red-500 transition hover:underline disabled:opacity-50"
                        >
                          Annulla
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {list.map((r) => {
                      const meta = STATO_META[r.stato];
                      return (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200 bg-white p-3"
                        >
                          <div className="w-14 shrink-0 text-center">
                            <div className="font-display text-lg font-bold leading-none">{r.ora}</div>
                            <div className="mt-1 text-xs text-neutral-400">
                              {r.coperti} {r.coperti === 1 ? "persona" : "persone"}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{r.nome}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                                {meta.label}
                              </span>
                            </div>
                            <div className="mt-0.5 text-sm text-neutral-500">
                              <a href={`tel:${r.telefono}`} className="hover:text-brand">
                                ☎ {r.telefono}
                              </a>
                              {r.sala ? ` · 🪑 ${r.sala}` : ""}
                            </div>
                            {r.note && <div className="mt-0.5 text-sm text-neutral-500">📝 {r.note}</div>}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            {r.stato === "in_attesa" && (
                              <>
                                <button
                                  disabled={pending}
                                  onClick={() => update(r.id, "confermata")}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                                >
                                  Conferma
                                </button>
                                <button
                                  disabled={pending}
                                  onClick={() => update(r.id, "rifiutata")}
                                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
                                >
                                  Rifiuta
                                </button>
                              </>
                            )}
                            {r.stato === "confermata" && (
                              <button
                                disabled={pending}
                                onClick={() => update(r.id, "annullata")}
                                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
                              >
                                Annulla
                              </button>
                            )}
                            {(r.stato === "rifiutata" || r.stato === "annullata") && (
                              <button
                                disabled={pending}
                                onClick={() => update(r.id, "in_attesa")}
                                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 disabled:opacity-50"
                              >
                                Ripristina
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
