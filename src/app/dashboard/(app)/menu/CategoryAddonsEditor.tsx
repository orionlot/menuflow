"use client";

import { useState } from "react";
import type { CategoryAddon } from "@/types/db";

/** Editor for category-scoped add-on groups (es. "Patatine" su tutte le Pizze). */
export default function CategoryAddonsEditor({
  value,
  categories,
  onSave,
}: {
  value: CategoryAddon[];
  categories: string[];
  onSave: (groups: CategoryAddon[]) => void;
}) {
  const [groups, setGroups] = useState<CategoryAddon[]>(value ?? []);

  function commit(next: CategoryAddon[]) {
    setGroups(next);
    onSave(next);
  }
  function update(gi: number, patch: Partial<CategoryAddon>, save = true) {
    const next = groups.map((g, i) => (i === gi ? { ...g, ...patch } : g));
    if (save) commit(next);
    else setGroups(next);
  }
  function addGroup() {
    commit([
      ...groups,
      {
        id: Math.random().toString(36).slice(2, 8),
        nome: "Aggiunte",
        tipo: "multi",
        obbligatorio: false,
        categorie: [],
        scelte: [{ nome: "", prezzo: 0 }],
      },
    ]);
  }
  function toggleCat(gi: number, cat: string) {
    const cur = groups[gi].categorie;
    update(gi, {
      categorie: cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat],
    });
  }
  function updateChoice(gi: number, ci: number, patch: Partial<{ nome: string; prezzo: number }>, save = true) {
    update(gi, { scelte: groups[gi].scelte.map((s, i) => (i === ci ? { ...s, ...patch } : s)) }, save);
  }

  return (
    <div className="space-y-3">
      {groups.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nessuna aggiunta. Crea un gruppo (es. &ldquo;Extra&rdquo;) e assegnalo a una o
          più categorie: comparirà su tutti i prodotti di quelle categorie.
        </p>
      )}
      {groups.map((g, gi) => (
        <div key={g.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              defaultValue={g.nome}
              onBlur={(e) => update(gi, { nome: e.target.value })}
              placeholder="Nome gruppo (es. Aggiunte)"
              className="min-w-40 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
            />
            <select
              value={g.tipo}
              onChange={(e) => update(gi, { tipo: e.target.value as "single" | "multi" })}
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              <option value="multi">Scelta multipla</option>
              <option value="single">Scelta singola</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={g.obbligatorio}
                onChange={(e) => update(gi, { obbligatorio: e.target.checked })}
              />
              obbligatorio
            </label>
            <button onClick={() => commit(groups.filter((_, i) => i !== gi))} className="ml-auto text-xs text-red-500 hover:underline">
              rimuovi
            </button>
          </div>

          {/* Categorie a cui si applica */}
          <div className="mt-2">
            <div className="mb-1 text-[11px] text-neutral-400">Si applica alle categorie:</div>
            {categories.length === 0 ? (
              <p className="text-xs text-neutral-400">Crea prima qualche categoria di prodotto.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = g.categorie.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCat(gi, c)}
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

          {/* Voci */}
          <div className="mt-2 space-y-1.5">
            {g.scelte.map((s, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <input
                  defaultValue={s.nome}
                  onBlur={(e) => updateChoice(gi, ci, { nome: e.target.value })}
                  placeholder="es. Patatine fritte"
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-neutral-400">+€</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  defaultValue={s.prezzo}
                  onBlur={(e) => updateChoice(gi, ci, { prezzo: parseFloat(e.target.value) || 0 })}
                  className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                <button
                  onClick={() => update(gi, { scelte: g.scelte.filter((_, i) => i !== ci) })}
                  className="text-neutral-400 hover:text-red-500"
                  aria-label="rimuovi"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => update(gi, { scelte: [...g.scelte, { nome: "", prezzo: 0 }] })}
              className="text-xs text-blue-600 hover:underline"
            >
              + aggiungi voce
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={addGroup}
        className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        + nuovo gruppo di aggiunte
      </button>
    </div>
  );
}
