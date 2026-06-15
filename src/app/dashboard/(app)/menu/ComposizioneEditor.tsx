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
import type { ComposizioneGruppo, ComposizioneScelta, PublicIngredient } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import { DragHandle, MoveButtons, useSortableRow } from "./sortable";

/** Guided builder for per-category composition groups, with drag-reorder of
 *  groups and of the ingredients inside each group. */
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
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ingById = new Map(ingredienti.map((i) => [i.id, i]));

  function apply(next: ComposizioneGruppo[], persist: boolean) {
    setGroups(next);
    groupsRef.current = next;
    if (persist) onSave(next);
  }
  function update(gi: number, patch: Partial<ComposizioneGruppo>, persist = true) {
    apply(
      groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)),
      persist,
    );
  }
  /** Persist whatever is in state now (used by text inputs on blur). */
  function persist() {
    onSave(groupsRef.current);
  }
  function addGroup() {
    apply(
      [...groups, { id: crypto.randomUUID(), nome: "Nuovo gruppo", categorie: [], min: 1, max: 1, ingredienti: [] }],
      true,
    );
  }
  function removeGroup(gi: number) {
    apply(groups.filter((_, i) => i !== gi), true);
  }
  function moveGroup(oldIndex: number, newIndex: number) {
    if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0 || newIndex >= groups.length) return;
    apply(arrayMove(groups, oldIndex, newIndex), true);
  }
  function onGroupDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    moveGroup(
      groups.findIndex((g) => g.id === active.id),
      groups.findIndex((g) => g.id === over.id),
    );
  }

  if (!ingredienti.length)
    return (
      <p className="text-sm text-neutral-500">
        Aggiungi prima qualche ingrediente in «Ingredienti &amp; scorta» qui sopra, poi crea i
        gruppi di composizione.
      </p>
    );

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">Nessun gruppo di composizione</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
            Un gruppo è una scelta che il cliente fa per comporre il piatto — es. «Base» (riso o
            insalata), «Proteine» (1 o 2 a scelta).
          </p>
          <button
            onClick={addGroup}
            className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            + Crea il primo gruppo
          </button>
        </div>
      ) : (
        <>
          <DndContext id="compo-groups" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onGroupDragEnd}>
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {groups.map((g, gi) => (
                  <GroupCard
                    key={g.id}
                    g={g}
                    gi={gi}
                    count={groups.length}
                    categories={categories}
                    ingredienti={ingredienti}
                    ingById={ingById}
                    sensors={sensors}
                    onUpdate={(patch, p) => update(gi, patch, p)}
                    onPersist={persist}
                    onRemove={() => removeGroup(gi)}
                    onMove={(d) => moveGroup(gi, gi + d)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={addGroup}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            + Aggiungi gruppo
          </button>
        </>
      )}
    </div>
  );
}

