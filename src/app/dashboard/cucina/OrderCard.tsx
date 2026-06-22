"use client";

import { useDraggable } from "@dnd-kit/core";
import { allergeneLabel } from "@/lib/config/allergeni";
import type { KOrder } from "./KitchenClient";
import type { Reparto, Priorita } from "@/types/db";
import ItemRow from "./ItemRow";
import { type KitchenStage } from "./derive";

// ── Priority metadata (mirrors KitchenClient) ────────────────────────────────
const PRIO_META: Record<Priorita, { label: string; cls: string }> = {
  alta: { label: "ALTA", cls: "bg-red-600 text-white" },
  media: { label: "MEDIA", cls: "bg-amber-500 text-black" },
  bassa: { label: "BASSA", cls: "bg-neutral-500 text-white" },
};

// Wait-time thresholds (minutes) for the age colour of a "da preparare" card.
const WARN_MIN = 8;
const LATE_MIN = 15;

const ORDER_NEXT: Record<KitchenStage, { stage: KitchenStage; label: string } | null> = {
  da_preparare: { stage: "in_preparazione", label: "Avvia tutto" },
  in_preparazione: { stage: "pronti", label: "Tutto pronto" },
  pronti: { stage: "serviti", label: "Ritira tutto" },
  serviti: null,
};

/** Priority flag — outline when none, filled when a priority is set. */
function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z"
        fill={filled ? "currentColor" : "none"}
      />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

/** Thermal-printer (ristampa comanda). */
function PrinterIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

