"use client";

import { useMemo, useState } from "react";
import { formatEUR } from "@/lib/config/plans";
import type { PickerItem } from "./OrdiniClient";

type Tipo = "tavolo" | "asporto" | "delivery";

export type ContoData = {
  ids: string[];
  lines: { nome: string; qta: number; totCents: number }[];
  prodottiCents: number;
  copertoCents: number;
  manciaCents: number;
  totCents: number;
};

const EMPTY_CONTO: ContoData = {
  ids: [],
  lines: [],
  prodottiCents: 0,
  copertoCents: 0,
  manciaCents: 0,
  totCents: 0,
};

export default function ManualOrderModal({
  items,
  asportoOn,
  deliveryOn,
  copertoModalita,
  portateOn = false,
  initialTavolo,
  initialSala,
  tableOnly = false,
  contiOn = false,
  caricaConto,
  estingui,
  onClose,
  onCreate,
}: {
  items: PickerItem[];
  asportoOn: boolean;
  deliveryOn: boolean;
  copertoModalita: string;
  portateOn?: boolean;
  initialTavolo?: string;
  initialSala?: string;
  /** Sala "servizio" context: hide Asporto/Delivery, show a "Conto" tab. */
  tableOnly?: boolean;
  contiOn?: boolean;
  caricaConto?: (tavolo: string, sala?: string) => Promise<ContoData>;
  estingui?: (ids: string[]) => Promise<void>;
  onClose: () => void;
  onCreate: (input: {
    tavolo: string;
    tipo: Tipo;
    sala?: string;
    indirizzo?: string;
    coperti?: number;
    note?: string;
    items: { item_id: string; qta: number; a_seguire?: boolean }[];
  }) => Promise<void>;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [aSeguire, setASeguire] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState<Tipo>("tavolo");
  const [tavolo, setTavolo] = useState(initialTavolo ?? "");
  const [sala, setSala] = useState(initialSala ?? "");
  const [indirizzo, setIndirizzo] = useState("");
  const [coperti, setCoperti] = useState(0);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Conto" view (Sala servizio only).
  const [view, setView] = useState<"ordine" | "conto">("ordine");
  const [conto, setConto] = useState<ContoData | null>(null);
  const [loadingConto, setLoadingConto] = useState(false);
  const [estinguendo, setEstinguendo] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // "Dividi alla romana" — on-screen helper for the waiter (Conto tab).
  const [persone, setPersone] = useState(2);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const i of items) if (!seen.includes(i.categoria)) seen.push(i.categoria);
    return seen;
  }, [items]);

  const lineCount = Object.values(cart).reduce((s, q) => s + q, 0);
  // Item lines only — the coperto is added server-side, hence the "~" estimate.
  const estimateCents = Object.entries(cart).reduce(
    (s, [id, q]) => s + Math.round((byId.get(id)?.prezzo ?? 0) * 100) * q,
    0,
  );

  // Delta-based functional update so rapid +/− taps never read a stale count.
  function addQty(id: string, delta: number) {
    setCart((c) => {
      const next = { ...c };
      const q = (next[id] ?? 0) + delta;
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });
  }

  function toggleSeguire(id: string) {
    setASeguire((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openConto() {
    setView("conto");
    if (!caricaConto) return;
    setLoadingConto(true);
    caricaConto(tavolo.trim() || (initialTavolo ?? ""), sala.trim() || undefined)
      .then(setConto)
      .catch(() => setConto(EMPTY_CONTO))
      .finally(() => setLoadingConto(false));
  }

  async function doEstingui() {
    if (!estingui || !conto || conto.ids.length === 0) return;
    setError(null);
    setEstinguendo(true);
    try {
      await estingui(conto.ids);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nella chiusura del conto.");
      setEstinguendo(false);
    }
  }

  function validate(): boolean {
    setError(null);
    if (!lineCount) {
      setError("Aggiungi almeno un prodotto.");
      return false;
    }
    if (!tavolo.trim()) {
      setError(tipo === "tavolo" ? "Inserisci il tavolo." : "Inserisci il nome.");
      return false;
    }
    if (tipo === "delivery" && !indirizzo.trim()) {
      setError("Inserisci l'indirizzo di consegna.");
      return false;
    }
    if (tipo === "tavolo" && copertoModalita === "persona" && !coperti) {
      setError("Indica il numero di coperti.");
      return false;
    }
    return true;
  }

  async function doCreate() {
    setSubmitting(true);
    try {
      await onCreate({
        tavolo: tavolo.trim(),
        tipo,
        sala: sala.trim() || undefined,
        indirizzo: tipo === "delivery" ? indirizzo.trim() : undefined,
        coperti: coperti || undefined,
        note: note.trim() || undefined,
        items: Object.entries(cart).map(([item_id, qta]) => ({
          item_id,
          qta,
          a_seguire: aSeguire.has(item_id) || undefined,
        })),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nella creazione.");
      setSubmitting(false);
      setConfirming(false); // surface the error back in the modal
    }
  }

  function submit() {
    if (!validate()) return;
    // From the Sala (servizio) a confirmation popup gates the create; elsewhere
    // (Ordini page) the order is created directly as before.
    if (tableOnly) setConfirming(true);
    else void doCreate();
  }

  const tipoOptions: { id: Tipo; label: string }[] = [
    { id: "tavolo", label: "Tavolo" },
    ...(asportoOn ? ([{ id: "asporto", label: "Asporto" }] as const) : []),
    ...(deliveryOn ? ([{ id: "delivery", label: "Delivery" }] as const) : []),
  ];

  // Dish search — filters the picker by name or category so the waiter can find
  // a plate fast instead of scrolling every category. Items already in the cart
  // stay visible even while a search is active, so every line that will be
  // submitted remains reachable (adjust quantity / "a seguire").
  const queryLc = query.trim().toLowerCase();
  const matchesQuery = (i: PickerItem) =>
    !queryLc || i.nome.toLowerCase().includes(queryLc) || i.categoria.toLowerCase().includes(queryLc);
  const inPicker = (i: PickerItem) => matchesQuery(i) || (cart[i.id] ?? 0) > 0;
  const anyVisible = items.some(inPicker);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-lg font-bold">{view === "conto" ? "Conto del tavolo" : "Nuovo ordine"}</h2>
          <button onClick={onClose} aria-label="Chiudi" className="text-2xl leading-none text-neutral-400 hover:text-neutral-700">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Tabs: Tavolo/Asporto/Delivery (Ordini) — or Tavolo/Conto (Sala servizio) */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tableOnly
              ? (["ordine", "conto"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => (v === "conto" ? openConto() : setView("ordine"))}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      view === v ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {v === "ordine" ? "Tavolo" : "Conto"}
                  </button>
                ))
              : tipoOptions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTipo(t.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      tipo === t.id ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
          </div>

          {view === "conto" ? (
            <div>
              {loadingConto ? (
                <p className="py-8 text-center text-sm text-neutral-500">Carico il conto…</p>
              ) : !conto || conto.ids.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">Nessun ordine aperto a questo tavolo.</p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {conto.lines.map((l, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium text-neutral-900">{l.qta}×</span> {l.nome}
                        </span>
                        <span className="shrink-0 text-neutral-500">{formatEUR(l.totCents)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-sm">
                    <div className="flex justify-between text-neutral-500">
                      <span>Prodotti</span>
                      <span>{formatEUR(conto.prodottiCents)}</span>
                    </div>
                    {conto.copertoCents > 0 && (
                      <div className="flex justify-between text-neutral-500">
                        <span>Coperto</span>
                        <span>{formatEUR(conto.copertoCents)}</span>
                      </div>
                    )}
                    {conto.manciaCents > 0 && (
                      <div className="flex justify-between text-neutral-500">
                        <span>Mancia</span>
                        <span>{formatEUR(conto.manciaCents)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 text-base font-bold">
                      <span>Totale</span>
                      <span>{formatEUR(conto.totCents)}</span>
                    </div>
                  </div>

                  {/* Dividi alla romana — quota per persona (solo a schermo) */}
                  <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Dividi alla romana</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPersone((n) => Math.max(1, n - 1))}
                          disabled={persone <= 1}
                          aria-label="Meno persone"
                          className="grid h-7 w-7 place-items-center rounded-full bg-neutral-200 text-neutral-700 hover:bg-neutral-300 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{persone}</span>
                        <button
                          type="button"
                          onClick={() => setPersone((n) => Math.min(50, n + 1))}
                          aria-label="Più persone"
                          className="grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-white hover:bg-neutral-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-xs text-neutral-500">
                        {persone} {persone === 1 ? "persona" : "persone"}
                      </span>
                      <span className="text-base font-bold">
                        {formatEUR(Math.ceil(conto.totCents / persone))}
                        <span className="ml-1 text-xs font-normal text-neutral-500">a testa</span>
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Destination */}
              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={tavolo}
                  onChange={(e) => setTavolo(e.target.value)}
                  placeholder={tipo === "tavolo" ? "Numero tavolo" : "Nome cliente"}
                  maxLength={40}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <input
                  value={sala}
                  onChange={(e) => setSala(e.target.value)}
                  placeholder="Sala / zona (facoltativo)"
                  maxLength={60}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                {tipo === "delivery" && (
                  <input
                    value={indirizzo}
                    onChange={(e) => setIndirizzo(e.target.value)}
                    placeholder="Indirizzo di consegna"
                    maxLength={200}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
                  />
                )}
                {tipo === "tavolo" && copertoModalita === "persona" && (
                  <input
                    type="number"
                    min="0"
                    value={coperti || ""}
                    onChange={(e) => setCoperti(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="Coperti"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                )}
              </div>

              {/* Dish search */}
              {items.length > 0 && (
                <div className="relative mb-3">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cerca un piatto…"
                    maxLength={60}
                    aria-label="Cerca un piatto"
                    className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-9 text-sm"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Cancella ricerca"
                      className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}

              {/* Item picker */}
              <div className="space-y-3">
                {categories.map((cat) => {
                  const catItems = items.filter((i) => i.categoria === cat && inPicker(i));
                  if (catItems.length === 0) return null;
                  return (
                  <div key={cat}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">{cat}</p>
                    <ul className="space-y-1">
                      {catItems
                        .map((i) => {
                          const q = cart[i.id] ?? 0;
                          return (
                            <li key={i.id} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm">{i.nome}</span>
                              <span className="shrink-0 text-sm text-neutral-500">
                                {formatEUR(Math.round(i.prezzo * 100))}
                              </span>
                              {portateOn && q > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleSeguire(i.id)}
                                  title="Servi a seguire (il cuoco lo terrà per dopo)"
                                  className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${
                                    aSeguire.has(i.id)
                                      ? "bg-violet-600 text-white"
                                      : "border border-neutral-300 text-neutral-500 hover:bg-neutral-50"
                                  }`}
                                >
                                  A seguire
                                </button>
                              )}
                              <div className="flex shrink-0 items-center gap-1.5">
                                <button
                                  onClick={() => addQty(i.id, -1)}
                                  disabled={q === 0}
                                  className="grid h-7 w-7 place-items-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
                                >
                                  −
                                </button>
                                <span className="w-5 text-center text-sm font-semibold tabular-nums">{q}</span>
                                <button
                                  onClick={() => addQty(i.id, 1)}
                                  className="grid h-7 w-7 place-items-center rounded-full bg-neutral-900 text-white hover:bg-neutral-700"
                                >
                                  +
                                </button>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="text-sm text-neutral-500">Nessun prodotto disponibile.</p>
                )}
                {items.length > 0 && queryLc && !anyVisible && (
                  <p className="py-4 text-center text-sm text-neutral-500">
                    Nessun piatto trovato per «{query.trim()}».
                  </p>
                )}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (facoltative)"
                maxLength={280}
                rows={2}
                className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </>
          )}
        </div>

        {error && <p className="px-5 text-sm text-red-600">{error}</p>}
        {view === "conto" ? (
          <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-3">
            {contiOn && conto && conto.ids.length > 0 && (
              <button
                onClick={doEstingui}
                disabled={estinguendo}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {estinguendo ? "Chiusura…" : "Estingui conto"}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-5 py-3">
            <span className="text-sm text-neutral-500">
              {lineCount} {lineCount === 1 ? "prodotto" : "prodotti"} · ~{formatEUR(estimateCents)}
            </span>
            <button
              onClick={submit}
              disabled={submitting || !lineCount}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {submitting ? "Creazione…" : "Crea ordine"}
            </button>
          </div>
        )}

        {confirming && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setConfirming(false)}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold">Confermi l&apos;ordine?</h3>
              <p className="mt-1 text-sm text-neutral-500">
                Tavolo {tavolo.trim() || "—"}
                {sala.trim() ? ` · ${sala.trim()}` : ""}
              </p>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
                {Object.entries(cart).map(([id, q]) => (
                  <li key={id} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-medium">{q}×</span> {byId.get(id)?.nome ?? id}
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      {formatEUR(Math.round((byId.get(id)?.prezzo ?? 0) * 100) * q)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-neutral-200 pt-2 text-sm font-semibold">
                <span>Totale stimato</span>
                <span>~{formatEUR(estimateCents)}</span>
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={() => void doCreate()}
                  disabled={submitting}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {submitting ? "Invio…" : "Conferma e invia"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
