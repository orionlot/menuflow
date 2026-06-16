"use client";

import { useState } from "react";

/** Manage the reusable dish-label catalog (plain names). Labels are then
 *  toggled per dish in the product detail panel and shown on the public menu. */
export default function EtichetteEditor({
  value,
  onSave,
}: {
  value: string[];
  onSave: (etichette: string[]) => void;
}) {
  const [labels, setLabels] = useState<string[]>(value ?? []);
  const [draft, setDraft] = useState("");

  function commit(next: string[]) {
    setLabels(next);
    onSave(next);
  }
  function add() {
    const v = draft.trim();
    if (v && !labels.some((l) => l.toLowerCase() === v.toLowerCase())) commit([...labels, v]);
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Etichette</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-500">
        Tag riutilizzabili (es. Vegetariano, Piccante, Senza lattosio). Assegnali ai piatti dalla
        loro scheda; compaiono sul menu pubblico.
      </p>
      {labels.length === 0 ? (
        <p className="text-sm text-neutral-400">Nessuna etichetta. Aggiungine una qui sotto.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-medium text-brand"
            >
              {l}
              <button
                onClick={() => commit(labels.filter((x) => x !== l))}
                aria-label={`Rimuovi ${l}`}
                className="text-brand/70 hover:text-brand"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nuova etichetta"
          maxLength={30}
          className="w-48 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={add}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          + Aggiungi
        </button>
      </div>
    </div>
  );
}
