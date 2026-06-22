"use client";

import { allergeneLabel } from "@/lib/config/allergeni";
import type { KOrder } from "./KitchenClient";
import type { Reparto, Priorita } from "@/types/db";
import ItemRow from "./ItemRow";
import { orderStageOf, type KitchenStage } from "./derive";

const PRIO_META: Record<Priorita, { label: string; cls: string }> = {
  alta: { label: "ALTA", cls: "bg-red-600 text-white" },
  media: { label: "MEDIA", cls: "bg-amber-500 text-black" },
  bassa: { label: "BASSA", cls: "bg-neutral-500 text-white" },
};

// Per-comanda next action (compact, on the comanda divider line).
const COMANDA_NEXT: Record<KitchenStage, { stage: KitchenStage; label: string; cls: string } | null> = {
  da_preparare: { stage: "in_preparazione", label: "Avvia tutto", cls: "bg-sky-700 text-white hover:bg-sky-600" },
  in_preparazione: { stage: "pronti", label: "Tutto pronto", cls: "bg-green-600 text-white hover:bg-green-700" },
  pronti: { stage: "serviti", label: "Ritira tutto", cls: "bg-neutral-900 text-white hover:bg-neutral-700" },
  serviti: null,
};

const WARN_MIN = 8;
const LATE_MIN = 15;

