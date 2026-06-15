"use client";

import { useState, useTransition } from "react";
import type { PublicIngredient } from "@/types/db";

type IngredientInput = {
  id?: string;
  nome?: string;
  prezzo?: number;
  scorta?: number | null;
  unita?: string | null;
};

/** CRUD for the per-restaurant ingredient list with shared stock. */
export default function IngredientiEditor({
  value,
  upsert,
  remove,
}: {
  value: PublicIngredient[];
  upsert: (input: IngredientInput) => Promise<PublicIngredient>;
  remove: (id: string) => Promise<void>;
}) {
  const [list, setList] = useState<PublicIngredient[]>(value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patchLocal(id: string, p: Partial<PublicIngredient>) {
    setList((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function save(input: IngredientInput) {
    setError(null);
    startTransition(async () => {
      try {
        const saved = await upsert(input);
        setList((l) => {
          const i = l.findIndex((x) => x.id === saved.id);
          if (i < 0) return [...l, saved];
          const next = [...l];
          next[i] = saved;
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore.");
      }
    });
  }
  function del(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await remove(id);
        setList((l) => l.filter((x) => x.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore.");
      }
    });
  }

  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <div className="hidden gap-2 px-1 text-xs text-neutral-400 sm:flex">
          <span className="flex-1">Nome</span>
          <span className="w-20">Prezzo €</span>
          <span className="w-20">Scorta</span>
          <span className="w-24">Unità</span>
          <span className="w-14" />
        </div>
      )}
      {list.map((ing) => (
        <div key={ing.id} className="flex flex-wrap items-center gap-2">
          <input
            value={ing.nome}
            onChange={(e) => patchLocal(ing.id, { nome: e.target.value })}
            onBlur={() =>
              save({ id: ing.id, nome: ing.nome, prezzo: ing.prezzo, scorta: ing.scorta, unita: ing.unita })
            }
            placeholder="Nome"
            className="min-w-40 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
          />
          <input
            type="number"
            step="0.5"
            min="0"
            value={ing.prezzo}
            onChange={(e) => patchLocal(ing.id, { prezzo: parseFloat(e.target.value) || 0 })}
            onBlur={() =>
              save({ id: ing.id, nome: ing.nome, prezzo: ing.prezzo, scorta: ing.scorta, unita: ing.unita })
            }
            className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            type="number"
            min="0"
            placeholder="∞"
            value={ing.scorta ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              patchLocal(ing.id, { scorta: raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0) });
            }}
            onBlur={() =>
              save({ id: ing.id, nome: ing.nome, prezzo: ing.prezzo, scorta: ing.scorta, unita: ing.unita })
            }
            title="Scorta condivisa (vuoto = illimitata)"
            className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            value={ing.unita ?? ""}
            onChange={(e) => patchLocal(ing.id, { unita: e.target.value })}
            onBlur={() =>
              save({ id: ing.id, nome: ing.nome, prezzo: ing.prezzo, scorta: ing.scorta, unita: ing.unita })
            }
            placeholder="porzione"
            className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            onClick={() => del(ing.id)}
            disabled={pending}
            className="w-14 text-xs text-red-500 hover:underline disabled:opacity-50"
          >
            Elimina
          </button>
        </div>
      ))}
      <button
        onClick={() => save({ nome: "Nuovo ingrediente", prezzo: 0, scorta: null })}
        disabled={pending}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
      >
        + Aggiungi ingrediente
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
