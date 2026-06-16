"use client";

import { useState } from "react";
import type { NoteConfig } from "@/types/db";

/** Editor for category-scoped customer notes (es. "Note di cottura" su tutte le
 *  Pizze). A free-text note field appears on every product of the chosen
 *  categories. Per-product overrides live in the product drawer. */
export default function NotesEditor({
  value,
  categories,
  onSave,
}: {
  value: NoteConfig[];
  categories: string[];
  onSave: (rows: NoteConfig[]) => void;
}) {
  const [rows, setRows] = useState<NoteConfig[]>(value ?? []);

  function commit(next: NoteConfig[]) {
    setRows(next);
    onSave(next);
  }
  function update(i: number, patch: Partial<NoteConfig>, save = true) {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    if (save) commit(next);
    else setRows(next);
  }
  function addRow() {
    commit([...rows, { id: Math.random().toString(36).slice(2, 8), categorie: [], label: "Nota" }]);
  }
  function toggleCat(i: number, cat: string) {
    const cur = rows[i].categorie;
    update(i, {
      categorie: cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat],
    });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nessuna nota. Crea una regola e assegnala a una o più categorie: un campo nota
          comparirà su tutti i prodotti di quelle categorie quando il cliente ordina.
        </p>
      )}
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={r.label ?? ""}
              onChange={(e) => update(i, { label: e.target.value }, false)}
              onBlur={() => commit(rows)}
              placeholder="Etichetta (es. Note di cottura)"
              className="min-w-40 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
            />
            <label className="flex items-center gap-1 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={Boolean(r.obbligatoria)}
                onChange={(e) => update(i, { obbligatoria: e.target.checked })}
              />
              obbligatoria
            </label>
            <button
              onClick={() => commit(rows.filter((_, j) => j !== i))}
              className="ml-auto text-xs text-red-500 hover:underline"
            >
              rimuovi
            </button>
          </div>
          <div className="mt-2">
            <div className="mb-1 text-[11px] text-neutral-400">Si applica alle categorie:</div>
            {categories.length === 0 ? (
              <p className="text-xs text-neutral-400">Crea prima qualche categoria di prodotto.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = r.categorie.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCat(i, c)}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        on ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-300"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={addRow}
        className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        + nuova nota per categoria
      </button>
    </div>
  );
}
