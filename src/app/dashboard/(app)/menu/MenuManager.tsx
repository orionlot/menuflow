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
import type { CategoryAddon, ItemOption, MenuItem, NoteConfig, PublicIngredient, Reparto } from "@/types/db";
import type { ItemPatch } from "@/lib/menu";
import { ALLERGENI } from "@/lib/config/allergeni";
import { formatEUR } from "@/lib/config/plans";
import { uploadImage } from "@/app/actions/upload";
import OptionsEditor from "./OptionsEditor";
import CategoryAddonsEditor from "./CategoryAddonsEditor";
import NotesEditor from "./NotesEditor";
import EtichetteEditor from "./EtichetteEditor";
import RepartiEditor from "./RepartiEditor";
import CategoriaTempiEditor from "./CategoriaTempiEditor";
import ComposizioneEditor from "./ComposizioneEditor";
import TaglieEditor from "./TaglieEditor";

type MiniRestaurant = { id: string; multilingua: boolean; lingue: string[] };
type SaveState = "saving" | "saved" | "error";
type TabId = "piatti" | "categorie" | "varianti" | "extra" | "etichette" | "reparti" | "tempi";

const TABS: { id: TabId; label: string }[] = [
  { id: "piatti", label: "Piatti" },
  { id: "categorie", label: "Categorie" },
  { id: "varianti", label: "Varianti" },
  { id: "extra", label: "Extra" },
  { id: "etichette", label: "Etichette" },
  { id: "reparti", label: "Reparti" },
  { id: "tempi", label: "Tempi" },
];

