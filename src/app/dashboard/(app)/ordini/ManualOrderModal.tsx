"use client";

import { useMemo, useState } from "react";
import { formatEUR } from "@/lib/config/plans";
import type { PickerItem } from "./OrdiniClient";

type Tipo = "tavolo" | "asporto" | "delivery";

export default function ManualOrderModal({
  items,
  asportoOn,
  deliveryOn,
  copertoModalita,
  initialTavolo,
  onClose,
  onCreate,
}: {
  items: PickerItem[];
  asportoOn: boolean;
  deliveryOn: boolean;
  copertoModalita: string;
  initialTavolo?: string;
  onClose: () => void;
  onCreate: (input: {
    tavolo: string;
    tipo: Tipo;
    sala?: string;
    indirizzo?: string;
    coperti?: number;
    note?: string;
    items: { item_id: string; qta: number }[];
  }) => Promise<void>;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tipo, setTipo] = useState<Tipo>("tavolo");
  const [tavolo, setTavolo] = useState(initialTavolo ?? "");
  const [sala, setSala] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [coperti, setCoperti] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function submit() {
    setError(null);
    if (!lineCount) {
      setError("Aggiungi almeno un prodotto.");
      return;
    }
    if (!tavolo.trim()) {
      setError(tipo === "tavolo" ? "Inserisci il tavolo." : "Inserisci il nome.");
      return;
    }
    if (tipo === "delivery" && !indirizzo.trim()) {
      setError("Inserisci l'indirizzo di consegna.");
      return;
    }
    if (tipo === "tavolo" && copertoModalita === "persona" && !coperti) {
      setError("Indica il numero di coperti.");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        tavolo: tavolo.trim(),
        tipo,
        sala: sala.trim() || undefined,
        indirizzo: tipo === "delivery" ? indirizzo.trim() : undefined,
        coperti: coperti || undefined,
        note: note.trim() || undefined,
        items: Object.entries(cart).map(([item_id, qta]) => ({ item_id, qta })),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nella creazione.");
      setSubmitting(false);
    }
  }

  const tipoOptions: { id: Tipo; label: string }[] = [
    { id: "tavolo", label: "Tavolo" },
    ...(asportoOn ? ([{ id: "asporto", label: "Asporto" }] as const) : []),
    ...(deliveryOn ? ([{ id: "delivery", label: "Delivery" }] as const) : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-lg font-bold">Nuovo ordine</h2>
          <button onClick={onClose} aria-label="Chiudi" className="text-2xl leading-none text-neutral-400 hover:text-neutral-700">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Destination */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tipoOptions.map((t) => (
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

          {/* Item picker */}
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">{cat}</p>
                <ul className="space-y-1">
                  {items
                    .filter((i) => i.categoria === cat)
                    .map((i) => {
                      const q = cart[i.id] ?? 0;
                      return (
                        <li key={i.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">{i.nome}</span>
                          <span className="shrink-0 text-sm text-neutral-500">
                            {formatEUR(Math.round(i.prezzo * 100))}
                          </span>
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
            ))}
            {items.length === 0 && (
              <p className="text-sm text-neutral-500">Nessun prodotto disponibile.</p>
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
        </div>

        {error && <p className="px-5 text-sm text-red-600">{error}</p>}
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
      </div>
    </div>
  );
}
