"use client";

import { useRef, useState, useTransition } from "react";
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
import type { PublicIngredient } from "@/types/db";
import { DragHandle, MoveButtons, SaveBadge, useSortableRow, type SaveState } from "./sortable";

type IngredientInput = {
  id?: string;
  nome?: string;
  prezzo?: number;
  scorta?: number | null;
  unita?: string | null;
  ordine?: number;
};

/** CRUD + drag-reorder for the per-restaurant ingredient list with shared stock. */
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
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function patchLocal(id: string, p: Partial<PublicIngredient>) {
    setList((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function flashSaved(id: string) {
    setStatus((s) => ({ ...s, [id]: "saved" }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      setStatus((s) => {
        if (s[id] !== "saved") return s;
        const next = { ...s };
        delete next[id];
        return next;
      });
    }, 2000);
  }

  function save(input: IngredientInput) {
    setError(null);
    if (input.id) setStatus((s) => ({ ...s, [input.id!]: "saving" }));
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
        flashSaved(saved.id);
      } catch (e) {
        if (input.id) setStatus((s) => ({ ...s, [input.id!]: "error" }));
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

  /** Reorder: renumber `ordine`, optimistic, then persist only the moved rows. */
  function move(oldIndex: number, newIndex: number) {
    if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0 || newIndex >= list.length) return;
    const prevOrder = new Map(list.map((x) => [x.id, x.ordine]));
    const reordered = arrayMove(list, oldIndex, newIndex).map((x, idx) => ({ ...x, ordine: idx + 1 }));
    setList(reordered);
    setError(null);
    const changed = reordered.filter((x) => prevOrder.get(x.id) !== x.ordine);
    startTransition(async () => {
      try {
        await Promise.all(
          changed.map((x) =>
            upsert({ id: x.id, nome: x.nome, prezzo: x.prezzo, scorta: x.scorta, unita: x.unita, ordine: x.ordine }),
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore nel riordino.");
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    move(
      list.findIndex((x) => x.id === active.id),
      list.findIndex((x) => x.id === over.id),
    );
  }

  function addIngredient() {
    save({ nome: "Nuovo ingrediente", prezzo: 0, scorta: null, ordine: list.length + 1 });
  }

  return (
    <div className="space-y-2">
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">Nessun ingrediente</p>
          <p className="mt-1 text-sm text-neutral-500">
            Aggiungi gli ingredienti che il cliente potrà scegliere nei piatti componibili (es.
            Salmone, Avocado, Riso).
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-neutral-400">
            Trascina la maniglia ⠿ per riordinare, oppure usa ↑ ↓.
          </p>
          <DndContext id="ing-list" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {list.map((ing, idx) => (
                  <IngredientCard
                    key={ing.id}
                    ing={ing}
                    index={idx}
                    count={list.length}
                    st={status[ing.id]}
                    onPatch={(p) => patchLocal(ing.id, p)}
                    onSave={() =>
                      save({
                        id: ing.id,
                        nome: ing.nome,
                        prezzo: ing.prezzo,
                        scorta: ing.scorta,
                        unita: ing.unita,
                        ordine: ing.ordine,
                      })
                    }
                    onMove={(d) => move(idx, idx + d)}
                    onDelete={() => del(ing.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      <button
        onClick={addIngredient}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
      >
        + Aggiungi ingrediente
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function IngredientCard({
  ing,
  index,
  count,
  st,
  onPatch,
  onSave,
  onMove,
  onDelete,
}: {
  ing: PublicIngredient;
  index: number;
  count: number;
  st?: SaveState;
  onPatch: (p: Partial<PublicIngredient>) => void;
  onSave: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, style, handleProps } = useSortableRow(ing.id);
  const [confirming, setConfirming] = useState(false);
  const sold = ing.scorta === 0;
  const incluso = (ing.prezzo ?? 0) === 0;

  return (
    <li ref={setNodeRef} style={style} className="rounded-xl border border-neutral-200 bg-white p-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center self-center">
          <DragHandle {...handleProps} />
          <MoveButtons
            onUp={() => onMove(-1)}
            onDown={() => onMove(1)}
            isFirst={index === 0}
            isLast={index === count - 1}
          />
        </div>

        <label className="block min-w-40 flex-1">
          <span className="mb-1 block text-[11px] text-neutral-500">Nome</span>
          <input
            value={ing.nome}
            onChange={(e) => onPatch({ nome: e.target.value })}
            onBlur={onSave}
            placeholder="Nome"
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
          />
        </label>

        <label className="block w-24">
          <span className="mb-1 block text-[11px] text-neutral-500">Prezzo</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400">
              €
            </span>
            <input
              type="number"
              step="0.5"
              min="0"
              value={ing.prezzo}
              onChange={(e) => onPatch({ prezzo: parseFloat(e.target.value) || 0 })}
              onBlur={onSave}
              className="w-full rounded-md border border-neutral-300 py-1 pl-6 pr-2 text-sm"
            />
          </span>
          <span className="mt-0.5 block text-[11px] text-neutral-400">0 € = incluso</span>
        </label>

        <label className="block w-24">
          <span className="mb-1 block text-[11px] text-neutral-500">Scorta</span>
          <input
            type="number"
            min="0"
            placeholder="∞"
            value={ing.scorta ?? ""}
            aria-invalid={sold}
            onChange={(e) => {
              const raw = e.target.value.trim();
              onPatch({ scorta: raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0) });
            }}
            onBlur={onSave}
            className={`w-full rounded-md border px-2 py-1 text-sm ${
              sold ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-300"
            }`}
          />
          <span className="mt-0.5 block text-[11px] text-neutral-400">
            Vuoto = illimitata · 0 = esaurito
          </span>
        </label>

        <label className="block w-24">
          <span className="mb-1 block text-[11px] text-neutral-500">Unità</span>
          <input
            value={ing.unita ?? ""}
            onChange={(e) => onPatch({ unita: e.target.value })}
            onBlur={onSave}
            placeholder="porzione"
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
        </label>

        <div className="flex items-center gap-1.5 self-center pb-1">
          {incluso && (
            <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-brand">
              Incluso
            </span>
          )}
          {sold && (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
              Esaurito
            </span>
          )}
          <SaveBadge st={st} />
          {confirming ? (
            <span className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
                className="font-medium text-red-600"
              >
                Sì, elimina
              </button>
              <button onClick={() => setConfirming(false)} className="text-neutral-500">
                Annulla
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              aria-label="Elimina ingrediente"
              className="shrink-0 rounded-md px-2 py-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
            >
              🗑
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
