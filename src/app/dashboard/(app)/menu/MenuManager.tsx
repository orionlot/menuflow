"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CategoryAddon, ItemOption, MenuItem } from "@/types/db";
import type { ItemPatch } from "@/lib/menu";
import { ALLERGENI } from "@/lib/config/allergeni";
import { uploadImage } from "@/app/actions/upload";
import OptionsEditor from "./OptionsEditor";
import CategoryAddonsEditor from "./CategoryAddonsEditor";

type MiniRestaurant = { id: string; multilingua: boolean; lingue: string[] };

export interface MenuActions {
  createItem: (patch: ItemPatch) => Promise<void>;
  updateItem: (id: string, patch: ItemPatch) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  updateAggiunte: (aggiunte: CategoryAddon[]) => Promise<void>;
  reorder: (updates: { id: string; ordine: number }[]) => Promise<void>;
}

/** Handlers passed down to each sortable item row. */
interface ItemHandlers {
  scorteOn: boolean;
  otherLangs: string[];
  openOptionsId: string | null;
  setOpenOptions: (id: string | null) => void;
  save: (id: string, patch: ItemPatch) => void;
  toggle: (item: MenuItem) => void;
  toggleConsigliato: (item: MenuItem) => void;
  remove: (id: string) => void;
  uploadPhoto: (item: MenuItem, file: File) => void;
  toggleAllergen: (item: MenuItem, id: string) => void;
  saveOptions: (item: MenuItem, opzioni: ItemOption[]) => void;
}

