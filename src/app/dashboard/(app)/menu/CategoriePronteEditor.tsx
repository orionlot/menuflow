"use client";

import { useState } from "react";

/** Categories whose items skip the kitchen prep queue and land directly in
 *  "Pronti da servire" in the KDS the moment the order arrives — e.g. Acqua,
 *  Bibite, Vini. The cook never has to mark them ready. */
export default function CategoriePronteEditor({
  value,
  categories,
  onSave,
}: {
  value: string[];
  categories: string[];
  onSave: (v: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(value));

  function toggle(cat: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      onSave([...next]);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Categorie pronte da servire</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-500">
        Le voci di queste categorie (es. Acqua, Bibite, Vini) non passano dalla cucina: appena
        l&apos;ordine arriva finiscono già nello stato &ldquo;Pronti da servire&rdquo;. Il cuoco non deve
        prepararle. Le voci &ldquo;a seguire&rdquo; restano comunque in attesa.
      </p>
      {categories.length === 0 ? (
        <p className="text-sm text-neutral-500">Nessuna categoria: aggiungi prima dei piatti.</p>
      ) : (
        <ul className="space-y-1.5">
          {categories.map((cat) => (
            <li key={cat}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={selected.has(cat)}
                  onChange={() => toggle(cat)}
                  className="h-4 w-4 cursor-pointer accent-brand"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{cat}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
