"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { DragHandle, MoveButtons, SaveBadge, useSortableRow, type SaveState } from "../menu/sortable";

type IngredientInput = {
  id?: string;
  nome?: string;
  categoria?: string;
  prezzo?: number;
  scorta?: number | null;
  unita?: string | null;
  ordine?: number;
};

const LOW_STOCK = 5;
type SortCol = "nome" | "categoria" | "scorta" | "prezzo" | "stato";

function stato(scorta: number | null) {
  if (scorta == null) return { label: "Illimitato", cls: "bg-neutral-100 text-neutral-500", rank: 3 };
  if (scorta === 0) return { label: "Esaurito", cls: "bg-red-100 text-red-700", rank: 0 };
  if (scorta <= LOW_STOCK) return { label: "Scorta bassa", cls: "bg-amber-100 text-amber-700", rank: 1 };
  return { label: "Disponibile", cls: "bg-green-100 text-green-700", rank: 2 };
}

const COLS = "grid-cols-[2.5rem_minmax(130px,1.6fr)_minmax(100px,1fr)_84px_92px_72px_120px_2.5rem]";

/** Inventory table: drag-reorder (manual) + sortable columns, inline edit, status. */
export default function IngredientsTable({
  value,
  upsert,
  remove,
  onListChange,
}: {
  value: PublicIngredient[];
  upsert: (input: IngredientInput) => Promise<PublicIngredient>;
  remove: (id: string) => Promise<void>;
  onListChange?: (list: PublicIngredient[]) => void;
}) {
  const [list, setList] = useState<PublicIngredient[]>(value);
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" } | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notify = useRef(onListChange);
  notify.current = onListChange;

  useEffect(() => {
    notify.current?.(list);
  }, [list]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const catSuggestions = [...new Set(list.map((i) => i.categoria).filter(Boolean))].sort();

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
  function payload(ing: PublicIngredient): IngredientInput {
    return {
      id: ing.id,
      nome: ing.nome,
      categoria: ing.categoria,
      prezzo: ing.prezzo,
      scorta: ing.scorta,
      unita: ing.unita,
      ordine: ing.ordine,
    };
  }
  function move(oldIndex: number, newIndex: number) {
    if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0 || newIndex >= list.length) return;
    const prev = new Map(list.map((x) => [x.id, x.ordine]));
    const reordered = arrayMove(list, oldIndex, newIndex).map((x, idx) => ({ ...x, ordine: idx + 1 }));
    setList(reordered);
    setError(null);
    const changed = reordered.filter((x) => prev.get(x.id) !== x.ordine);
    startTransition(async () => {
      try {
        await Promise.all(changed.map((x) => upsert(payload(x))));
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
  function toggleSort(col: SortCol) {
    setSort((s) => (s?.col === col ? (s.dir === "asc" ? { col, dir: "desc" } : null) : { col, dir: "asc" }));
  }

  const display = (() => {
    if (!sort) return list;
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = (i: PublicIngredient): number | string => {
      switch (sort.col) {
        case "nome":
          return i.nome.toLowerCase();
        case "categoria":
          return i.categoria.toLowerCase();
        case "scorta":
          return i.scorta == null ? Infinity : i.scorta;
        case "prezzo":
          return i.prezzo;
        case "stato":
          return stato(i.scorta).rank;
      }
    };
    return [...list].sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir;
    });
  })();
  const manual = sort === null;

  const Th = ({ col, label, className = "" }: { col: SortCol; label: string; className?: string }) => {
    const active = sort?.col === col;
    const ariaSort: React.AriaAttributes["aria-sort"] = active
      ? sort.dir === "asc"
        ? "ascending"
        : "descending"
      : "none";
    const nextAction = active
      ? sort.dir === "asc"
        ? "decrescente"
        : "ordine manuale"
      : "crescente";
    return (
      <span role="columnheader" aria-sort={ariaSort} className="flex">
        <button
          type="button"
          onClick={() => toggleSort(col)}
          aria-label={`Ordina per ${label} (${nextAction})`}
          className={`flex items-center gap-1 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${className}`}
        >
          {label}
          <span aria-hidden className="text-[11px] text-neutral-500">
            {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 p-3">
        <h2 className="font-medium">
          Ingredienti <span className="text-sm font-normal text-neutral-500">({list.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {!manual && (
            <button
              type="button"
              onClick={() => setSort(null)}
              className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
              title="Torna all'ordine manuale (riattiva il trascinamento)"
            >
              ⠿ Ordine manuale
            </button>
          )}
          <button
            type="button"
            onClick={() => save({ nome: "Nuovo ingrediente", prezzo: 0, scorta: null, ordine: list.length + 1 })}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-1"
          >
            + Aggiungi ingrediente
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div role="table" aria-label="Ingredienti" className="min-w-[640px]">
          <div
            role="row"
            className={`grid ${COLS} gap-2 border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600`}
          >
            <span role="columnheader" aria-hidden />
            <Th col="nome" label="Nome" />
            <Th col="categoria" label="Categoria" />
            <Th col="scorta" label="Scorta" />
            <Th col="prezzo" label="Prezzo €" />
            <span role="columnheader">Unità</span>
            <Th col="stato" label="Stato" />
            <span role="columnheader" aria-hidden />
          </div>

          {list.length === 0 ? (
            <div role="row">
              <p role="cell" className="px-3 py-6 text-center text-sm text-neutral-600">
                Nessun ingrediente. Aggiungine uno con il pulsante qui sopra.
              </p>
            </div>
          ) : manual ? (
            <DndContext id="ing-table" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul role="rowgroup">
                  {list.map((ing, idx) => (
                    <Row
                      key={ing.id}
                      ing={ing}
                      index={idx}
                      count={list.length}
                      st={status[ing.id]}
                      manual
                      onPatch={(p) => patchLocal(ing.id, p)}
                      onSave={() => save(payload(ing))}
                      onMove={(d) => move(idx, idx + d)}
                      onDelete={() => del(ing.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ul role="rowgroup">
              {display.map((ing) => (
                <Row
                  key={ing.id}
                  ing={ing}
                  index={0}
                  count={0}
                  st={status[ing.id]}
                  manual={false}
                  onPatch={(p) => patchLocal(ing.id, p)}
                  onSave={() => save(payload(ing))}
                  onMove={() => {}}
                  onDelete={() => del(ing.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <datalist id="ing-cat-suggestions">
        {catSuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {error && <p className="px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Row({
  ing,
  index,
  count,
  st,
  manual,
  onPatch,
  onSave,
  onMove,
  onDelete,
}: {
  ing: PublicIngredient;
  index: number;
  count: number;
  st?: SaveState;
  manual: boolean;
  onPatch: (p: Partial<PublicIngredient>) => void;
  onSave: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const sortable = useSortableRow(ing.id);
  const [confirming, setConfirming] = useState(false);
  const s = stato(ing.scorta);
  const inputCls =
    "w-full rounded-md border border-neutral-300 px-1.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500";

  return (
    <li
      ref={manual ? sortable.setNodeRef : undefined}
      style={manual ? sortable.style : undefined}
      role="row"
      className={`grid ${COLS} items-center gap-2 border-b border-neutral-100 px-3 py-2 last:border-b-0`}
    >
      <span role="cell" className="flex items-center">
        {manual ? (
          <span className="flex flex-col items-center">
            <DragHandle {...sortable.handleProps} />
          </span>
        ) : (
          <span
            aria-hidden
            className="px-2 text-neutral-400"
            title="Ordina dalle intestazioni o torna all'ordine manuale"
          >
            ⠿
          </span>
        )}
      </span>

      <span role="cell">
        <input
          value={ing.nome}
          onChange={(e) => onPatch({ nome: e.target.value })}
          onBlur={onSave}
          placeholder="Nome"
          className={`${inputCls} font-medium`}
          aria-label="Nome"
        />
      </span>
      <span role="cell">
        <input
          value={ing.categoria}
          list="ing-cat-suggestions"
          onChange={(e) => onPatch({ categoria: e.target.value })}
          onBlur={onSave}
          placeholder="—"
          className={inputCls}
          aria-label="Categoria"
        />
      </span>
      <span role="cell">
        <input
          type="number"
          min="0"
          placeholder="∞"
          value={ing.scorta ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onPatch({ scorta: raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0) });
          }}
          onBlur={onSave}
          className={inputCls}
          aria-label="Scorta"
        />
      </span>
      <span role="cell" className="relative">
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
          €
        </span>
        <input
          type="number"
          step="0.5"
          min="0"
          value={ing.prezzo}
          onChange={(e) => onPatch({ prezzo: parseFloat(e.target.value) || 0 })}
          onBlur={onSave}
          className={`${inputCls} pl-5`}
          aria-label="Prezzo"
        />
      </span>
      <span role="cell">
        <input
          value={ing.unita ?? ""}
          onChange={(e) => onPatch({ unita: e.target.value })}
          onBlur={onSave}
          placeholder="—"
          className={inputCls}
          aria-label="Unità"
        />
      </span>
      <span role="cell" className="flex items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
        <SaveBadge st={st} />
      </span>

      <span role="cell" className="flex items-center justify-end gap-0.5">
        {manual && (
          <MoveButtons
            onUp={() => onMove(-1)}
            onDown={() => onMove(1)}
            isFirst={index === 0}
            isLast={index === count - 1}
          />
        )}
        {confirming ? (
          <span className="flex flex-col text-[11px] leading-tight">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              aria-label="Conferma eliminazione"
              className="rounded px-1 font-semibold text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Sì
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              aria-label="Annulla eliminazione"
              className="rounded px-1 text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Elimina ingrediente"
            className="rounded-md px-1.5 py-1 text-neutral-500 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <span aria-hidden>🗑</span>
          </button>
        )}
      </span>
    </li>
  );
}
