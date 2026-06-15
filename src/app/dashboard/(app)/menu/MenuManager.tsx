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
import { formatEUR } from "@/lib/config/plans";
import { uploadImage } from "@/app/actions/upload";
import OptionsEditor from "./OptionsEditor";
import CategoryAddonsEditor from "./CategoryAddonsEditor";

type MiniRestaurant = { id: string; multilingua: boolean; lingue: string[] };
type SaveState = "saving" | "saved" | "error";

export interface MenuActions {
  createItem: (patch: ItemPatch) => Promise<void>;
  updateItem: (id: string, patch: ItemPatch) => Promise<void>;
  duplicateItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  importItems?: (csv: string) => Promise<{ added: number; skipped: number }>;
  updateAggiunte: (aggiunte: CategoryAddon[]) => Promise<void>;
  reorder: (updates: { id: string; ordine: number }[]) => Promise<void>;
}

/** Handlers passed down to each sortable item row. */
interface ItemHandlers {
  scorteOn: boolean;
  otherLangs: string[];
  openOptionsId: string | null;
  setOpenOptions: (id: string | null) => void;
  status: Record<string, SaveState>;
  uploadingIds: Set<string>;
  save: (id: string, patch: ItemPatch) => void;
  toggle: (item: MenuItem) => void;
  toggleConsigliato: (item: MenuItem) => void;
  duplicate: (id: string) => void;
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
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());

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
  function setItemStatus(id: string, s: SaveState | null) {
    setStatus((prev) => {
      if (s === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: s };
    });
  }
  // Per-item save with explicit status (salvataggio… / salvato / errore).
  function save(id: string, patch: ItemPatch) {
    setError(null);
    setItemStatus(id, "saving");
    startTransition(async () => {
      try {
        await actions.updateItem(id, patch);
        setItemStatus(id, "saved");
        window.setTimeout(() => setItemStatus(id, null), 2000);
      } catch (e) {
        setItemStatus(id, "error");
        setError(e instanceof Error ? e.message : "Errore nel salvataggio.");
        router.refresh();
      }
    });
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
  function duplicate(id: string) {
    run(async () => {
      await actions.duplicateItem(id);
      router.refresh();
    });
  }
  function downloadTemplate() {
    const csv =
      "categoria,nome,descrizione,prezzo,disponibile,allergeni\n" +
      "Antipasti,Bruschette,Pane e pomodoro,5.50,si,glutine\n" +
      "Pizze,Margherita,,7.00,si,glutine|latte\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modello-menu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function importCsv(file: File) {
    const fn = actions.importItems;
    if (!fn) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      run(async () => {
        const res = await fn(text);
        setError(`Importate ${res.added} voci (${res.skipped} righe ignorate).`);
        router.refresh();
      });
    };
    reader.readAsText(file);
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
    setUploadingIds((s) => new Set(s).add(item.id));
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
    } finally {
      setUploadingIds((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
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
    status,
    uploadingIds,
    save,
    toggle,
    toggleConsigliato,
    duplicate,
    remove,
    uploadPhoto,
    toggleAllergen,
    saveOptions,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Gestione menu</h1>
        <div className="flex flex-wrap items-center gap-2">
          {actions.importItems && (
            <>
              <button
                onClick={downloadTemplate}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
              >
                Scarica modello
              </button>
              <label className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">
                Importa CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCsv(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          )}
          <button
            onClick={add}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            + Aggiungi voce
          </button>
        </div>
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
        Tocca una voce per modificarla. Trascina la maniglia ⠿ per riordinare i
        prodotti dentro una categoria.
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
                      <ul className="space-y-2">
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

function SaveBadge({ st }: { st?: SaveState }) {
  if (!st) return null;
  const map = {
    saving: { t: "salvataggio…", c: "text-neutral-400" },
    saved: { t: "✓ salvato", c: "text-green-600" },
    error: { t: "errore", c: "text-red-600" },
  } as const;
  const { t, c } = map[st];
  return (
    <span role="status" className={`whitespace-nowrap text-xs ${c}`}>
      {t}
    </span>
  );
}

function SortableItem({ item, h }: { item: MenuItem; h: ItemHandlers }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [open, setOpen] = useState(false);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  const st = h.status[item.id];
  const uploading = h.uploadingIds.has(item.id);
  const allergenCount = item.allergeni?.length ?? 0;
  const optCount = item.opzioni?.length ?? 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
    >
      {/* ── Compact row ── */}
      <div className="flex items-center gap-2 p-2.5">
        <button
          {...attributes}
          {...listeners}
          aria-label="Trascina per riordinare"
          className="shrink-0 cursor-grab touch-none rounded-md px-2 py-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
        >
          <span aria-hidden className="text-lg leading-none">
            ⠿
          </span>
        </button>

        {item.foto_url ? (
          <Image
            src={item.foto_url}
            alt={item.nome}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[10px] text-neutral-400">
            foto
          </div>
        )}

        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 flex-col items-start text-left"
        >
          <span className="flex items-center gap-1.5 truncate font-medium">
            {item.nome || "—"}
            {!item.disponibile && (
              <span className="rounded bg-neutral-200 px-1 text-[10px] font-semibold text-neutral-600">
                esaurito
              </span>
            )}
            {item.consigliato && <span className="text-amber-500">★</span>}
          </span>
          <span className="truncate text-xs text-neutral-500">
            {formatEUR(Math.round(item.prezzo * 100))}
            {optCount ? ` · ${optCount} varianti` : ""}
            {allergenCount ? ` · ${allergenCount} allergeni` : ""}
          </span>
        </button>

        <SaveBadge st={st} />

        <button
          onClick={() => h.toggle(item)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            item.disponibile
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
          }`}
        >
          {item.disponibile ? "Disp." : "Esaurito"}
        </button>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Comprimi" : "Espandi"}
          className="shrink-0 rounded-md px-2 py-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          {open ? "▲" : "▼"}
        </button>
      </div>

      {/* ── Expanded editor ── */}
      {open && (
        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/50 p-3">
          {/* Image upload */}
          <div className="flex items-center gap-3">
            {item.foto_url ? (
              <Image
                src={item.foto_url}
                alt={item.nome}
                width={64}
                height={64}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white text-[11px] text-neutral-400">
                nessuna foto
              </div>
            )}
            <label
              className={`cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm transition hover:bg-neutral-50 ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {uploading ? "Caricamento…" : item.foto_url ? "Cambia foto" : "Carica foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) h.uploadPhoto(item, f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Core fields */}
          <div className="flex flex-wrap gap-2">
            <label className="min-w-40 flex-1">
              <span className="mb-1 block text-xs text-neutral-500">Nome</span>
              <input
                defaultValue={item.nome}
                onBlur={(e) =>
                  e.target.value !== item.nome && h.save(item.id, { nome: e.target.value })
                }
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm font-medium"
              />
            </label>
            <label className="w-36">
              <span className="mb-1 block text-xs text-neutral-500">Categoria</span>
              <input
                defaultValue={item.categoria}
                onBlur={(e) =>
                  e.target.value !== item.categoria &&
                  h.save(item.id, { categoria: e.target.value })
                }
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="w-24">
              <span className="mb-1 block text-xs text-neutral-500">Prezzo €</span>
              <input
                type="number"
                step="0.1"
                min="0"
                defaultValue={item.prezzo}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v !== item.prezzo) h.save(item.id, { prezzo: v });
                }}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>
            {h.scorteOn && (
              <label className="w-24" title="Scorte di oggi (vuoto = illimitate)">
                <span className="mb-1 block text-xs text-neutral-500">Scorte</span>
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
                  className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
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

          {/* Translations — only when the multilingua add-on is active */}
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
                className="min-w-40 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
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
                className="min-w-40 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
              />
            </div>
          ))}

          {/* Allergeni (collapsed by default) */}
          <details className="text-sm">
            <summary className="cursor-pointer text-neutral-500">
              Allergeni {allergenCount ? `(${allergenCount})` : ""}
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ALLERGENI.map((a) => {
                const on = item.allergeni?.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => h.toggleAllergen(item, a.id)}
                    aria-pressed={on}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${
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

          {/* Varianti / extra (collapsed by default) */}
          <details
            className="text-sm"
            open={h.openOptionsId === item.id}
            onToggle={(e) =>
              h.setOpenOptions((e.target as HTMLDetailsElement).open ? item.id : null)
            }
          >
            <summary className="cursor-pointer text-neutral-500">
              Varianti / extra {optCount ? `(${optCount})` : ""}
            </summary>
            <div className="mt-2">
              <OptionsEditor
                value={item.opzioni ?? []}
                onSave={(o) => h.saveOptions(item, o)}
              />
            </div>
          </details>

          {/* Row actions */}
          <div className="flex items-center gap-3 border-t border-neutral-200 pt-2">
            <button
              onClick={() => h.toggleConsigliato(item)}
              aria-pressed={item.consigliato}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                item.consigliato
                  ? "bg-amber-100 text-amber-700"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              }`}
            >
              {item.consigliato ? "★ Consigliato" : "☆ Consiglia"}
            </button>
            <button
              onClick={() => h.duplicate(item.id)}
              className="text-xs text-neutral-500 hover:underline"
            >
              Duplica
            </button>
            <button
              onClick={() => h.remove(item.id)}
              className="ml-auto text-xs text-red-500 hover:underline"
            >
              Elimina
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
