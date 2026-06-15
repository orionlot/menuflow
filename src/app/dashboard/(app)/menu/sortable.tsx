"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type SaveState = "saving" | "saved" | "error";

/** Per-row save feedback — same vocabulary as the menu-item editor. */
export function SaveBadge({ st }: { st?: SaveState }) {
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

/** ⠿ grip — classes identical to the menu-item SortableItem so the affordance
 *  is consistent across the whole dashboard. */
export function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      aria-label="Trascina per riordinare"
      className="shrink-0 cursor-grab touch-none rounded-md px-2 py-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 active:cursor-grabbing"
    >
      <span aria-hidden className="text-lg leading-none">
        ⠿
      </span>
    </button>
  );
}

/** Discoverable, no-drag-skill fallback for reordering (and works on touch). */
export function MoveButtons({
  onUp,
  onDown,
  isFirst,
  isLast,
}: {
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const cls =
    "rounded-md px-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30";
  return (
    <span className="flex shrink-0 flex-col leading-none">
      <button type="button" aria-label="Sposta su" disabled={isFirst} onClick={onUp} className={cls}>
        ↑
      </button>
      <button type="button" aria-label="Sposta giù" disabled={isLast} onClick={onDown} className={cls}>
        ↓
      </button>
    </span>
  );
}

/** Sortable-row scaffold — same style block as the menu-item SortableItem. */
export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return { setNodeRef, style, handleProps: { ...attributes, ...listeners } };
}