function GroupCard({
  g,
  gi,
  count,
  categories,
  ingredienti,
  ingById,
  sensors,
  onUpdate,
  onPersist,
  onRemove,
  onMove,
}: {
  g: ComposizioneGruppo;
  gi: number;
  count: number;
  categories: string[];
  ingredienti: PublicIngredient[];
  ingById: Map<string, PublicIngredient>;
  sensors: ReturnType<typeof useSensors>;
  onUpdate: (patch: Partial<ComposizioneGruppo>, persist?: boolean) => void;
  onPersist: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const { setNodeRef, style, handleProps } = useSortableRow(g.id);
  const [confirming, setConfirming] = useState(false);
  const obbligatorio = g.min > 0;
  const available = ingredienti.filter((i) => !g.ingredienti.some((s) => s.ingredient_id === i.id));

  function setMax(v: number) {
    const max = Math.max(1, v || 1);
    onUpdate({ max, min: Math.min(g.min, max) });
  }
  function setMin(v: number) {
    const min = Math.max(0, v || 0);
    onUpdate({ min, max: Math.max(g.max, min) });
  }
  function setObbligatorio(on: boolean) {
    onUpdate(on ? { min: Math.max(1, g.min || 1) } : { min: 0 });
  }
  function toggleCat(cat: string) {
    const has = g.categorie.includes(cat);
    onUpdate({ categorie: has ? g.categorie.filter((c) => c !== cat) : [...g.categorie, cat] });
  }
  function addIngrediente(id: string) {
    onUpdate({ ingredienti: [...g.ingredienti, { ingredient_id: id }] });
  }
  function removeIngrediente(id: string) {
    onUpdate({ ingredienti: g.ingredienti.filter((s) => s.ingredient_id !== id) });
  }
  function moveIngrediente(oldI: number, newI: number) {
    if (oldI === newI || newI < 0 || newI >= g.ingredienti.length) return;
    onUpdate({ ingredienti: arrayMove(g.ingredienti, oldI, newI) });
  }
  function setOverride(id: string, prezzo: number | null) {
    onUpdate({
      ingredienti: g.ingredienti.map((s) =>
        s.ingredient_id === id ? { ...s, prezzo: prezzo ?? undefined } : s,
      ),
    });
  }
  function onIngDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    moveIngrediente(
      g.ingredienti.findIndex((s) => s.ingredient_id === active.id),
      g.ingredienti.findIndex((s) => s.ingredient_id === over.id),
    );
  }

  const rule = ruleSentence(g.min, g.max);

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-neutral-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-100 p-3">
        <DragHandle {...handleProps} />
        <MoveButtons onUp={() => onMove(-1)} onDown={() => onMove(1)} isFirst={gi === 0} isLast={gi === count - 1} />
        <div className="min-w-0 flex-1">
          <input
            value={g.nome}
            onChange={(e) => onUpdate({ nome: e.target.value }, false)}
            onBlur={onPersist}
            placeholder="Nome del gruppo (es. Proteine)"
            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
          />
          <p className="mt-1 truncate text-xs text-neutral-400">
            Appare in: {g.categorie.join(", ") || "nessuna categoria"} · {g.min}–{g.max} scelte ·{" "}
            {g.ingredienti.length} ingredienti
          </p>
        </div>
        <span
          className={
            obbligatorio
              ? "shrink-0 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-brand"
              : "shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500"
          }
        >
          {obbligatorio ? "Obbligatorio" : "Facoltativo"}
        </span>
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
            aria-label="Rimuovi gruppo"
            title={`Rimuovere il gruppo «${g.nome}»?`}
            className="shrink-0 rounded-md px-2 py-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            🗑
          </button>
        )}
      </div>

      {/* Chunk 1 — Dove appare */}
      <div className="p-3">
        <div className="text-[13px] font-medium text-neutral-700">1 · Dove appare</div>
        <p className="mt-0.5 text-xs text-neutral-500">
          In quali categorie del menu compare questa scelta.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const on = g.categorie.includes(cat);
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
        {g.categorie.length === 0 && (
          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
            ⚠ Nessuna categoria: il gruppo non comparirà al cliente e non verrà salvato.
          </p>
        )}
      </div>

      {/* Chunk 2 — Quante scelte */}
      <div className="border-t border-neutral-100 bg-neutral-50/60 p-3">
        <div className="text-[13px] font-medium text-neutral-700">2 · Quante scelte</div>
        <div className="mt-2 inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
          <button
            onClick={() => setObbligatorio(false)}
            className={`rounded-md px-3 py-1 text-xs transition ${
              !obbligatorio ? "bg-[var(--brand-soft)] font-medium text-brand" : "text-neutral-600"
            }`}
          >
            Facoltativa
          </button>
          <button
            onClick={() => setObbligatorio(true)}
            className={`rounded-md px-3 py-1 text-xs transition ${
              obbligatorio ? "bg-[var(--brand-soft)] font-medium text-brand" : "text-neutral-600"
            }`}
          >
            Obbligatoria
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Stepper label="Quantità massima" value={g.max} min={1} onChange={setMax} />
          {obbligatorio && <Stepper label="Quantità minima" value={g.min} min={0} onChange={setMin} />}
        </div>
        {rule && <p className="mt-2 text-sm text-neutral-700">{rule}</p>}
        {g.min > g.ingredienti.length && (
          <p className="mt-1 text-xs text-amber-700">
            Il minimo ({g.min}) supera gli ingredienti disponibili ({g.ingredienti.length}): il
            cliente non potrà completare la scelta.
          </p>
        )}
      </div>

      {/* Chunk 3 — Quali ingredienti */}
      <div className="border-t border-neutral-100 p-3">
        <div className="text-[13px] font-medium text-neutral-700">3 · Quali ingredienti</div>
        <p className="mt-0.5 text-xs text-neutral-500">
          Trascina ⠿ (o usa ↑ ↓) per ordinare come li vede il cliente.
        </p>

        <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          In questo gruppo
        </div>
        {g.ingredienti.length === 0 ? (
          <p className="mt-1 text-xs text-amber-700">
            Aggiungi almeno un ingrediente, altrimenti il gruppo non verrà salvato.
          </p>
        ) : (
          <DndContext id={`compo-${g.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onIngDragEnd}>
            <SortableContext
              items={g.ingredienti.map((s) => s.ingredient_id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="mt-1 space-y-1">
                {g.ingredienti.map((s, si) => (
                  <IngredientRow
                    key={s.ingredient_id}
                    s={s}
                    si={si}
                    count={g.ingredienti.length}
                    ing={ingById.get(s.ingredient_id)}
                    onMove={(d) => moveIngrediente(si, si + d)}
                    onRemove={() => removeIngrediente(s.ingredient_id)}
                    onOverride={(v) => setOverride(s.ingredient_id, v)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {available.length > 0 && (
          <>
            <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Disponibili
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {available.map((i) => {
                const sold = i.scorta === 0;
                return (
                  <button
                    key={i.id}
                    onClick={() => addIngrediente(i.id)}
                    title={
                      sold
                        ? "Esaurito: non sarà selezionabile finché non rifornisci la scorta."
                        : undefined
                    }
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition hover:bg-neutral-200 ${
                      sold ? "bg-neutral-100 text-neutral-400" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    + {i.nome}
                    {sold && (
                      <span className="rounded bg-neutral-200 px-1 text-[9px] font-semibold text-neutral-500">
                        Esaurito
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ruleSentence(min: number, max: number): string {
  if (min === 0 && max === 1) return "Il cliente può aggiungere 1 ingrediente (facoltativo).";
  if (min === 0 && max > 1) return `Il cliente può scegliere fino a ${max} ingredienti (facoltativo).`;
  if (min > 0 && min === max)
    return `Il cliente deve scegliere esattamente ${min} ${min === 1 ? "ingrediente" : "ingredienti"}.`;
  if (min > 0 && max > min) return `Il cliente deve scegliere da ${min} a ${max} ingredienti.`;
  return "";
}

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="inline-flex items-center rounded-lg border border-neutral-200 bg-white">
        <button
          type="button"
          aria-label={`Diminuisci ${label}`}
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="px-2 py-1 text-neutral-500 disabled:opacity-30"
        >
          −
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || min)}
          className="w-10 border-x border-neutral-200 py-1 text-center text-sm"
        />
        <button
          type="button"
          aria-label={`Aumenta ${label}`}
          onClick={() => onChange(value + 1)}
          className="px-2 py-1 text-neutral-500"
        >
          +
        </button>
      </span>
    </label>
  );
}

function IngredientRow({
  s,
  si,
  count,
  ing,
  onMove,
  onRemove,
  onOverride,
}: {
  s: ComposizioneScelta;
  si: number;
  count: number;
  ing: PublicIngredient | undefined;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onOverride: (prezzo: number | null) => void;
}) {
  const { setNodeRef, style, handleProps } = useSortableRow(s.ingredient_id);
  const [draft, setDraft] = useState(s.prezzo == null ? "" : String(s.prezzo));
  if (!ing) return null; // ingredient was deleted from the master list

  const effective = s.prezzo ?? ing.prezzo;
  const sold = ing.scorta === 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5 ${
        sold ? "opacity-70" : ""
      }`}
    >
      <DragHandle {...handleProps} />
      <MoveButtons onUp={() => onMove(-1)} onDown={() => onMove(1)} isFirst={si === 0} isLast={si === count - 1} />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${sold ? "text-neutral-400 line-through" : ""}`}
      >
        {ing.nome}
      </span>
      {effective === 0 ? (
        <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-brand">
          Incluso
        </span>
      ) : (
        <span className="text-xs text-neutral-600">+{formatEUR(Math.round(effective * 100))}</span>
      )}
      {sold ? (
        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
          Esaurito
        </span>
      ) : ing.scorta != null ? (
        <span className="text-xs text-neutral-500">{ing.scorta}</span>
      ) : (
        <span className="text-xs text-neutral-400">∞</span>
      )}
      <span className="relative">
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
          €
        </span>
        <input
          type="number"
          step="0.5"
          min="0"
          value={draft}
          placeholder={String(ing.prezzo)}
          title="Prezzo personalizzato (vuoto = prezzo dell'ingrediente)"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onOverride(draft.trim() === "" ? null : Math.max(0, parseFloat(draft) || 0))}
          className="w-20 rounded-md border border-neutral-300 py-1 pl-5 pr-1 text-sm"
        />
      </span>
      <button
        onClick={onRemove}
        aria-label="Rimuovi dal gruppo"
        className="shrink-0 rounded-md px-1.5 py-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
      >
        ✕
      </button>
    </li>
  );
}
