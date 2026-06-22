"use client";

import type { KOrder } from "./KitchenClient";
import type { Reparto } from "@/types/db";
import OrderCard from "./OrderCard";
import { orderStageOf, type KitchenStage } from "./derive";

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

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
  onOrderStage: (orderId: string, stage: KitchenStage) => void;
  onPriorita: (orderId: string) => void;
  onRistampa: (orderId: string) => void;
}) {
  const title = group.asporto
    ? `Asporto · ${(group.tavolo ?? group.orders[0].tavolo ?? "").trim()}`
    : `Tav. ${group.tavolo ?? "—"}`;
  const groupCollapsed = collapsed.has(group.key);
  const totalItems = group.orders.reduce((n, o) => n + o.items.length, 0);
  const done = group.orders
    .flatMap((o) => o.items)
    .filter((i) => i.pronto_at || i.servito_at).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-2">
      <header className="flex items-center justify-between px-1 py-1">
        <button
          onClick={() => onToggle(group.key)}
          className="flex items-center gap-2 text-lg font-extrabold"
        >
          <span aria-hidden>{groupCollapsed ? "▸" : "▾"}</span>
          {title}
          {group.sala ? (
            <span className="text-base opacity-70">· {group.sala}</span>
          ) : null}
        </button>
        <span className="text-sm opacity-70">
          {group.orders.length > 1 ? `${group.orders.length} ordini · ` : ""}
          {done}/{totalItems} pronti
        </span>
      </header>
      {!groupCollapsed && (
        <div className="space-y-2">
          {group.orders.map((o, idx) => (
            <div key={o.id}>
              {idx > 0 ? (
                <p className="px-2 pb-1 text-xs font-semibold text-amber-300">
                  + aggiunta delle {hhmm(o.created_at)}
                </p>
              ) : null}
              <OrderCard
                order={o}
                stage={orderStageOf(o.items)}
                isNew={pulseIds.has(o.id)}
                repartoOn={repartoOn}
                repartoById={repartoById}
                repFilter={repFilter}
                tempoStimatoOn={tempoStimatoOn}
                now={now}
                clock={clock}
                collapsed={collapsed.has(o.id)}
                onToggleCollapse={() => onToggle(o.id)}
                onItemStage={(li, s) => onItemStage(o.id, li, s)}
                onOrderStage={(s) => onOrderStage(o.id, s)}
                onPriorita={() => onPriorita(o.id)}
                onRistampa={() => onRistampa(o.id)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
