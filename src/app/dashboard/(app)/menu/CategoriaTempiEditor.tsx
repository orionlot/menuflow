"use client";

import { useState } from "react";

/** Per-category average prep time (minutes). Used as the KDS / wait-time estimate
 *  fallback when a dish has no tempo_preparazione of its own. */
export default function CategoriaTempiEditor({
  value,
  categories,
  capienzaDefault,
  onSave,
  onSaveCapienza,
}: {
  value: Record<string, number>;
  categories: string[];
  capienzaDefault?: number | null;
  onSave: (v: Record<string, number>) => void;
  onSaveCapienza?: (n: number | null) => void;
}) {
  const [tempi, setTempi] = useState<Record<string, number>>(value);
  const [capienza, setCapienza] = useState<number | "">(capienzaDefault ?? "");

  function setCat(cat: string, raw: string) {
    const n = Math.max(0, Math.min(600, Math.floor(Number(raw) || 0)));
    setTempi((prev) => {
      const next = { ...prev };
      if (n > 0) next[cat] = n;
      else delete next[cat];
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Tempo medio di preparazione per categoria</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-500">
        Minuti stimati per categoria (es. Antipasti 10&apos;). Vale quando un piatto non ha un suo
        tempo: in quel caso la cucina usa questa media. Se né il piatto né la categoria hanno un
        tempo, la stima viene segnalata come approssimativa.
      </p>
      {onSaveCapienza && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2">
          <span className="min-w-0 text-sm">
            <span className="font-medium">Capienza cucina</span>
            <span className="block text-xs text-neutral-500">
              Piatti preparati in contemporanea (es. forni). Riduce l&apos;attesa stimata: oltre questo
              numero gli ordini fanno coda. Per le singole postazioni usa la capienza nei Reparti.
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="50"
              inputMode="numeric"
              value={capienza}
              placeholder="1"
              onChange={(e) => setCapienza(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value, 10) || 1))}
              onBlur={() => onSaveCapienza(capienza === "" ? null : Number(capienza))}
              aria-label="Capienza cucina (piatti in contemporanea)"
              className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-neutral-500">in cont.</span>
          </div>
        </div>
      )}
      {categories.length === 0 ? (
        <p className="text-sm text-neutral-500">Nessuna categoria: aggiungi prima dei piatti.</p>
      ) : (
        <ul className="space-y-2">
          {categories.map((cat) => (
            <li key={cat} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-sm">{cat}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="600"
                  inputMode="numeric"
                  value={tempi[cat] ?? ""}
                  placeholder="—"
                  onChange={(e) => setCat(cat, e.target.value)}
                  onBlur={() => onSave(tempi)}
                  aria-label={`Tempo medio ${cat} (minuti)`}
                  className="w-20 rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                />
                <span className="text-xs text-neutral-500">min</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
