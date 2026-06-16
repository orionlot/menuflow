"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Sala, SalaTavolo } from "@/types/db";
import ManualOrderModal from "../ordini/ManualOrderModal";

export type PickerItem = { id: string; nome: string; prezzo: number; categoria: string; disponibile: boolean };

type SalaActions = {
  updateSale: (sale: Sala[]) => Promise<void>;
  createManualOrder: (input: {
    tavolo: string;
    tipo: "tavolo" | "asporto" | "delivery";
    sala?: string;
    indirizzo?: string;
    coperti?: number;
    note?: string;
    items: { item_id: string; qta: number }[];
  }) => Promise<{ orderId: string }>;
};

export default function SalaClient({
  initialSale,
  pickerItems,
  asportoOn,
  deliveryOn,
  copertoModalita,
  actions,
}: {
  initialSale: Sala[];
  pickerItems: PickerItem[];
  asportoOn: boolean;
  deliveryOn: boolean;
  copertoModalita: string;
  actions: SalaActions;
}) {
  const router = useRouter();
  const [sale, setSale] = useState<Sala[]>(initialSale.length ? initialSale : []);
  const [roomIdx, setRoomIdx] = useState(0);
  const [mode, setMode] = useState<"modifica" | "servizio">(
    initialSale.some((r) => r.tavoli.length) ? "servizio" : "modifica",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [orderTavolo, setOrderTavolo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const idCounter = useRef(0);

  const room = sale[roomIdx] ?? null;

  function saveRemote(next: Sala[]) {
    void actions.updateSale(next).catch(() => {
      setError("Salvataggio non riuscito.");
      router.refresh();
    });
  }
  function persist(next: Sala[]) {
    setSale(next);
    saveRemote(next);
  }
  function patchRoom(idx: number, p: Partial<Sala>) {
    setSale((prev) => prev.map((r, i) => (i === idx ? { ...r, ...p } : r)));
  }
  function patchTableLocal(tableId: string, p: Partial<SalaTavolo>) {
    setSale((prev) =>
      prev.map((r, i) =>
        i === roomIdx ? { ...r, tavoli: r.tavoli.map((t) => (t.id === tableId ? { ...t, ...p } : t)) } : r,
      ),
    );
  }

  function addRoom() {
    const nome = `Sala ${sale.length + 1}`;
    const next = [...sale, { id: `sala-${sale.length + 1}-${idCounter.current++}`, nome, tavoli: [] }];
    persist(next);
    setRoomIdx(next.length - 1);
    setMode("modifica");
  }
  function removeRoom() {
    if (!room || !confirm(`Eliminare "${room.nome}" e i suoi tavoli?`)) return;
    const next = sale.filter((_, i) => i !== roomIdx);
    persist(next);
    setRoomIdx(Math.max(0, roomIdx - 1));
  }
  function addTable() {
    if (!room) return;
    const n = room.tavoli.length + 1;
    // Cascade new tables in a light grid so they don't stack on the same spot.
    const k = room.tavoli.length;
    const t: SalaTavolo = {
      id: `tav-${idCounter.current++}`,
      nome: String(n),
      x: 22 + (k % 5) * 14,
      y: 25 + (Math.floor(k / 5) % 4) * 16,
    };
    persist(sale.map((r, i) => (i === roomIdx ? { ...r, tavoli: [...r.tavoli, t] } : r)));
    setSelected(t.id);
  }
  function removeTable(id: string) {
    persist(sale.map((r, i) => (i === roomIdx ? { ...r, tavoli: r.tavoli.filter((t) => t.id !== id) } : r)));
    setSelected(null);
  }

  // ── Pointer drag (free 2D positioning), modifica mode only ──
  function onPointerDown(e: React.PointerEvent, t: SalaTavolo) {
    if (mode !== "modifica") return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { id: t.id, moved: false };
  }
  function onPointerMove(e: React.PointerEvent, t: SalaTavolo) {
    const d = dragRef.current;
    if (!d || d.id !== t.id) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    d.moved = true;
    patchTableLocal(t.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  function onPointerUp(t: SalaTavolo) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    // Persist from the latest committed state (not the closure) so the final
    // drag coordinates are always the ones saved, independent of render timing.
    if (d.moved) setSale((latest) => (saveRemote(latest), latest));
    else if (mode === "modifica") setSelected((s) => (s === t.id ? null : t.id));
  }

  const selectedTable = room?.tavoli.find((t) => t.id === selected) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Sala</h1>
        <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5 text-sm">
          {(["servizio", "modifica"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSelected(null);
              }}
              className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
                mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Room tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {sale.map((r, i) => (
          <button
            key={r.id}
            onClick={() => {
              setRoomIdx(i);
              setSelected(null);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              i === roomIdx ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {r.nome}
          </button>
        ))}
        {mode === "modifica" && (
          <button
            onClick={addRoom}
            className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-sm text-neutral-500 hover:bg-neutral-50"
          >
            + Stanza
          </button>
        )}
      </div>

      {sale.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
          <p className="text-sm font-medium text-neutral-700">Nessuna sala.</p>
          <button
            onClick={addRoom}
            className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            + Crea la prima sala
          </button>
        </div>
      ) : (
        <>
          {mode === "modifica" && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                onClick={addTable}
                className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-sm font-medium text-brand hover:opacity-80"
              >
                + Tavolo
              </button>
              {room && (
                <input
                  value={room.nome}
                  onChange={(e) => patchRoom(roomIdx, { nome: e.target.value })}
                  onBlur={() => persist(sale)}
                  maxLength={40}
                  aria-label="Nome sala"
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              )}
              <button
                onClick={removeRoom}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Elimina sala
              </button>
              <span className="text-xs text-neutral-400">Trascina i tavoli per posizionarli.</span>
            </div>
          )}

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="relative w-full overflow-hidden rounded-2xl border border-neutral-200"
            style={{
              aspectRatio: "16 / 10",
              background:
                "repeating-linear-gradient(0deg,#f8fafc,#f8fafc 23px,#eef2f7 24px),repeating-linear-gradient(90deg,#f8fafc,#f8fafc 23px,#eef2f7 24px)",
            }}
          >
            {(room?.tavoli ?? []).map((t) => {
              const isSel = selected === t.id;
              return (
                <button
                  key={t.id}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  onPointerMove={(e) => onPointerMove(e, t)}
                  onPointerUp={() => onPointerUp(t)}
                  onClick={() => {
                    if (mode === "servizio") setOrderTavolo(t.nome);
                  }}
                  className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border-2 text-center shadow-sm transition ${
                    mode === "modifica" ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer hover:brightness-95"
                  } ${isSel ? "border-brand ring-2 ring-[var(--brand-ring)]" : "border-neutral-300"}`}
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: 64,
                    height: 64,
                    background: mode === "servizio" ? "var(--brand-soft)" : "#fff",
                  }}
                >
                  <span className="text-sm font-bold leading-none text-neutral-900">{t.nome}</span>
                  {t.posti ? (
                    <span className="mt-0.5 text-[10px] text-neutral-500">{t.posti} posti</span>
                  ) : null}
                </button>
              );
            })}
            {(room?.tavoli.length ?? 0) === 0 && (
              <div className="absolute inset-0 grid place-items-center text-sm text-neutral-400">
                {mode === "modifica" ? "Aggiungi un tavolo con «+ Tavolo»." : "Nessun tavolo in questa sala."}
              </div>
            )}
          </div>

          {/* Selected-table editor (modifica) */}
          {mode === "modifica" && selectedTable && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-neutral-500">Nome / numero</span>
                <input
                  value={selectedTable.nome}
                  onChange={(e) => patchTableLocal(selectedTable.id, { nome: e.target.value })}
                  onBlur={() => persist(sale)}
                  maxLength={20}
                  className="w-28 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-neutral-500">Posti</span>
                <input
                  type="number"
                  min="1"
                  value={selectedTable.posti ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    patchTableLocal(selectedTable.id, { posti: v > 0 ? v : undefined });
                  }}
                  onBlur={() => persist(sale)}
                  className="w-20 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </label>
              <button
                onClick={() => removeTable(selectedTable.id)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Elimina tavolo
              </button>
            </div>
          )}

          {mode === "servizio" && (
            <p className="mt-3 text-sm text-neutral-500">Tocca un tavolo per avviare un ordine.</p>
          )}
        </>
      )}

      {orderTavolo !== null && (
        <ManualOrderModal
          items={pickerItems}
          asportoOn={asportoOn}
          deliveryOn={deliveryOn}
          copertoModalita={copertoModalita}
          initialTavolo={orderTavolo}
          initialSala={room?.nome}
          onClose={() => setOrderTavolo(null)}
          onCreate={async (input) => {
            await actions.createManualOrder(input);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