function MiniFlag({ filled }: { filled: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" fill={filled ? "currentColor" : "none"} />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
function MiniPrinter() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

/**
 * One compact card per table (Per-tavolo view). Aggregates the table's comande
 * into a single card: a state-coloured header with progress + allergen + age,
 * one allergen strip, reparto chips, then each comanda as a thin time-separated
 * section of per-dish rows. Served comande collapse to a one-line marker.
 */
export default function TableGroup({
  group,
  repartoOn,
  repartoById,
  repFilter,
  tempoStimatoOn,
  now,
  clock,
  pulseIds,
  collapsed,
  onToggle,
  onItemStage,
  onItemHold,
  portateOn = false,
  onOrderStage,
  onPriorita,
  onRistampa,
}: {
  group: { key: string; tavolo: string | null; sala: string | null; asporto: boolean; orders: KOrder[] };
  repartoOn: boolean;
  repartoById: Map<string, Reparto>;
  repFilter: string | null;
  tempoStimatoOn: boolean;
  now: number;
  clock: (iso: string) => string;
  pulseIds: Set<string>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onItemStage: (orderId: string, lineIndex: number, stage: KitchenStage) => void;
  onItemHold?: (orderId: string, lineIndex: number, held: boolean) => void;
  portateOn?: boolean;
  onOrderStage: (orderId: string, stage: KitchenStage) => void;
  onPriorita: (orderId: string) => void;
  onRistampa: (orderId: string) => void;
}) {
  const title = group.asporto
    ? `🛍 ${(group.tavolo ?? group.orders[0].tavolo ?? "").trim()}`
    : `Tav. ${group.tavolo ?? "—"}`;
  const groupCollapsed = collapsed.has(group.key);

  const allItems = group.orders.flatMap((o) => o.items);
  const totalItems = allItems.length;
  const doneItems = allItems.filter((i) => i.pronto_at || i.servito_at).length;
  const tableServed = totalItems > 0 && allItems.every((i) => i.servito_at);
  const tableStage = orderStageOf(allItems);
  const isNew = group.orders.some((o) => pulseIds.has(o.id));
  const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

  const allergeni = [...new Set(group.orders.flatMap((o) => o.allergeni ?? []))];
  const reps = repartoOn
    ? [...new Set(allItems.map((i) => i.reparto).filter(Boolean) as string[])]
    : [];

  // Oldest still-active comanda → table age (drives the colour + the time pill).
  const oldestActive = group.orders
    .filter((o) => orderStageOf(o.items) !== "serviti")
    .reduce((min, o) => Math.min(min, new Date(o.created_at).getTime()), Infinity);
  const ageMin = Number.isFinite(oldestActive)
    ? Math.max(0, Math.floor((now - oldestActive) / 60000))
    : 0;
  const ageColor = ageMin >= LATE_MIN ? "#dc2626" : ageMin >= WARN_MIN ? "#d97706" : "#16a34a";

  const headBg = tableServed
    ? "bg-neutral-600"
    : tableStage === "pronti"
    ? "bg-green-700"
    : tableStage === "in_preparazione"
    ? "bg-sky-800"
    : "bg-neutral-900";
  const accent = tableServed
    ? "#16a34a"
    : tableStage === "pronti"
    ? "#16a34a"
    : tableStage === "in_preparazione"
    ? "#0369a1"
    : ageColor;
  const barColor = tableServed ? "#16a34a" : tableStage === "pronti" ? "#16a34a" : "#0369a1";

  return (
    <section
      className={`overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-lg transition ${
        isNew ? "ring-2 ring-amber-400" : ""
      } ${tableServed ? "opacity-80" : ""}`}
      style={{ borderLeft: `6px solid ${accent}` }}
    >
      <header className={`flex items-center justify-between gap-2 px-3 py-2 text-white ${headBg}`}>
        <button
          onClick={() => onToggle(group.key)}
          className="flex min-w-0 items-center gap-2.5 text-left"
          aria-label={groupCollapsed ? "Espandi tavolo" : "Comprimi tavolo"}
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/20 text-3xl leading-none transition hover:bg-white/30"
          >
            {groupCollapsed ? "▸" : "▾"}
          </span>
          <span className="truncate text-lg font-extrabold">{title}</span>
          {group.sala ? <span className="truncate text-sm opacity-70">· {group.sala}</span> : null}
          {allergeni.length > 0 ? (
            <span
              className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold"
              title={allergeni.map(allergeneLabel).join(", ")}
            >
              ⚠ {allergeni.length}
            </span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-2.5 text-right">
          {group.orders.length > 1 ? (
            <span className="text-xs opacity-70">{group.orders.length} comande</span>
          ) : null}
          {!tableServed ? (
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: ageColor === "#16a34a" ? "#bbf7d0" : ageMin >= LATE_MIN ? "#fecaca" : "#fde68a" }}
            >
              {ageMin === 0 ? "adesso" : `${ageMin}′`}
            </span>
          ) : (
            <span className="text-sm font-bold text-green-200">✓ servito</span>
          )}
          <span className="text-sm font-bold tabular-nums">{doneItems}/{totalItems}</span>
        </div>
      </header>

      {/* progress bar */}
      <div className="h-1 w-full bg-neutral-200">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>

      {!groupCollapsed && (
        <>
          {/* one compact allergen strip per table */}
          {allergeni.length > 0 && (
            <div className="mx-2 mt-2 flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-white">
              <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide">⚠ Allergie</span>
              <span className="truncate text-sm font-bold">{allergeni.map(allergeneLabel).join(", ")}</span>
            </div>
          )}

          {/* reparto chips (small) */}
          {reps.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2 pt-2">
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

          {/* comande as thin time-separated sections */}
          <div className="px-2 py-2">
            {group.orders.map((o, idx) => {
              const st = orderStageOf(o.items);
              const served = st === "serviti";
              const next = COMANDA_NEXT[st];
              const lines = o.items.map((it, i) => ({ it, i }));
              const shown = repFilter ? lines.filter(({ it }) => it.reparto === repFilter) : lines;
              if (shown.length === 0) return null;
              return (
                <div key={o.id} className={idx > 0 ? "mt-2 border-t border-neutral-200 pt-2" : ""}>
                  <div className="flex items-center justify-between gap-2 px-1 pb-1">
                    <span
                      className={`flex min-w-0 items-center gap-1.5 text-xs font-semibold ${
                        idx > 0 ? "text-amber-700" : "text-neutral-500"
                      }`}
                    >
                      <span className="truncate">
                        {idx > 0 ? `+ aggiunta · ${clock(o.created_at)}` : `Comanda · ${clock(o.created_at)}`}
                      </span>
                      {o.priorita && PRIO_META[o.priorita] ? (
                        <span className={`shrink-0 rounded px-1 text-[10px] font-bold ${PRIO_META[o.priorita].cls}`}>
                          {PRIO_META[o.priorita].label}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => onPriorita(o.id)}
                        aria-label="Cambia priorità comanda"
                        className="grid h-7 w-7 place-items-center rounded-md border border-neutral-200 transition hover:bg-neutral-50"
                        style={o.priorita ? { color: "#dc2626", borderColor: "#dc2626" } : { color: "#9ca3af" }}
                      >
                        <MiniFlag filled={Boolean(o.priorita)} />
                      </button>
                      <button
                        onClick={() => onRistampa(o.id)}
                        aria-label="Ristampa comanda"
                        className="grid h-7 w-7 place-items-center rounded-md border border-neutral-200 text-neutral-400 transition hover:bg-neutral-50 hover:text-neutral-700"
                      >
                        <MiniPrinter />
                      </button>
                      {next ? (
                        <button
                          onClick={() => onOrderStage(o.id, next.stage)}
                          className={`rounded-md px-2 py-1 text-xs font-bold transition active:scale-95 ${next.cls}`}
                        >
                          {next.label}
                        </button>
                      ) : (
                        <button
                          onClick={() => onOrderStage(o.id, "pronti")}
                          aria-label="Annulla servito"
                          className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100"
                        >
                          ↶
                        </button>
                      )}
                    </span>
                  </div>

                  {served ? (
                    <p className="px-2 pb-1 text-sm font-medium text-neutral-400">
                      ✓ servito · {clock(o.servito_at ?? o.created_at)}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {shown.map(({ it, i }) => (
                        <ItemRow
                          key={i}
                          item={it}
                          lineIndex={i}
                          repartoOn={repartoOn}
                          repartoById={repartoById}
                          tempoStimatoOn={tempoStimatoOn}
                          now={now}
                          onStage={(li, s) => onItemStage(o.id, li, s)}
                          portateOn={portateOn}
                          onHold={onItemHold ? (li, h) => onItemHold(o.id, li, h) : undefined}
                        />
                      ))}
                    </ul>
                  )}

                  {o.note ? (
                    <div className="mx-1 mt-1 rounded-md bg-amber-100 px-2 py-1 text-sm font-semibold text-amber-900">
                      📝 {o.note}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