export default function OrderCard({
  order,
  stage,
  isNew,
  repartoOn,
  repartoById,
  repFilter,
  tempoStimatoOn,
  now,
  collapsed,
  clock,
  onToggleCollapse,
  onItemStage,
  onOrderStage,
  onPriorita,
  onRistampa,
}: {
  order: KOrder;
  stage: KitchenStage;
  isNew: boolean;
  repartoOn: boolean;
  repartoById: Map<string, Reparto>;
  repFilter: string | null;
  tempoStimatoOn: boolean;
  now: number;
  collapsed: boolean;
  clock: (iso: string) => string;
  onToggleCollapse: () => void;
  onItemStage: (lineIndex: number, stage: KitchenStage) => void;
  onOrderStage: (stage: KitchenStage) => void;
  onPriorita: () => void;
  onRistampa: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
  });
  const dragStyle: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50, opacity: 0.9 }
    : undefined;

  // Age of the order in minutes.
  const m = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60000));
  const ageColor = m >= LATE_MIN ? "#dc2626" : m >= WARN_MIN ? "#d97706" : "#16a34a";

  // Order-level countdown (in preparazione, with a tempo_stimato estimate).
  let countdown: { text: string; late: boolean } | null = null;
  if (
    tempoStimatoOn &&
    stage === "in_preparazione" &&
    order.preparazione_at &&
    order.tempo_stimato
  ) {
    const remaining =
      new Date(order.preparazione_at).getTime() + order.tempo_stimato * 60000 - now;
    const late = remaining < 0;
    const abs = Math.abs(remaining);
    const mm = Math.floor(abs / 60000);
    const ss = Math.floor((abs % 60000) / 1000);
    countdown = { text: `${late ? "+" : ""}${mm}:${String(ss).padStart(2, "0")}`, late };
  }

  const dest = order.asporto
    ? `🛍 ${order.tavolo ?? "—"}`
    : `Tav. ${order.tavolo ?? "—"}${order.sala ? ` · ${order.sala}` : ""}`;
  const served = stage === "serviti";
  const noEstimate =
    tempoStimatoOn &&
    (stage === "da_preparare" || stage === "in_preparazione") &&
    !order.tempo_stimato;

  // Distinct departments present in this order (for reparto chips in header).
  const reps = repartoOn
    ? [
        ...new Set(
          (order.items ?? []).map((it) => it.reparto).filter(Boolean) as string[],
        ),
      ]
    : [];

  const headBg =
    stage === "pronti"
      ? "bg-green-600"
      : stage === "in_preparazione"
      ? "bg-sky-700"
      : served
      ? "bg-neutral-700"
      : "bg-neutral-900";

  const prioColor =
    order.priorita === "alta"
      ? "#dc2626"
      : order.priorita === "media"
      ? "#d97706"
      : order.priorita === "bassa"
      ? "#525252"
      : null;

  // Keep the original index of each item line so per-item actions hit the right JSONB element.
  const lines = order.items.map((it, i) => ({ it, i }));
  const shown = repFilter ? lines.filter(({ it }) => it.reparto === repFilter) : lines;
  const next = ORDER_NEXT[stage];

  return (
    <article
      ref={setNodeRef}
      className={`relative flex flex-col overflow-hidden rounded-2xl shadow-lg transition ${
        served ? "bg-neutral-200 text-neutral-700" : "bg-white text-neutral-900"
      } ${isNew ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0f1115]" : ""} ${
        isDragging ? "shadow-2xl" : ""
      }`}
      style={{
        ...dragStyle,
        borderLeft: `6px solid ${stage === "da_preparare" ? ageColor : "transparent"}`,
      }}
    >
      {/* Header — doubles as drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={`flex cursor-grab touch-none items-center justify-between gap-2 px-3 py-2 text-white active:cursor-grabbing ${headBg}`}
      >
        <span className="flex items-center gap-2 text-xl font-extrabold">
          {/* Collapse toggle sits inside the header but stops drag propagation */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="text-sm opacity-70 hover:opacity-100"
            aria-label={collapsed ? "Espandi ordine" : "Comprimi ordine"}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {dest}
          {order.priorita && PRIO_META[order.priorita] && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIO_META[order.priorita].cls}`}
            >
              {PRIO_META[order.priorita].label}
            </span>
          )}
        </span>
        <span className="text-right text-xs leading-tight">
          {countdown ? (
            <span
              className={`block text-sm font-bold ${
                countdown.late ? "text-red-300" : "text-sky-100"
              }`}
            >
              ⏱ {countdown.text}
            </span>
          ) : stage === "da_preparare" ? (
            <span className="block text-sm font-bold" style={{ color: ageColor }}>
              {m === 0 ? "adesso" : `${m}′`}
            </span>
          ) : (
            <span className="block text-sm font-bold">
              {stage === "pronti" ? "PRONTO 🔔" : served ? "✓" : ""}
            </span>
          )}
          {noEstimate && (
            <span
              className="block text-[10px] font-medium text-amber-200/90"
              title="Tempo di preparazione non impostato"
            >
              stima n/d
            </span>
          )}
          <span className="text-neutral-300">{clock(order.created_at)}</span>
        </span>
      </div>

      {/* Allergen banner */}
      {order.allergeni && order.allergeni.length > 0 && (
        <div className="mx-3 mt-2 rounded-lg border-2 border-red-500 bg-red-600 px-2.5 py-1.5 text-white">
          <div className="text-[11px] font-extrabold uppercase tracking-wide">
            ⚠️ Allergie al tavolo
          </div>
          <div className="text-sm font-bold leading-tight">
            {order.allergeni.map((a) => allergeneLabel(a)).join(", ")}
          </div>
        </div>
      )}

      {/* Reparto chips */}
      {reps.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {reps.map((id) => {
            const r = repartoById.get(id);
            return (
              <span
                key={id}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: r?.colore ?? "#525252" }}
              >
                {r?.nome ?? id}
              </span>
            );
          })}
        </div>
      )}

      {/* Body: per-item rows on the left, priority + reprint buttons on the right */}
      {!collapsed && (
        <div className="flex flex-1 items-stretch">
          <div className="min-w-0 flex-1 py-2">
            <ul className="space-y-1 px-2">
              {shown.map(({ it, i }) => (
                <ItemRow
                  key={i}
                  item={it}
                  lineIndex={i}
                  repartoOn={repartoOn}
                  repartoById={repartoById}
                  tempoStimatoOn={tempoStimatoOn}
                  now={now}
                  onStage={onItemStage}
                />
              ))}
            </ul>
            {order.note && (
              <div className="mx-2 mt-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-base font-semibold text-amber-900">
                📝 {order.note}
              </div>
            )}
          </div>

          {/* Large icon controls — priorità (flag) + ristampa (printer) */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-2 px-3 py-2">
            <button
              onClick={onPriorita}
              title={`Priorità${order.priorita ? `: ${order.priorita}` : ""} (tocca per cambiare)`}
              aria-label="Cambia priorità ordine"
              className="grid h-12 w-12 place-items-center rounded-xl border-2 transition hover:bg-neutral-50 active:scale-95"
              style={
                prioColor
                  ? { borderColor: prioColor, color: prioColor }
                  : { borderColor: "#e5e5e5", color: "#9ca3af" }
              }
            >
              <FlagIcon filled={Boolean(order.priorita)} />
            </button>
            <button
              onClick={onRistampa}
              title="Ristampa comanda"
              aria-label="Ristampa comanda"
              className="grid h-12 w-12 place-items-center rounded-xl border-2 border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-800 active:scale-95"
            >
              <PrinterIcon />
            </button>
          </div>
        </div>
      )}

      {/* Order-wide footer action */}
      {!collapsed && next && (
        <div className="px-3 pb-3 pt-1">
          <button
            onClick={() => onOrderStage(next.stage)}
            className={`w-full rounded-lg py-2.5 text-base font-bold transition active:scale-[0.99] ${
              stage === "da_preparare"
                ? "bg-sky-700 text-white hover:bg-sky-600"
                : stage === "in_preparazione"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-neutral-900 text-white hover:bg-neutral-700"
            }`}
          >
            {next.label}
          </button>
        </div>
      )}
      {/* Served → undo button */}
      {served && !collapsed && (
        <button
          onClick={() => onOrderStage("pronti")}
          className="min-h-[40px] bg-neutral-300 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-400/70"
        >
          ↶ Annulla
        </button>
      )}
    </article>
  );
}
