"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ComposizioneGruppo, TagliaComposizione } from "@/types/db";
import { DragHandle, MoveButtons, useSortableRow } from "./sortable";

/** Size variants (Medium / Large …) for composable categories. Each size caps
 *  the MAX selections per group; the minimum stays the group's own. */
export default function TaglieEditor({
  value,
  gruppi,
  categories,
  perItem = false,
  onSave,
}: {
  value: TagliaComposizione[];
  gruppi: ComposizioneGruppo[];
  categories: string[];
  /** Per-item mode: sizes belong to a single product, so the category picker is
   *  hidden and every passed group is a max-override candidate. */
  perItem?: boolean;
  onSave: (taglie: TagliaComposizione[]) => void;
}) {
  const [taglie, setTaglie] = useState<TagliaComposizione[]>(value);
  const ref = useRef(taglie);
  ref.current = taglie;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function apply(next: TagliaComposizione[], persist: boolean) {
    setTaglie(next);
    ref.current = next;
    if (persist) onSave(next);
  }
  function update(ti: number, patch: Partial<TagliaComposizione>, persist = true) {
    apply(
      taglie.map((t, i) => (i === ti ? { ...t, ...patch } : t)),
      persist,
    );
  }
  const persist = () => onSave(ref.current);
  function addTaglia() {
    apply([...taglie, { id: crypto.randomUUID(), nome: "Nuova taglia", categorie: [], max: {}, prezzo: 0 }], true);
  }
  function removeTaglia(ti: number) {
    apply(taglie.filter((_, i) => i !== ti), true);
  }
  function move(oldIndex: number, newIndex: number) {
    if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0 || newIndex >= taglie.length) return;
    apply(arrayMove(taglie, oldIndex, newIndex), true);
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    move(
      taglie.findIndex((t) => t.id === active.id),
      taglie.findIndex((t) => t.id === over.id),
    );
  }

  if (!gruppi.length)
    return (
      <p className="text-sm text-neutral-500">
        Crea prima i gruppi di composizione qui sopra: una taglia regola quanti
        ingredienti si possono scegliere per ciascun gruppo.
      </p>
    );

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Una taglia (es. Medium, Large) imposta il <b>massimo</b> di scelte per
        gruppo (il minimo resta quello del gruppo) e può aggiungere una
        <b> maggiorazione</b> al prezzo base del prodotto.
      </p>

      {taglie.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">Nessuna taglia</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
            Aggiungi formati come «Medium» e «Large» per offrire porzioni diverse
            dello stesso piatto componibile.
          </p>
          <button
            onClick={addTaglia}
            className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            + Crea la prima taglia
          </button>
        </div>
      ) : (
        <>
          <DndContext id="taglie" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={taglie.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {taglie.map((t, ti) => (
                  <TagliaCard
                    key={t.id}
                    t={t}
                    ti={ti}
                    count={taglie.length}
                    gruppi={gruppi}
                    categories={categories}
                    perItem={perItem}
                    onUpdate={(patch, p) => update(ti, patch, p)}
                    onPersist={persist}
                    onRemove={() => removeTaglia(ti)}
                    onMove={(d) => move(ti, ti + d)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={addTaglia}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            + Aggiungi taglia
          </button>
        </>
      )}
    </div>
  );
}

function TagliaCard({
  t,
  ti,
  count,
  gruppi,
  categories,
  perItem,
  onUpdate,
  onPersist,
  onRemove,
  onMove,
}: {
  t: TagliaComposizione;
  ti: number;
  count: number;
  gruppi: ComposizioneGruppo[];
  categories: string[];
  perItem: boolean;
  onUpdate: (patch: Partial<TagliaComposizione>, persist?: boolean) => void;
  onPersist: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const { setNodeRef, style, handleProps } = useSortableRow(t.id);
  const [confirming, setConfirming] = useState(false);

  // Per-item: every group is a max-override candidate. Per-category: only groups
  // that apply to at least one of this size's categories.
  const groups = perItem
    ? gruppi
    : gruppi.filter((g) => g.categorie.some((c) => t.categorie.includes(c)));

  function toggleCat(cat: string) {
    const has = t.categorie.includes(cat);
    onUpdate({ categorie: has ? t.categorie.filter((c) => c !== cat) : [...t.categorie, cat] });
  }
  function setMax(groupId: string, v: number) {
    onUpdate({ max: { ...t.max, [groupId]: Math.max(0, v) } });
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center gap-2 border-b border-neutral-100 p-3">
        <DragHandle {...handleProps} />
        <MoveButtons onUp={() => onMove(-1)} onDown={() => onMove(1)} isFirst={ti === 0} isLast={ti === count - 1} />
        <input
          value={t.nome}
          onChange={(e) => onUpdate({ nome: e.target.value }, false)}
          onBlur={onPersist}
          placeholder="Nome taglia (es. Large)"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
        />
        <label
          className="flex shrink-0 items-center gap-1"
          title="Maggiorazione sul prezzo base del prodotto (vuoto/0 = nessun supplemento)"
        >
          <span className="text-xs text-neutral-500">+€</span>
          <input
            type="number"
            step="0.5"
            min="0"
            defaultValue={t.prezzo ?? 0}
            onBlur={(e) => {
              const v = Math.max(0, parseFloat(e.target.value) || 0);
              if (v !== (t.prezzo ?? 0)) onUpdate({ prezzo: v });
            }}
            aria-label={`Maggiorazione prezzo ${t.nome}`}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>
        {confirming ? (
          <span className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => {
                setConfirming(false);
                onRemove();
              }}
              className="font-medium text-red-600"
            >
              Sì, rimuovi
            </button>
            <button onClick={() => setConfirming(false)} className="text-neutral-500">
              Annulla
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label="Rimuovi taglia"
            className="shrink-0 rounded-md px-2 py-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            🗑
          </button>
        )}
      </div>

      {!perItem && (
        <div className="p-3">
          <div className="text-[13px] font-medium text-neutral-700">Categorie</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const on = t.categorie.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCat(cat)}
                  aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    on
                      ? "bg-[var(--brand-soft)] text-brand"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          {t.categorie.length === 0 && (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
              ⚠ Nessuna categoria: la taglia non verrà mostrata né salvata.
            </p>
          )}
        </div>
      )}

      {(perItem || t.categorie.length > 0) && (
        <div className="border-t border-neutral-100 p-3">
          <div className="text-[13px] font-medium text-neutral-700">Massimo per gruppo</div>
          {groups.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-500">
              {perItem
                ? "Crea prima i gruppi di composizione qui sopra."
                : "Nessun gruppo di composizione per queste categorie."}
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {groups.map((g) => {
                const v = t.max[g.id] ?? g.max;
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm text-neutral-700">{g.nome}</span>
                    <span className="inline-flex items-center rounded-lg border border-neutral-200">
                      <button
                        type="button"
                        aria-label={`Diminuisci ${g.nome}`}
                        onClick={() => setMax(g.id, v - 1)}
                        disabled={v <= 0}
                        className="px-2 py-1 text-neutral-500 disabled:opacity-30"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={v}
                        onChange={(e) => setMax(g.id, parseInt(e.target.value, 10) || 0)}
                        className="w-10 border-x border-neutral-200 py-1 text-center text-sm"
                      />
                      <button
                        type="button"
                        aria-label={`Aumenta ${g.nome}`}
                        onClick={() => setMax(g.id, v + 1)}
                        className="px-2 py-1 text-neutral-500"
                      >
                        +
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
