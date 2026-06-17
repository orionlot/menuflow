"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ComposizioneGruppo, PublicIngredient, TagliaComposizione } from "@/types/db";
import ComposizioneEditor from "../menu/ComposizioneEditor";
import TaglieEditor from "../menu/TaglieEditor";
import IngredientsTable from "./IngredientsTable";

type IngredientInput = {
  id?: string;
  nome?: string;
  nome_i18n?: Record<string, string>;
  categoria?: string;
  prezzo?: number;
  scorta?: number | null;
  unita?: string | null;
  ordine?: number;
};

/** "Ingredienti & inventario" — table of ingredients (left) + composition /
 *  size panels (right), all for composable products. */
export default function InventoryManager({
  initialIngredienti,
  initialComposizione,
  initialTaglie,
  categories,
  otherLangs = [],
  actions,
}: {
  initialIngredienti: PublicIngredient[];
  initialComposizione: ComposizioneGruppo[];
  initialTaglie: TagliaComposizione[];
  categories: string[];
  otherLangs?: string[];
  actions: {
    upsertIngredient: (input: IngredientInput) => Promise<PublicIngredient>;
    deleteIngredient: (id: string) => Promise<void>;
    updateComposizione: (groups: ComposizioneGruppo[]) => Promise<void>;
    updateTaglie: (taglie: TagliaComposizione[]) => Promise<void>;
  };
}) {
  const router = useRouter();
  const [ingredienti, setIngredienti] = useState(initialIngredienti);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore.");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Inventario</h1>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-6">
        <IngredientsTable
          value={ingredienti}
          otherLangs={otherLangs}
          upsert={actions.upsertIngredient}
          remove={actions.deleteIngredient}
          onListChange={setIngredienti}
        />

        <div className="space-y-4">
          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="font-medium">Composizioni</h2>
            <p className="mb-3 mt-1 text-sm text-neutral-500">
              Per categoria (es. &ldquo;Poke&rdquo;): i gruppi tra cui il cliente compone il
              piatto.
            </p>
            <ComposizioneEditor
              value={initialComposizione}
              ingredienti={ingredienti}
              categories={categories}
              onSave={(g) => run(() => actions.updateComposizione(g))}
            />
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="font-medium">Taglie / formati</h2>
            <p className="mb-3 mt-1 text-sm text-neutral-500">
              Formati (es. Medium, Large): ogni taglia regola il massimo di scelte per gruppo.
            </p>
            <TaglieEditor
              value={initialTaglie}
              gruppi={initialComposizione}
              categories={categories}
              onSave={(t) => run(() => actions.updateTaglie(t))}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