export interface MenuActions {
  createItem: (patch: ItemPatch) => Promise<void>;
  updateItem: (id: string, patch: ItemPatch) => Promise<void>;
  duplicateItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  importItems?: (csv: string) => Promise<{ added: number; skipped: number }>;
  importMenuJson?: (text: string) => Promise<{ added: number; skipped: number; configApplied: boolean }>;
  updateAggiunte: (aggiunte: CategoryAddon[]) => Promise<void>;
  updateNoteConfig?: (noteConfig: NoteConfig[]) => Promise<void>;
  updateEtichette?: (etichette: string[]) => Promise<void>;
  updateReparti?: (reparti: Reparto[]) => Promise<void>;
  updateCategoriaTempi?: (value: Record<string, number>) => Promise<void>;
  updateCapienzaDefault?: (value: number | null) => Promise<void>;
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
  initialNoteConfig = [],
  initialEtichette = [],
  reparti = [],
  scorteOn,
  descrizioneOn = true,
  ingredientiOn = false,
  componibiliOn = false,
  repartoOn = false,
  prezzoAsportoOn = false,
  etichetteOn = false,
  vetrinaOn = false,
  fasceOrarieOn = false,
  tempoStimatoOn = false,
  categoriaTempi = {},
  capienzaDefault = null,
  pesoOn = false,
  kcalOn = false,
  ingredientiList = [],
  popularIds = [],
  actions,
}: {
  restaurant: MiniRestaurant;
  initialItems: MenuItem[];
  initialAggiunte: CategoryAddon[];
  initialNoteConfig?: NoteConfig[];
  initialEtichette?: string[];
  reparti?: Reparto[];
  scorteOn: boolean;
  descrizioneOn?: boolean;
  ingredientiOn?: boolean;
  componibiliOn?: boolean;
  repartoOn?: boolean;
  prezzoAsportoOn?: boolean;
  etichetteOn?: boolean;
  vetrinaOn?: boolean;
  fasceOrarieOn?: boolean;
  tempoStimatoOn?: boolean;
  categoriaTempi?: Record<string, number>;
  capienzaDefault?: number | null;
  pesoOn?: boolean;
  kcalOn?: boolean;
  ingredientiList?: PublicIngredient[];
  popularIds?: string[];
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("piatti");
  const popularSet = useMemo(() => new Set(popularIds), [popularIds]);

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
    () =>
      [...grouped.keys()].sort((a, b) => {
        // "Senza categoria" is an exception: always pinned to the top.
        if (a === "Senza categoria") return -1;
        if (b === "Senza categoria") return 1;
        return a.localeCompare(b);
      }),
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
    patchLocal(id, patch as Partial<MenuItem>); // keep the collapsed summary in sync
    setItemStatus(id, "saving");
    startTransition(async () => {
      try {
        await actions.updateItem(id, patch);
        setItemStatus(id, "saved");
        // Clear the "saved" badge after 2s, but only if a newer save hasn't
        // already set a different state for this item.
        window.setTimeout(
          () =>
            setStatus((prev) => {
              if (prev[id] !== "saved") return prev;
              const next = { ...prev };
              delete next[id];
              return next;
            }),
          2000,
        );
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
  function addTo(categoria: string) {
    run(async () => {
      await actions.createItem({ nome: "Nuovo prodotto", categoria, prezzo: 0 });
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
  function importMenu(file: File) {
    const fn = actions.importMenuJson;
    if (!fn) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      run(async () => {
        const res = await fn(text);
        setError(
          `Menu importato: ${res.added} piatti aggiunti${res.skipped ? `, ${res.skipped} ignorati` : ""}${
            res.configApplied ? " · varianti, extra, etichette, reparti e tempi aggiornati" : ""
          }.`,
        );
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

  const editingItem = items.find((i) => i.id === editingId) ?? null;

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
          {actions.importMenuJson && (
            <>
              <button
                onClick={() => window.open("/api/dashboard/menu-export", "_blank")}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                title="Scarica l'intero menu (tutti i campi: varianti, extra, etichette, reparti, tempi) in JSON"
              >
                Esporta menu
              </button>
              <label
                className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50"
                title="Importa un menu completo da file JSON (aggiunge i piatti e aggiorna la configurazione)"
              >
                Importa menu
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importMenu(f);
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

      {/* Tab bar */}
      <div className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.filter(
          (t) =>
            (t.id !== "etichette" || etichetteOn) &&
            (t.id !== "reparti" || repartoOn) &&
            (t.id !== "tempi" || tempoStimatoOn),
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px cursor-pointer rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Piatti ───────────────────────────────────────────── */}
      {tab === "piatti" && (
        <>
          <p className="mb-3 text-xs text-neutral-400">
            Tocca una voce per modificarla. Trascina la maniglia ⠿ per riordinare i
            prodotti dentro una categoria.
          </p>
          <div className="space-y-3">
            {categoryNames.map((cat) => {
              const catItems = grouped.get(cat) ?? [];
              const open = !closedCats.has(cat);
              return (
                <div key={cat} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      onClick={() => toggleCat(cat)}
                      className="flex flex-1 cursor-pointer items-center justify-between text-left font-medium"
                    >
                      <span>
                        {cat}{" "}
                        <span className="text-sm font-normal text-neutral-400">
                          ({catItems.length})
                        </span>
                      </span>
                      <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
                    </button>
                    <button
                      onClick={() => addTo(cat)}
                      disabled={pending}
                      className="shrink-0 cursor-pointer rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-medium text-brand transition hover:opacity-80 disabled:opacity-50"
                    >
                      + Aggiungi
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-neutral-100 p-3">
                      <DndContext
                        id={`cat-${cat}`}
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
                              <SortableItem
                                key={item.id}
                                item={item}
                                h={handlers}
                                onEdit={(it) => setEditingId(it.id)}
                                selected={editingId === item.id}
                                popolare={popularSet.has(item.id)}
                              />
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
        </>
      )}

      {/* ── Categorie ────────────────────────────────────────── */}
      {tab === "categorie" && (
        <CategoriesTab
          categories={categoryNames}
          grouped={grouped}
          disabled={pending}
          onRename={(oldName, newName) => {
            const targets = (grouped.get(oldName) ?? []).map((i) => i.id);
            setItems((prev) =>
              prev.map((i) => (i.categoria === oldName ? { ...i, categoria: newName } : i)),
            );
            run(async () => {
              for (const id of targets) await actions.updateItem(id, { categoria: newName });
              router.refresh();
            });
          }}
          onAdd={(name) => {
            run(async () => {
              await actions.createItem({ nome: "Nuovo prodotto", categoria: name, prezzo: 0 });
              router.refresh();
            });
          }}
        />
      )}

      {/* ── Varianti (per-dish options) ──────────────────────── */}
      {tab === "varianti" && (
        <VariantiTab
          categoryNames={categoryNames}
          grouped={grouped}
          onEdit={(id) => {
            setTab("piatti");
            setEditingId(id);
          }}
        />
      )}

      {/* ── Extra (category add-ons + customer notes) ────────── */}
      {tab === "extra" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="font-medium">Aggiunte per categoria</h2>
            <p className="mb-3 mt-1 text-sm text-neutral-500">
              Es. &ldquo;Patatine fritte +3 €&rdquo; valida per tutta la categoria
              &ldquo;Pizze&rdquo;: comparirà come opzione su ogni prodotto di quelle categorie.
            </p>
            <CategoryAddonsEditor
              value={initialAggiunte}
              categories={categoryNames}
              onSave={(g) => run(() => actions.updateAggiunte(g))}
            />
          </div>
          {actions.updateNoteConfig && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="font-medium">Note cliente per categoria</h2>
              <p className="mb-3 mt-1 text-sm text-neutral-500">
                Es. &ldquo;Note di cottura&rdquo; su tutte le &ldquo;Pizze&rdquo;: un campo nota
                comparirà su ogni prodotto di quelle categorie. Per un singolo prodotto usa la
                sezione &ldquo;Nota cliente&rdquo; nella sua scheda.
              </p>
              <NotesEditor
                value={initialNoteConfig}
                categories={categoryNames}
                onSave={(g) => run(() => actions.updateNoteConfig!(g))}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Etichette (reusable label catalog) ───────────────── */}
      {tab === "etichette" && etichetteOn && actions.updateEtichette && (
        <EtichetteEditor
          value={initialEtichette}
          onSave={(e) => run(() => actions.updateEtichette!(e))}
        />
      )}

      {/* ── Reparti (kitchen departments) ────────────────────── */}
      {tab === "reparti" && repartoOn && actions.updateReparti && (
        <RepartiEditor
          value={reparti}
          onSave={(r) => run(() => actions.updateReparti!(r))}
        />
      )}

      {/* ── Tempi (per-category prep time) ───────────────────── */}
      {tab === "tempi" && tempoStimatoOn && actions.updateCategoriaTempi && (
        <CategoriaTempiEditor
          value={categoriaTempi}
          categories={categoryNames}
          capienzaDefault={capienzaDefault}
          onSave={(v) => run(() => actions.updateCategoriaTempi!(v))}
          onSaveCapienza={
            actions.updateCapienzaDefault
              ? (n) => run(() => actions.updateCapienzaDefault!(n))
              : undefined
          }
        />
      )}

      {editingItem && (
        <QuickEditDrawer
          key={editingItem.id}
          item={editingItem}
          h={handlers}
          descrizioneOn={descrizioneOn}
          ingredientiOn={ingredientiOn}
          componibiliOn={componibiliOn}
          repartoOn={repartoOn}
          prezzoAsportoOn={prezzoAsportoOn}
          etichetteOn={etichetteOn}
          vetrinaOn={vetrinaOn}
          fasceOrarieOn={fasceOrarieOn}
          tempoStimatoOn={tempoStimatoOn}
          pesoOn={pesoOn}
          kcalOn={kcalOn}
          reparti={reparti}
          etichetteCatalog={initialEtichette}
          ingredientiList={ingredientiList}
          onClose={() => setEditingId(null)}
        />
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

function SortableItem({
  item,
  h,
  onEdit,
  selected,
  popolare = false,
}: {
  item: MenuItem;
  h: ItemHandlers;
  onEdit: (item: MenuItem) => void;
  selected: boolean;
  popolare?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  const st = h.status[item.id];
  const allergenCount = item.allergeni?.length ?? 0;
  const optCount = item.opzioni?.length ?? 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-xl border bg-white transition ${
        selected ? "border-brand ring-1 ring-[var(--brand-ring)]" : "border-neutral-200"
      }`}
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
          onClick={() => onEdit(item)}
          className="flex min-w-0 flex-1 flex-col items-start text-left"
        >
          <span className="flex items-center gap-1.5 truncate font-medium">
            {item.nome || "—"}
            {!item.disponibile && (
              <span className="rounded bg-neutral-200 px-1 text-[10px] font-semibold text-neutral-600">
                esaurito
              </span>
            )}
            {popolare && (
              <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">
                🔥 popolare
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
          onClick={() => onEdit(item)}
          aria-label="Modifica"
          className="shrink-0 rounded-md px-2 py-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          ✎
        </button>
      </div>
    </li>
  );
}

/** Right-side editor drawer for a single item, with a live phone preview. */
function QuickEditDrawer({
  item,
  h,
  descrizioneOn,
  ingredientiOn,
  componibiliOn,
  repartoOn,
  prezzoAsportoOn,
  etichetteOn,
  vetrinaOn,
  fasceOrarieOn,
  tempoStimatoOn,
  pesoOn,
  kcalOn,
  reparti,
  etichetteCatalog,
  ingredientiList,
  onClose,
}: {
  item: MenuItem;
  h: ItemHandlers;
  descrizioneOn: boolean;
  ingredientiOn: boolean;
  componibiliOn: boolean;
  repartoOn: boolean;
  prezzoAsportoOn: boolean;
  etichetteOn: boolean;
  vetrinaOn: boolean;
  fasceOrarieOn: boolean;
  tempoStimatoOn: boolean;
  pesoOn: boolean;
  kcalOn: boolean;
  reparti: Reparto[];
  etichetteCatalog: string[];
  ingredientiList: PublicIngredient[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    nome: item.nome,
    prezzo: String(item.prezzo),
    descrizione: item.descrizione ?? "",
  });
  const [newEtichetta, setNewEtichetta] = useState("");
  const etichetteOptions = [...new Set([...etichetteCatalog, ...(item.etichette ?? [])])];
  const uploading = h.uploadingIds.has(item.id);
  const st = h.status[item.id];
  const allergenCount = item.allergeni?.length ?? 0;
  const optCount = item.opzioni?.length ?? 0;
  const prezzoNum = parseFloat(draft.prezzo) || 0;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Modifica</h2>
            <SaveBadge st={st} />
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="rounded-md px-2 text-2xl leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Photo */}
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

          {/* Name */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Nome</span>
            <input
              value={draft.nome}
              onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
              onBlur={(e) =>
                e.target.value !== item.nome && h.save(item.id, { nome: e.target.value })
              }
              className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-medium"
            />
          </label>

          {/* Category + price (+ stock) */}
          <div className="flex flex-wrap gap-2">
            <label className="min-w-32 flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Categoria</span>
              <input
                defaultValue={item.categoria}
                onBlur={(e) =>
                  e.target.value !== item.categoria &&
                  h.save(item.id, { categoria: e.target.value })
                }
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="w-24">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Prezzo €</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={draft.prezzo}
                onChange={(e) => setDraft((d) => ({ ...d, prezzo: e.target.value }))}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v !== item.prezzo) h.save(item.id, { prezzo: v });
                }}
                className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            {h.scorteOn && (
              <label className="w-24" title="Scorte di oggi (vuoto = illimitate)">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Scorte</span>
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
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
            {prezzoAsportoOn && (
              <label className="w-28" title="Prezzo per asporto/delivery (vuoto = come al tavolo)">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Prezzo asporto €</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="="
                  defaultValue={item.prezzo_asporto ?? ""}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw === "" ? null : Math.max(0, parseFloat(raw) || 0);
                    if (v !== item.prezzo_asporto) h.save(item.id, { prezzo_asporto: v });
                  }}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
          </div>

          {/* Tempo di preparazione (gated) + peso/kcal/reparto (gated) */}
          <div className="flex flex-wrap gap-2">
            {tempoStimatoOn && (
              <label className="w-36" title="Minuti stimati di preparazione (usato dal timer in Cucina)">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Tempo prep. (min)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="—"
                  defaultValue={item.tempo_preparazione ?? ""}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                    if (v !== item.tempo_preparazione) h.save(item.id, { tempo_preparazione: v });
                  }}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
            {pesoOn && (
              <label className="w-28" title="Peso totale del piatto. Se vuoto e ci sono ingredienti con peso, viene sommato in automatico.">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Peso (g)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="auto"
                  defaultValue={item.peso ?? ""}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                    if (v !== item.peso) h.save(item.id, { peso: v });
                  }}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
            {kcalOn && (
              <label className="w-28" title="Calorie totali del piatto. Se vuoto e ci sono ingredienti con kcal, vengono sommate in automatico.">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Kcal</span>
                <input
                  type="number"
                  min="0"
                  placeholder="auto"
                  defaultValue={item.kcal ?? ""}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                    if (v !== item.kcal) h.save(item.id, { kcal: v });
                  }}
                  className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
            {repartoOn && (
              <label className="min-w-32 flex-1">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Reparto cucina</span>
                <select
                  value={item.reparto || ""}
                  onChange={(e) => h.save(item.id, { reparto: e.target.value })}
                  className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  {reparti.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* Etichette (gated) */}
          {etichetteOn && (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-neutral-500">Etichette</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {etichetteOptions.map((label) => {
                  const on = (item.etichette ?? []).includes(label);
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        const cur = item.etichette ?? [];
                        const next = on ? cur.filter((x) => x !== label) : [...cur, label];
                        h.save(item.id, { etichette: next });
                      }}
                      aria-pressed={on}
                      className={`rounded-full px-2.5 py-1 text-xs transition ${
                        on ? "bg-[var(--brand-soft)] text-brand" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <span className="inline-flex items-center gap-1">
                  <input
                    value={newEtichetta}
                    onChange={(e) => setNewEtichetta(e.target.value)}
                    placeholder="+ nuova"
                    className="w-24 rounded-full border border-dashed border-neutral-300 px-2.5 py-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = newEtichetta.trim();
                        const cur = item.etichette ?? [];
                        if (v && !cur.includes(v)) h.save(item.id, { etichette: [...cur, v] });
                        setNewEtichetta("");
                      }
                    }}
                  />
                </span>
              </div>
            </div>
          )}

          {/* Vetrina — feature in the homepage carousel (gated) */}
          {vetrinaOn && (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2.5">
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={item.in_vetrina}
                  onChange={(e) => h.save(item.id, { in_vetrina: e.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand)]"
                />
                ✨ In vetrina (carosello in homepage)
              </label>
              {item.in_vetrina && (
                <label className="mt-2 block">
                  <span className="mb-1 block text-xs font-medium text-neutral-500">
                    Annuncio (facoltativo)
                  </span>
                  <input
                    type="text"
                    maxLength={140}
                    placeholder="Es. Piatto del giorno · Di stagione · Novità"
                    defaultValue={item.vetrina_annuncio ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (item.vetrina_annuncio ?? "")) h.save(item.id, { vetrina_annuncio: v || null });
                    }}
                    className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                </label>
              )}
            </div>
          )}

          {/* Fasce orarie (gated) */}
          {fasceOrarieOn && (
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={item.solo_pranzo}
                  onChange={(e) => h.save(item.id, { solo_pranzo: e.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand)]"
                />
                Solo a pranzo
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={item.solo_cena}
                  onChange={(e) => h.save(item.id, { solo_cena: e.target.checked })}
                  className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand)]"
                />
                Solo a cena
              </label>
            </div>
          )}

          {/* Description (toggleable feature) */}
          {descrizioneOn && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-500">
                Descrizione breve
              </span>
              <textarea
                value={draft.descrizione}
                rows={2}
                onChange={(e) => setDraft((d) => ({ ...d, descrizione: e.target.value }))}
                onBlur={(e) =>
                  e.target.value !== (item.descrizione ?? "") &&
                  h.save(item.id, { descrizione: e.target.value })
                }
                placeholder="Aggiungi una descrizione"
                className="w-full resize-none rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
          )}

          {/* Ricetta (toggleable): tick ingredients + set grams → drives weight/kcal */}
          {ingredientiOn &&
            (ingredientiList.length > 0 ? (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                  Ricetta {item.ingredienti?.length ? `(${item.ingredienti.length})` : ""}
                </span>
                {(pesoOn || kcalOn) && (
                  <p className="mb-1.5 text-[11px] text-neutral-400">
                    Indica i grammi usati di ogni ingrediente: peso e calorie del piatto si
                    calcolano da qui. Vuoto = porzione predefinita dell&apos;ingrediente.
                  </p>
                )}
                <div className="space-y-1">
                  {ingredientiList.map((ing) => {
                    const voce = (item.ingredienti ?? []).find((v) => v.id === ing.id);
                    const on = Boolean(voce);
                    return (
                      <div key={ing.id} className="flex items-center gap-2">
                        <label className="flex flex-1 items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              const cur = item.ingredienti ?? [];
                              const next = on
                                ? cur.filter((v) => v.id !== ing.id)
                                : [...cur, { id: ing.id, grammi: null }];
                              h.save(item.id, { ingredienti: next });
                            }}
                            className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand)]"
                          />
                          {ing.nome}
                        </label>
                        {on && (pesoOn || kcalOn) && (
                          <span className="relative w-24 shrink-0">
                            <input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              defaultValue={voce?.grammi ?? ""}
                              placeholder={ing.peso != null ? String(ing.peso) : "g"}
                              onBlur={(e) => {
                                const raw = e.target.value.trim();
                                const grammi = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                                if ((voce?.grammi ?? null) === grammi) return;
                                const next = (item.ingredienti ?? []).map((v) =>
                                  v.id === ing.id ? { ...v, grammi } : v,
                                );
                                h.save(item.id, { ingredienti: next });
                              }}
                              className="w-full rounded-md border border-neutral-300 px-2 py-1 pr-6 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                              aria-label={`Grammi di ${ing.nome}`}
                            />
                            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">
                              g
                            </span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(item.ingredienti ?? []).length > 0 && (
                  <p className="mt-2 rounded-md bg-neutral-50 px-2 py-1.5 text-sm text-neutral-600">
                    {(item.ingredienti ?? [])
                      .map((v) => {
                        const ing = ingredientiList.find((i) => i.id === v.id);
                        if (!ing) return null;
                        const g = v.grammi != null ? v.grammi : ing.peso;
                        return g != null && (pesoOn || kcalOn) ? `${ing.nome} ${g}g` : ing.nome;
                      })
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                Aggiungi prima degli ingredienti in «Ingredienti &amp; inventario» per poterli
                spuntare qui.
              </p>
            ))}

          {/* Translations */}
          {h.otherLangs.map((lang) => (
            <div key={lang} className="space-y-1.5 rounded-lg bg-neutral-50 p-2">
              <span className="text-[11px] font-medium uppercase text-neutral-400">{lang}</span>
              <input
                defaultValue={item.nome_i18n?.[lang] ?? ""}
                onBlur={(e) =>
                  h.save(item.id, { nome_i18n: { ...item.nome_i18n, [lang]: e.target.value } })
                }
                placeholder={`Nome (${lang.toUpperCase()})`}
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
              />
              <input
                defaultValue={item.descrizione_i18n?.[lang] ?? ""}
                onBlur={(e) =>
                  h.save(item.id, {
                    descrizione_i18n: { ...item.descrizione_i18n, [lang]: e.target.value },
                  })
                }
                placeholder={`Descrizione (${lang.toUpperCase()})`}
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
              />
            </div>
          ))}

          {/* Allergens as checkboxes */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">
              Allergeni {allergenCount ? `(${allergenCount})` : ""}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {ALLERGENI.map((a) => {
                const on = item.allergeni?.includes(a.id) ?? false;
                return (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => h.toggleAllergen(item, a.id)}
                      className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand)]"
                    />
                    {a.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Variants / extras */}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-neutral-600">
              Varianti / extra {optCount ? `(${optCount})` : ""}
            </summary>
            <div className="mt-2">
              <OptionsEditor value={item.opzioni ?? []} onSave={(o) => h.saveOptions(item, o)} />
            </div>
          </details>

          {/* Composable (this product only) */}
          {componibiliOn && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-neutral-600">
                Componibile{" "}
                {item.composizione?.length ? `(${item.composizione.length} gruppi)` : ""}
              </summary>
              <div className="mt-2 space-y-4">
                <p className="text-xs text-neutral-500">
                  Rendi <b>questo prodotto</b> componibile: gruppi di ingredienti e formati
                  validi solo per questo piatto (indipendenti dalla categoria). Lascia vuoto
                  per un prodotto semplice.
                </p>
                <div>
                  <div className="mb-1.5 text-[13px] font-medium text-neutral-700">
                    Gruppi di composizione
                  </div>
                  <ComposizioneEditor
                    perItem
                    value={item.composizione ?? []}
                    ingredienti={ingredientiList}
                    categories={[]}
                    onSave={(g) => h.save(item.id, { composizione: g })}
                  />
                </div>
                <div>
                  <div className="mb-1.5 text-[13px] font-medium text-neutral-700">
                    Formati / taglie
                  </div>
                  <TaglieEditor
                    perItem
                    value={item.composizione_taglie ?? []}
                    gruppi={item.composizione ?? []}
                    categories={[]}
                    onSave={(t) => h.save(item.id, { composizione_taglie: t })}
                  />
                </div>
              </div>
            </details>
          )}

          {/* Customer note for this product */}
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-neutral-600">
              Nota cliente {item.nota?.attiva ? "(attiva)" : ""}
            </summary>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={Boolean(item.nota?.attiva)}
                  onChange={(e) =>
                    h.save(item.id, { nota: { ...item.nota, attiva: e.target.checked } })
                  }
                  className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand)]"
                />
                Chiedi una nota al cliente per questo prodotto
              </label>
              {item.nota?.attiva && (
                <>
                  <input
                    defaultValue={item.nota?.label ?? ""}
                    placeholder="Etichetta (es. Note di cottura)"
                    onBlur={(e) => {
                      const label = e.target.value.trim();
                      if (label !== (item.nota?.label ?? ""))
                        h.save(item.id, { nota: { ...item.nota, attiva: true, label } });
                    }}
                    className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={Boolean(item.nota?.obbligatoria)}
                      onChange={(e) =>
                        h.save(item.id, {
                          nota: { ...item.nota, attiva: true, obbligatoria: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-neutral-300 accent-[var(--brand)]"
                    />
                    Nota obbligatoria
                  </label>
                </>
              )}
            </div>
          </details>

          {/* Consigliato */}
          <button
            onClick={() => h.toggleConsigliato(item)}
            aria-pressed={item.consigliato}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              item.consigliato
                ? "bg-amber-100 text-amber-700"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {item.consigliato ? "★ Consigliato" : "☆ Consiglia"}
          </button>

          {/* Live preview */}
          <div className="border-t border-neutral-100 pt-3">
            <span className="mb-2 block text-xs font-medium text-neutral-500">Anteprima</span>
            <div className="mx-auto w-[190px] rounded-[1.9rem] border-[7px] border-neutral-900 bg-neutral-900 shadow-xl">
              <div className="overflow-hidden rounded-[1.4rem] bg-white">
                {item.foto_url ? (
                  <Image
                    src={item.foto_url}
                    alt={draft.nome}
                    width={176}
                    height={100}
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-neutral-100 text-[11px] text-neutral-400">
                    foto
                  </div>
                )}
                <div className="p-2.5">
                  <div className="truncate text-sm font-semibold text-neutral-900">
                    {draft.nome || "—"}
                  </div>
                  {draft.descrizione && (
                    <div className="line-clamp-2 text-[11px] leading-snug text-neutral-500">
                      {draft.descrizione}
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-brand">
                      {formatEUR(Math.round(prezzoNum * 100))}
                    </span>
                    {allergenCount > 0 && (
                      <span className="text-[10px] text-neutral-400">{allergenCount} allergeni</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => h.duplicate(item.id)}
              className="text-sm text-neutral-500 hover:underline"
            >
              Duplica
            </button>
            <button
              onClick={() => h.remove(item.id)}
              className="text-sm text-red-500 hover:underline"
            >
              Elimina
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Fatto
          </button>
        </div>
      </aside>
    </div>
  );
}

/** Categorie tab: rename existing categories (bulk) and create a new one. */
function CategoriesTab({
  categories,
  grouped,
  disabled,
  onRename,
  onAdd,
}: {
  categories: string[];
  grouped: Map<string, MenuItem[]>;
  disabled: boolean;
  onRename: (oldName: string, newName: string) => void;
  onAdd: (name: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newCat, setNewCat] = useState("");

  function commitRename(oldName: string) {
    const v = draft.trim();
    if (v && v !== oldName && !categories.some((c) => c.toLowerCase() === v.toLowerCase())) {
      onRename(oldName, v);
    }
    setEditing(null);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-medium">Categorie</h2>
      <p className="mb-3 mt-1 text-sm text-neutral-500">
        Rinomina una categoria (aggiorna tutti i suoi prodotti) o creane una nuova. Per spostare
        un prodotto, cambia la sua categoria dalla scheda nel tab Piatti.
      </p>
      <ul className="divide-y divide-neutral-100">
        {categories.map((cat) => {
          const count = grouped.get(cat)?.length ?? 0;
          const isException = cat === "Senza categoria";
          return (
            <li key={cat} className="flex items-center gap-2 py-2.5">
              {editing === cat ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(cat);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    maxLength={60}
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => commitRename(cat)}
                    disabled={disabled}
                    className="cursor-pointer rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
                  >
                    Salva
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
                  >
                    Annulla
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">
                    {cat}{" "}
                    <span className="text-sm font-normal text-neutral-400">({count})</span>
                  </span>
                  {isException ? (
                    <span className="text-xs text-neutral-400">non rinominabile</span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditing(cat);
                        setDraft(cat);
                      }}
                      className="cursor-pointer rounded-md px-2 py-1 text-sm text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                    >
                      ✎ Rinomina
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newCat.trim()) {
              onAdd(newCat.trim());
              setNewCat("");
            }
          }}
          placeholder="Nuova categoria"
          maxLength={60}
          className="w-56 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => {
            if (newCat.trim()) {
              onAdd(newCat.trim());
              setNewCat("");
            }
          }}
          disabled={disabled || !newCat.trim()}
          className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          + Crea categoria
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Creando una categoria viene aggiunto un prodotto vuoto da personalizzare.
      </p>
    </div>
  );
}

/** Varianti tab: lists dishes that have (or could have) per-item variant groups,
 *  with a shortcut to edit them in the product detail panel. */
function VariantiTab({
  categoryNames,
  grouped,
  onEdit,
}: {
  categoryNames: string[];
  grouped: Map<string, MenuItem[]>;
  onEdit: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">
        Le varianti (es. taglia, cottura, gusto) si configurano per singolo prodotto. Apri un
        prodotto per gestirne i gruppi di varianti.
      </p>
      {categoryNames.map((cat) => {
        const catItems = grouped.get(cat) ?? [];
        return (
          <div key={cat} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700">
              {cat}
            </div>
            <ul className="divide-y divide-neutral-100">
              {catItems.map((item) => {
                const n = item.opzioni?.length ?? 0;
                return (
                  <li key={item.id} className="flex items-center gap-2 px-4 py-2.5">
                    <span className="flex-1 truncate">{item.nome || "—"}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        n
                          ? "bg-[var(--brand-soft)] text-brand"
                          : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {n ? `${n} ${n === 1 ? "variante" : "varianti"}` : "nessuna"}
                    </span>
                    <button
                      onClick={() => onEdit(item.id)}
                      className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
                    >
                      Gestisci
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
