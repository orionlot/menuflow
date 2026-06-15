"use client";

import { useState } from "react";
import type { ComposizioneGruppo, PublicIngredient } from "@/types/db";

/** Per-category composition groups: pick categories, min/max, and ingredients. */
export default function ComposizioneEditor({
  value,
  ingredienti,
  categories,
  onSave,
}: {
  value: ComposizioneGruppo[];
  ingredienti: PublicIngredient[];
  categories: string[];
  onSave: (groups: ComposizioneGruppo[]) => void;
}) {
  const [groups, setGroups] = useState<ComposizioneGruppo[]>(value);

  function commit(next: ComposizioneGruppo[]) {
    setGroups(next);
    onSave(next);
  }
  function update(gi: number, patch: Partial<ComposizioneGruppo>) {
    commit(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  }
  function addGroup() {
    commit([
      ...groups,
      { id: crypto.randomUUID(), nome: "Nuovo gruppo", categorie: [], min: 0, max: 3, ingredienti: [] },
    ]);
  }
  function removeGroup(gi: number) {
    commit(groups.filter((_, i) => i !== gi));
  }
  function toggleCat(gi: number, cat: string) {
    const g = groups[gi];
    const has = g.categorie.includes(cat);
    update(gi, {
      categorie: has ? g.categorie.filter((c) => c !== cat) : [...g.categorie, cat],
    });
  }
  function toggleIngrediente(gi: number, id: string) {
    const g = groups[gi];
    const has = g.ingredienti.some((s) => s.ingredient_id === id);
    update(gi, {
      ingredienti: has
        ? g.ingredienti.filter((s) => s.ingredient_id !== id)
        : [...g.ingredienti, { ingredient_id: id }],
    });
  }

  if (!ingredienti.length)
    return (
      <p className="text-sm text-neutral-500">
        Aggiungi prima qualche ingrediente qui sopra, poi crea i gruppi di composizione.
      </p>
    );

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <div key={g.id} className="rounded-lg border border-neutral-200 p-3">
          <div className="flex items-center gap-2">
            <input
              value={g.nome}
              onChange={(e) => update(gi, { nome: e.target.value })}
              placeholder="Nome gruppo (es. Proteine)"
              className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
            />
            <button
              onClick={() => removeGroup(gi)}
              className="text-xs text-red-500 hover:underline"
            >
              Rimuovi
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <span className="text-xs text-neutral-500">min</span>
              <input
                type="number"
                min="0"
                value={g.min}
                onChange={(e) => update(gi, { min: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="w-16 rounded-md border border-neutral-300 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-xs text-neutral-500">max</span>
              <input
                type="number"
                min="1"
                value={g.max}
                onChange={(e) => update(gi, { max: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-16 rounded-md border border-neutral-300 px-2 py-1"
              />
            </label>
          </div>

          <div className="mt-2 text-[13px] font-medium text-neutral-700">Categorie</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const on = g.categorie.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCat(gi, cat)}
                  aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    on ? "bg-[var(--brand-soft)] text-brand" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-[13px] font-medium text-neutral-700">Ingredienti</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ingredienti.map((ing) => {
              const on = g.ingredienti.some((s) => s.ingredient_id === ing.id);
              return (
                <button
                  key={ing.id}
                  onClick={() => toggleIngrediente(gi, ing.id)}
                  aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    on ? "bg-amber-500 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {ing.nome}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        onClick={addGroup}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
      >
        + Aggiungi gruppo
      </button>
    </div>
  );
}