export default function MenuManager({
  restaurant,
  initialItems,
  initialAggiunte,
  scorteOn,
  actions,
}: {
  restaurant: MiniRestaurant;
  initialItems: MenuItem[];
  initialAggiunte: CategoryAddon[];
  scorteOn: boolean;
  actions: MenuActions;
}) {
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openOptions, setOpenOptions] = useState<string | null>(null);
  const [closedCats, setClosedCats] = useState<Set<string>>(new Set());

  useEffect(() => setItems(initialItems), [initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const otherLangs = restaurant.multilingua
    ? restaurant.lingue.filter((l) => l !== "it")
    : [];

  // Group by category, sorted by ordine (then created_at) within each group.
  const grouped = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const it of items) {
      const arr = m.get(it.categoria) ?? [];
      arr.push(it);
      m.set(it.categoria, arr);
    }
    for (const arr of m.values())
      arr.sort(
        (a, b) => a.ordine - b.ordine || a.created_at.localeCompare(b.created_at),
      );
    return m;
  }, [items]);

  const categoryNames = useMemo(
    () => [...grouped.keys()].sort((a, b) => a.localeCompare(b)),
    [grouped],
  );

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
  function patchLocal(id: string, patch: Partial<MenuItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function save(id: string, patch: ItemPatch) {
    run(() => actions.updateItem(id, patch));
  }
  function toggle(item: MenuItem) {
    patchLocal(item.id, { disponibile: !item.disponibile });
    save(item.id, { disponibile: !item.disponibile });
  }
  function toggleConsigliato(item: MenuItem) {
    patchLocal(item.id, { consigliato: !item.consigliato });
    save(item.id, { consigliato: !item.consigliato });
  }
  function remove(id: string) {
    if (!confirm("Eliminare questa voce?")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    run(() => actions.deleteItem(id));
  }
  function add() {
    run(async () => {
      await actions.createItem({ nome: "Nuova voce", categoria: "Senza categoria", prezzo: 0 });
      router.refresh();
    });
  }
  function toggleAllergen(item: MenuItem, id: string) {
    const set = new Set(item.allergeni ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const arr = [...set];
    patchLocal(item.id, { allergeni: arr });
    save(item.id, { allergeni: arr });
  }
  function saveOptions(item: MenuItem, opzioni: ItemOption[]) {
    patchLocal(item.id, { opzioni });
    save(item.id, { opzioni });
  }
  async function uploadPhoto(item: MenuItem, file: File) {
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("restaurantId", restaurant.id);
      fd.append("kind", "item");
      const { url } = await uploadImage(fd);
      patchLocal(item.id, { foto_url: url });
      save(item.id, { foto_url: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload non riuscito.");
    }
  }

  function toggleCat(cat: string) {
    setClosedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function onDragEnd(cat: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const catItems = grouped.get(cat) ?? [];
    const oldIndex = catItems.findIndex((i) => i.id === active.id);
    const newIndex = catItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(catItems, oldIndex, newIndex);
    const updates = reordered.map((it, idx) => ({ id: it.id, ordine: idx + 1 }));
    const ordMap = new Map(updates.map((u) => [u.id, u.ordine]));
    setItems((prev) =>
      prev.map((it) => (ordMap.has(it.id) ? { ...it, ordine: ordMap.get(it.id)! } : it)),
    );
    run(() => actions.reorder(updates));
  }

  const handlers: ItemHandlers = {
    scorteOn,
    otherLangs,
    openOptionsId: openOptions,
    setOpenOptions,
    save,
    toggle,
    toggleConsigliato,
    remove,
    uploadPhoto,
    toggleAllergen,
    saveOptions,
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Gestione menu</h1>
        <button
          onClick={add}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          + Aggiungi voce
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Aggiunte per categoria */}
      <details className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer font-medium">
          Aggiunte per categoria{" "}
          <span className="text-sm font-normal text-neutral-500">
            {initialAggiunte.length ? `(${initialAggiunte.length})` : "— facoltative"}
          </span>
        </summary>
        <p className="mb-3 mt-2 text-sm text-neutral-500">
          Es. &ldquo;Patatine fritte +3 €&rdquo; valida per tutta la categoria
          &ldquo;Pizze&rdquo;: comparirà come opzione su ogni prodotto di quelle categorie.
        </p>
        <CategoryAddonsEditor
          value={initialAggiunte}
          categories={categoryNames}
          onSave={(g) => run(() => actions.updateAggiunte(g))}
        />
      </details>

      <p className="mb-3 text-xs text-neutral-400">
        Trascina la maniglia ⠿ per riordinare i prodotti dentro una categoria.
      </p>

      {/* One accordion per category, each with its own sortable list */}
      <div className="space-y-3">
        {categoryNames.map((cat) => {
          const catItems = grouped.get(cat) ?? [];
          const open = !closedCats.has(cat);
          return (
            <div key={cat} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <button
                onClick={() => toggleCat(cat)}
                className="flex w-full items-center justify-between px-4 py-3 text-left font-medium hover:bg-neutral-50"
              >
                <span>
                  {cat}{" "}
                  <span className="text-sm font-normal text-neutral-400">
                    ({catItems.length})
                  </span>
                </span>
                <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
              </button>
              {open && (
                <div className="border-t border-neutral-100 p-3">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => onDragEnd(cat, e)}
                  >
                    <SortableContext
                      items={catItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-3">
                        {catItems.map((item) => (
                          <SortableItem key={item.id} item={item} h={handlers} />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="text-neutral-500">
          Nessuna voce. Aggiungi la prima con il pulsante in alto.
        </p>
      )}
    </div>
  );
}

function SortableItem({ item, h }: { item: MenuItem; h: ItemHandlers }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-neutral-200 bg-white p-3"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Trascina per riordinare"
          className="mt-1 cursor-grab touch-none rounded px-1 py-2 text-lg leading-none text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
        >
          ⠿
        </button>

        <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
          {/* Photo */}
          <div className="shrink-0">
            {item.foto_url ? (
              <Image
                src={item.foto_url}
                alt={item.nome}
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
                foto
              </div>
            )}
            <label className="mt-1 block cursor-pointer text-center text-[11px] text-blue-600 hover:underline">
              carica
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) h.uploadPhoto(item, f);
                }}
              />
            </label>
          </div>

          {/* Fields */}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                defaultValue={item.nome}
                onBlur={(e) =>
                  e.target.value !== item.nome && h.save(item.id, { nome: e.target.value })
                }
                placeholder="Nome"
                className="min-w-40 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
              />
              <input
                defaultValue={item.categoria}
                onBlur={(e) =>
                  e.target.value !== item.categoria &&
                  h.save(item.id, { categoria: e.target.value })
                }
                placeholder="Categoria"
                className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  defaultValue={item.prezzo}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v !== item.prezzo) h.save(item.id, { prezzo: v });
                  }}
                  className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                <span className="text-sm text-neutral-500">€</span>
              </div>
              {h.scorteOn && (
                <div
                  className="flex items-center gap-1"
                  title="Scorte di oggi (vuoto = illimitate)"
                >
                  <input
                    type="number"
                    min="0"
                    placeholder="∞"
                    defaultValue={item.scorta ?? ""}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const v = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                      if (v !== item.scorta) h.save(item.id, { scorta: v });
                    }}
                    className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-neutral-500">scorte</span>
                </div>
              )}
            </div>

            <input
              defaultValue={item.descrizione ?? ""}
              onBlur={(e) =>
                e.target.value !== (item.descrizione ?? "") &&
                h.save(item.id, { descrizione: e.target.value })
              }
              placeholder="Descrizione"
              className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />

            {h.otherLangs.map((lang) => (
              <div key={lang} className="flex flex-wrap gap-2">
                <input
                  defaultValue={item.nome_i18n?.[lang] ?? ""}
                  onBlur={(e) =>
                    h.save(item.id, {
                      nome_i18n: { ...item.nome_i18n, [lang]: e.target.value },
                    })
                  }
                  placeholder={`Nome (${lang.toUpperCase()})`}
                  className="min-w-40 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
                />
                <input
                  defaultValue={item.descrizione_i18n?.[lang] ?? ""}
                  onBlur={(e) =>
                    h.save(item.id, {
                      descrizione_i18n: {
                        ...item.descrizione_i18n,
                        [lang]: e.target.value,
                      },
                    })
                  }
                  placeholder={`Descrizione (${lang.toUpperCase()})`}
                  className="min-w-40 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
                />
              </div>
            ))}

            {/* Allergeni */}
            <details className="text-sm">
              <summary className="cursor-pointer text-neutral-500">
                Allergeni {item.allergeni?.length ? `(${item.allergeni.length})` : ""}
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALLERGENI.map((a) => {
                  const on = item.allergeni?.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => h.toggleAllergen(item, a.id)}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        on
                          ? "bg-amber-500 text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </details>

            {/* Opzioni / varianti */}
            <details
              className="text-sm"
              open={h.openOptionsId === item.id}
              onToggle={(e) =>
                h.setOpenOptions((e.target as HTMLDetailsElement).open ? item.id : null)
              }
            >
              <summary className="cursor-pointer text-neutral-500">
                Varianti / extra {item.opzioni?.length ? `(${item.opzioni.length})` : ""}
              </summary>
              <div className="mt-2">
                <OptionsEditor
                  value={item.opzioni ?? []}
                  onSave={(o) => h.saveOptions(item, o)}
                />
              </div>
            </details>
          </div>

          {/* Controls */}
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              onClick={() => h.toggle(item)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.disponibile
                  ? "bg-green-100 text-green-700"
                  : "bg-neutral-200 text-neutral-600"
              }`}
            >
              {item.disponibile ? "Disponibile" : "Esaurito"}
            </button>
            <button
              onClick={() => h.toggleConsigliato(item)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                item.consigliato
                  ? "bg-amber-100 text-amber-700"
                  : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {item.consigliato ? "★ Consigliato" : "☆ Consiglia"}
            </button>
            <button
              onClick={() => h.remove(item.id)}
              className="text-xs text-red-500 hover:underline"
            >
              Elimina
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
