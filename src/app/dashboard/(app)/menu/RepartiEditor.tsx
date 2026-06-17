"use client";

import { useState } from "react";
import type { Reparto } from "@/types/db";

const DEFAULT_COLORS = ["#f59e0b", "#ef4444", "#eab308", "#a855f7", "#ec4899", "#3b82f6", "#10b981", "#64748b"];

/** Manage the kitchen departments (reparti). Each reparto has a name + colour and
 *  is assignable to dishes; the Kitchen Display filters and colour-codes by it.
 *  Ids are assigned/kept server-side (dishes reference reparti by id). */
export default function RepartiEditor({
  value,
  onSave,
}: {
  value: Reparto[];
  onSave: (reparti: Reparto[]) => void;
}) {
  const [reparti, setReparti] = useState<Reparto[]>(value ?? []);
  const [draft, setDraft] = useState("");

  function commit(next: Reparto[]) {
    setReparti(next);
    onSave(next);
  }
  function add() {
    const nome = draft.trim();
    if (!nome) return;
    const colore = DEFAULT_COLORS[reparti.length % DEFAULT_COLORS.length];
    // Empty id → the server slugifies the name into a stable id.
    commit([...reparti, { id: "", nome, colore }]);
    setDraft("");
  }
  function patch(i: number, p: Partial<Reparto>) {
    commit(reparti.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  }
  function remove(i: number) {
    commit(reparti.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Reparti cucina</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-500">
        Le postazioni di lavoro (es. Cucina, Pizzeria, Friggitoria). Assegna un reparto ai piatti
        dalla loro scheda; nella schermata Cucina potrai filtrare e riconoscere gli ordini per
        colore.
      </p>

      {reparti.length === 0 ? (
        <p className="text-sm text-neutral-400">Nessun reparto. Aggiungine uno qui sotto.</p>
      ) : (
        <ul className="space-y-2">
          {reparti.map((r, i) => (
            <li key={`${r.id}-${i}`} className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(r.colore ?? "") ? r.colore : "#64748b"}
                onChange={(e) => patch(i, { colore: e.target.value })}
                aria-label={`Colore ${r.nome}`}
                className="h-9 w-10 shrink-0 cursor-pointer rounded border border-neutral-300 bg-white p-0.5"
              />
              <input
                value={r.nome}
                onChange={(e) => patch(i, { nome: e.target.value })}
                maxLength={40}
                aria-label="Nome reparto"
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <span
                className="flex shrink-0 items-center gap-1"
                title="Quanti piatti questa postazione prepara in contemporanea (stima d'attesa cliente)"
              >
                <input
                  type="number"
                  min="1"
                  max="50"
                  inputMode="numeric"
                  value={r.capienza ?? ""}
                  placeholder="1"
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    patch(i, { capienza: Number.isFinite(n) && n > 0 ? Math.min(50, n) : undefined });
                  }}
                  aria-label={`Capienza ${r.nome} (piatti in contemporanea)`}
                  className="w-14 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-neutral-400">in cont.</span>
              </span>
              <button
                onClick={() => remove(i)}
                aria-label={`Rimuovi ${r.nome}`}
                className="cursor-pointer rounded-md px-2 py-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nuovo reparto"
          maxLength={40}
          className="w-56 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          + Aggiungi reparto
        </button>
      </div>
    </div>
  );
}
