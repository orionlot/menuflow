"use client";

import { useState } from "react";
import type { ItemOption } from "@/types/db";

/** Compact editor for option groups (varianti/extra) on a menu item. */
export default function OptionsEditor({
  value,
  onSave,
}: {
  value: ItemOption[];
  onSave: (groups: ItemOption[]) => void;
}) {
  const [groups, setGroups] = useState<ItemOption[]>(value ?? []);

  function commit(next: ItemOption[]) {
    setGroups(next);
    onSave(next);
  }
  function update(gi: number, patch: Partial<ItemOption>, save = true) {
    const next = groups.map((g, i) => (i === gi ? { ...g, ...patch } : g));
    if (save) commit(next);
    else setGroups(next);
  }
  function addGroup() {
    commit([
      ...groups,
      {
        id: Math.random().toString(36).slice(2, 8),
        nome: "Nuovo gruppo",
        tipo: "single",
        obbligatorio: false,
        scelte: [{ nome: "Opzione", prezzo: 0 }],
      },
    ]);
  }
  function removeGroup(gi: number) {
    commit(groups.filter((_, i) => i !== gi));
  }
  function updateChoice(gi: number, ci: number, patch: Partial<{ nome: string; prezzo: number }>, save = true) {
    const g = groups[gi];
    const scelte = g.scelte.map((s, i) => (i === ci ? { ...s, ...patch } : s));
    update(gi, { scelte }, save);
  }
  function addChoice(gi: number) {
    update(gi, { scelte: [...groups[gi].scelte, { nome: "", prezzo: 0 }] });
  }
  function removeChoice(gi: number, ci: number) {
    update(gi, { scelte: groups[gi].scelte.filter((_, i) => i !== ci) });
  }

  return (
    <div className="space-y-3">
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
              <option value="single">Scelta singola</option>
              <option value="multi">Scelta multipla</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={g.obbligatorio}
                onChange={(e) => update(gi, { obbligatorio: e.target.checked })}
              />
              obbligatorio
            </label>
            <button
              onClick={() => removeGroup(gi)}
              className="ml-auto text-xs text-red-500 hover:underline"
            >
              rimuovi gruppo
            </button>
          </div>

          <div className="mt-2 space-y-1.5">
            {g.scelte.map((s, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <input
                  defaultValue={s.nome}
                  onBlur={(e) => updateChoice(gi, ci, { nome: e.target.value })}
                  placeholder="Scelta"
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-neutral-400">+€</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={s.prezzo}
                    onBlur={(e) =>
                      updateChoice(gi, ci, { prezzo: parseFloat(e.target.value) || 0 })
                    }
                    className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={() => removeChoice(gi, ci)}
                  className="text-neutral-400 hover:text-red-500"
                  aria-label="rimuovi"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => addChoice(gi)}
              className="text-xs text-blue-600 hover:underline"
            >
              + aggiungi scelta
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={addGroup}
        className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        + aggiungi gruppo opzioni
      </button>
    </div>
  );
}
