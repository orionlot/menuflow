"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { setOrderStage, setOrderPriorita, setItemStage, claimComandaStampa, type KitchenStage } from "@/app/dashboard/actions";
import { orderStageOf, applyItemStageLocal, rollupTimestamps, groupByTable } from "./derive";
import OrderCard from "./OrderCard";
import TableGroup from "./TableGroup";
import { formatEUR } from "@/lib/config/plans";
import { printComandaSilently } from "@/lib/print-comanda";
import type { Reparto, Priorita } from "@/types/db";

export interface KItem {
  item_id?: string;
  nome: string;
  qta: number;
  prezzo: number;
  taglia?: string;
  nota?: string;
  reparto?: string | null;
  opzioni?: { gruppo: string; scelta: string; prezzo: number }[];
  composizione?: { ingredient_id: string; nome: string; qta: number; prezzo: number; unita?: string | null }[];
  // Per-item kitchen stamps (added in derive.ts Task 4)
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
  tempo_preparazione?: number | null;
}

export interface KOrder {
  id: string;
  tavolo: string | null;
  sala?: string | null;
  asporto?: boolean;
  items: KItem[];
  totale: number;
  note: string | null;
  created_at: string;
  preparazione_at: string | null;
  pronto_at: string | null;
  servito_at: string | null;
  tempo_stimato: number | null;
  priorita: Priorita | null;
  stato: string;
  allergeni?: string[] | null;
}

const STAGES: { id: KitchenStage; label: string; head: string; tint: string }[] = [
  { id: "da_preparare", label: "Da preparare", head: "text-amber-300", tint: "bg-amber-400/15" },
  { id: "in_preparazione", label: "In preparazione", head: "text-sky-300", tint: "bg-sky-400/15" },
  { id: "pronti", label: "Pronti — da servire", head: "text-green-300", tint: "bg-green-400/15" },
  { id: "serviti", label: "Serviti", head: "text-neutral-400", tint: "bg-neutral-500/10" },
];

const PRIO_CYCLE: (Priorita | null)[] = [null, "alta", "media", "bassa"];

/** Local optimistic timestamp patch so the board re-derives the new stage at once. */
function applyStageLocal(o: KOrder, stage: KitchenStage): KOrder {
  const now = new Date().toISOString();
  switch (stage) {
    case "da_preparare":
      return { ...o, preparazione_at: null, pronto_at: null, servito_at: null };
    case "in_preparazione":
      return { ...o, preparazione_at: o.preparazione_at ?? now, pronto_at: null, servito_at: null };
    case "pronti":
      return { ...o, preparazione_at: o.preparazione_at ?? now, pronto_at: o.pronto_at ?? now, servito_at: null };
    case "serviti":
      return { ...o, servito_at: now };
  }
}

export default function KitchenClient({
  restaurantName,
  restaurantId,
  repartoOn = false,
  reparti = [],
  tempoStimatoOn = true,
  autoStampaOn = false,
}: {
  restaurantName: string;
  restaurantId: string;
  repartoOn?: boolean;
  reparti?: Reparto[];
  tempoStimatoOn?: boolean;
  autoStampaOn?: boolean;
}) {
  const [orders, setOrders] = useState<KOrder[]>([]);
  const [audioOn, setAudioOn] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [repFilter, setRepFilter] = useState<string | null>(null); // reparto id, null = all
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<"stato" | "tavolo">("stato");
  // Ids of just-arrived orders — drives a brief visual pulse on the card accent.
  const [pulseIds, setPulseIds] = useState<Set<string>>(new Set());
  // Collapsed state for each OrderCard (by order id).
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const ac = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const audioOnRef = useRef(false);
  const autoStampaOnRef = useRef(autoStampaOn);
  autoStampaOnRef.current = autoStampaOn;
  const printed = useRef<Set<string>>(new Set());
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const repartoById = useMemo(() => {
    const m = new Map<string, Reparto>();
    for (const r of reparti) m.set(r.id, r);
    return m;
  }, [reparti]);

  // ── Audio (Web Audio API; no asset files) ──────────────────────────
  const enableAudio = useCallback(() => {
    if (!ac.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac.current = new Ctor();
    }
    void ac.current.resume();
    audioOnRef.current = true;
    setAudioOn(true);
  }, []);

  const ringBell = useCallback((offset = 0) => {
    const ctx = ac.current;
    if (!ctx) return;
    const base = ctx.currentTime + offset;
    const strike = (t: number) => {
      ([
        [880, 0.55],
        [1760, 0.28],
        [2637, 0.14],
      ] as const).forEach(([f, v]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 1.6);
      });
    };
    strike(base);
    strike(base + 0.17); // double "din-din" campanella
  }, []);

  const chime = useCallback(() => {
    const ctx = ac.current;
    if (!ctx) return;
    const n = ctx.currentTime;
    ([
      [660, 0],
      [990, 0.12],
    ] as const).forEach(([f, t]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const s = n + t;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.4, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + 0.32);
    });
  }, []);

  // ── Polling ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/kitchen", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) return;
      const incoming: KOrder[] = data.orders;
      const fresh = incoming.filter((o) => !o.preparazione_at && !o.pronto_at && !o.servito_at && !seen.current.has(o.id));
      // Auto-print keys off "any order id we haven't seen on this board yet" —
      // NOT the unstamped `fresh` set above — so a brand-new order that another
      // device already advanced to "in preparazione" before this board observed
      // it still gets its comanda printed (the kitchen feed only ever carries
      // printable orders: stato in ricevuto/pagato, not cancelled).
      const freshForPrint = incoming.filter((o) => !seen.current.has(o.id));
      if (!firstLoad.current && fresh.length && audioOnRef.current) chime();
      if (!firstLoad.current && freshForPrint.length && autoStampaOnRef.current) {
        freshForPrint.forEach((o) => {
          if (printed.current.has(o.id)) return; // local guard for the realtime+poll race
          printed.current.add(o.id);
          // claimComandaStampa makes the print once-only across the KDS, the
          // Ordini page, and any extra tab/device pointed at the same printer.
          void claimComandaStampa(o.id).then((won) => {
            if (won) printComandaSilently(o.id);
          });
        });
      }
      if (!firstLoad.current && fresh.length) {
        const freshIds = fresh.map((o) => o.id);
        setPulseIds((prev) => {
          const next = new Set(prev);
          freshIds.forEach((id) => next.add(id));
          return next;
        });
        freshIds.forEach((id) => {
          const old = pulseTimers.current.get(id);
          if (old) clearTimeout(old);
          pulseTimers.current.set(
            id,
            setTimeout(() => {
              pulseTimers.current.delete(id);
              setPulseIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }, 6000),
          );
        });
      }
      incoming.forEach((o) => seen.current.add(o.id));
      firstLoad.current = false;
      setOrders(incoming);
    } catch {
      /* keep last state on transient errors */
    }
  }, [chime]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // safety-net poll; realtime does the rest
    const c = setInterval(() => setNow(Date.now()), 1000); // countdown tick
    const timers = pulseTimers.current;
    return () => {
      clearInterval(t);
      clearInterval(c);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
    };
  }, [load]);

  // Realtime: react instantly to new/changed orders (the chime fires via load()).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel(`kitchen-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId, load]);

  // Track fullscreen state from the browser (Esc exits it).
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  // ── Actions (optimistic) ───────────────────────────────────────────
  const moveTo = useCallback((o: KOrder, stage: KitchenStage) => {
    if (stage === "pronti" && orderStageOf(o.items) !== "pronti") ringBell();
    const nowIso = new Date().toISOString();
    setOrders((prev) =>
      prev.map((x) => {
        if (x.id !== o.id) return x;
        // Patch all items optimistically to match the new order-level stage.
        const items = x.items.map((it) => applyItemStageLocal(it, stage, nowIso));
        return { ...applyStageLocal(x, stage), items };
      }),
    );
    void setOrderStage(o.id, stage).then(load);
  }, [load, ringBell]);

  const onItemStage = useCallback(
    (orderId: string, lineIndex: number, stage: KitchenStage) => {
      const nowIso = new Date().toISOString();
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          const items = o.items.map((it, i) =>
            i === lineIndex ? applyItemStageLocal(it, stage, nowIso) : it,
          );
          return { ...o, items, ...rollupTimestamps(items) };
        }),
      );
      void setItemStage(orderId, lineIndex, stage).catch(() => load());
    },
    [load],
  );

  function cyclePriorita(orderId: string) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    const idx = PRIO_CYCLE.indexOf(o.priorita ?? null);
    const next = PRIO_CYCLE[(idx + 1) % PRIO_CYCLE.length];
    setOrders((prev) => prev.map((x) => (x.id === orderId ? { ...x, priorita: next } : x)));
    void setOrderPriorita(orderId, next).then(load);
  }

  function ristampa(orderId: string) {
    window.open(`/dashboard/stampa/${orderId}`, "_blank", "noopener");
  }

  // ── Derived board state ─────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visible = useMemo(() => {
    if (!repartoOn || !repFilter) return orders;
    return orders.filter((o) => (o.items ?? []).some((it) => it.reparto === repFilter));
  }, [orders, repartoOn, repFilter]);

  // Priority weight for ordering within a column (alta first), then oldest first.
  const prioRank = (p: Priorita | null) => (p === "alta" ? 0 : p === "media" ? 1 : p === "bassa" ? 2 : 1.5);
  const byColumn = useMemo(() => {
    const m: Record<KitchenStage, KOrder[]> = {
      da_preparare: [],
      in_preparazione: [],
      pronti: [],
      serviti: [],
    };
    for (const o of visible) m[orderStageOf(o.items)].push(o);
    for (const k of Object.keys(m) as KitchenStage[]) {
      if (k === "serviti") m[k].sort((a, b) => (b.servito_at ?? "").localeCompare(a.servito_at ?? ""));
      else m[k].sort((a, b) => prioRank(a.priorita) - prioRank(b.priorita) || a.created_at.localeCompare(b.created_at));
    }
    return m;
  }, [visible]);

  const tableGroups = useMemo(() => groupByTable(visible), [visible]);

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id as KitchenStage | undefined;
    if (!overId) return;
    const o = orders.find((x) => x.id === e.active.id);
    if (!o || orderStageOf(o.items) === overId) return;
    moveTo(o, overId);
  }

  // ── Metrics ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const inPrep = byColumn.in_preparazione;
    const late = tempoStimatoOn
      ? inPrep.filter(
          (o) => o.tempo_stimato && o.preparazione_at && now > new Date(o.preparazione_at).getTime() + o.tempo_stimato * 60000,
        )
      : [];
    const overruns = late.map(
      (o) => (now - (new Date(o.preparazione_at!).getTime() + o.tempo_stimato! * 60000)) / 60000,
    );
    const prepDurations = orders
      .filter((o) => o.preparazione_at && o.pronto_at)
      .map((o) => (new Date(o.pronto_at!).getTime() - new Date(o.preparazione_at!).getTime()) / 60000)
      // Drop zero-length durations: an order sent straight to "pronti"/"serviti"
      // gets prep == ready == now, which would otherwise skew the average to 0.
      .filter((d) => d > 0);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    return {
      coda: byColumn.da_preparare.length,
      inPrep: inPrep.length,
      pronti: byColumn.pronti.length,
      serviti: byColumn.serviti.length,
      tempoMedio: avg(prepDurations),
      inRitardo: late.length,
      ritardoMedio: avg(overruns),
    };
  }, [byColumn, orders, now, tempoStimatoOn]);

  // Per-column totals: order value (always) + queue-clear estimate = sum of the
  // pending orders' tempo_stimato; `missing` flags orders without any estimate.
  const colAgg = useMemo(() => {
    const blank = () => ({ valueCents: 0, etaMin: 0, missing: 0 });
    const agg: Record<KitchenStage, { valueCents: number; etaMin: number; missing: number }> = {
      da_preparare: blank(),
      in_preparazione: blank(),
      pronti: blank(),
      serviti: blank(),
    };
    for (const k of Object.keys(agg) as KitchenStage[]) {
      for (const o of byColumn[k]) {
        agg[k].valueCents += Math.round(Number(o.totale) * 100);
        if (o.tempo_stimato && o.tempo_stimato > 0) agg[k].etaMin += o.tempo_stimato;
        else agg[k].missing += 1;
      }
    }
    return agg;
  }, [byColumn]);

  const totalActive = metrics.coda + metrics.inPrep + metrics.pronti;
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1115] text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-[#14171c] px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-bold">Cucina · {restaurantName}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-neutral-800 px-3 py-1 tabular-nums">
            {totalActive} attivi · {metrics.pronti} pronti
          </span>
          <button
            onClick={toggleFullscreen}
            className="rounded-full bg-neutral-800 px-3 py-1 hover:bg-neutral-700"
            title="Schermo intero"
          >
            {fullscreen ? "⤬ Esci" : "⤢ Schermo intero"}
          </button>
          {audioOn ? (
            <button
              onClick={() => ringBell()}
              className="rounded-full bg-neutral-800 px-3 py-1 hover:bg-neutral-700"
              title="Prova la campanella"
            >
              🔔 Prova
            </button>
          ) : (
            <button
              onClick={enableAudio}
              className="rounded-full bg-amber-500 px-3 py-1 font-semibold text-black hover:bg-amber-400"
            >
              🔔 Attiva audio
            </button>
          )}
          {autoStampaOn && (
            <span
              className="rounded-full bg-green-500/15 px-3 py-1 font-medium text-green-300 ring-1 ring-inset ring-green-500/30"
              title="Ogni nuovo ordine viene stampato automaticamente. Per la stampa senza finestra usa Chrome con --kiosk-printing."
            >
              🖨 Auto-stampa attiva
            </span>
          )}
        </div>
      </header>

      {/* Vista toggle (Per stato / Per tavolo) */}
      <div className="flex items-center gap-2 border-b border-neutral-800/60 px-4 py-2 sm:px-6">
        <span className="text-xs uppercase tracking-wider text-neutral-500">Vista</span>
        <button
          onClick={() => setView("stato")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            view === "stato" ? "bg-white text-neutral-900" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Per stato
        </button>
        <button
          onClick={() => setView("tavolo")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            view === "tavolo" ? "bg-white text-neutral-900" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          }`}
        >
          Per tavolo
        </button>
      </div>

      {/* Reparti filter (gated) */}
      {repartoOn && reparti.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800/60 px-4 py-2 sm:px-6">
          <span className="text-xs uppercase tracking-wider text-neutral-500">Reparto</span>
          <button
            onClick={() => setRepFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              repFilter === null ? "bg-white text-neutral-900" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            Tutti
          </button>
          {reparti.map((r) => (
            <button
              key={r.id}
              onClick={() => setRepFilter(r.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                repFilter === r.id ? "text-neutral-900" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
              style={repFilter === r.id ? { backgroundColor: r.colore ?? "#fff" } : undefined}
            >
              {r.nome}
            </button>
          ))}
        </div>
      )}

      {/* Compact, dismissible audio hint — only until audio is enabled. */}
      {!audioOn && !bannerOff && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 sm:mx-6">
          <span className="flex-1">Attiva l&apos;audio per la campanella quando un ordine è pronto.</span>
          <button
            onClick={enableAudio}
            className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-black hover:bg-amber-400"
          >
            Attiva
          </button>
          <button
            onClick={() => setBannerOff(true)}
            aria-label="Nascondi avviso"
            className="text-lg leading-none text-amber-300/70 hover:text-amber-200"
          >
            ×
          </button>
        </div>
      )}

      {/* Board */}
      <main className="flex-1 px-4 py-4 sm:px-6">
        {orders.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center text-neutral-400">
            <div className="flex flex-col items-center rounded-2xl border border-neutral-800 bg-[#14171c] px-10 py-12 shadow-lg">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-neutral-800/60 text-6xl shadow-inner">🍽️</div>
              <p className="mt-5 text-2xl font-semibold text-neutral-200">Nessun ordine in cucina</p>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">I nuovi ordini compaiono qui automaticamente.</p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300 ring-1 ring-inset ring-green-500/30">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                In ascolto
              </span>
            </div>
          </div>
        ) : view === "tavolo" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tableGroups.map((group) => (
              <TableGroup
                key={group.key}
                group={group}
                repartoOn={repartoOn}
                repartoById={repartoById}
                repFilter={repFilter}
                tempoStimatoOn={tempoStimatoOn}
                now={now}
                clock={clock}
                pulseIds={pulseIds}
                collapsed={collapsedIds}
                onToggle={(id) =>
                  setCollapsedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onItemStage={onItemStage}
                onOrderStage={(orderId, stage) => {
                  const o = orders.find((x) => x.id === orderId);
                  if (o) moveTo(o, stage);
                }}
                onPriorita={cyclePriorita}
                onRistampa={ristampa}
              />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STAGES.map((s) => (
                <Column
                  key={s.id}
                  stage={s.id}
                  label={s.label}
                  head={s.head}
                  tint={s.tint}
                  count={byColumn[s.id].length}
                  valueCents={colAgg[s.id].valueCents}
                  etaMin={tempoStimatoOn && (s.id === "da_preparare" || s.id === "in_preparazione") ? colAgg[s.id].etaMin : null}
                  approx={tempoStimatoOn && (s.id === "da_preparare" || s.id === "in_preparazione") && colAgg[s.id].missing > 0}
                >
                  {byColumn[s.id].map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      stage={orderStageOf(o.items)}
                      isNew={pulseIds.has(o.id)}
                      repartoOn={repartoOn}
                      repartoById={repartoById}
                      repFilter={repFilter}
                      tempoStimatoOn={tempoStimatoOn}
                      now={now}
                      collapsed={collapsedIds.has(o.id)}
                      clock={clock}
                      onToggleCollapse={() =>
                        setCollapsedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(o.id)) next.delete(o.id);
                          else next.add(o.id);
                          return next;
                        })
                      }
                      onItemStage={(li, stage) => onItemStage(o.id, li, stage)}
                      onOrderStage={(stage) => moveTo(o, stage)}
                      onPriorita={() => cyclePriorita(o.id)}
                      onRistampa={() => ristampa(o.id)}
                    />
                  ))}
                  {byColumn[s.id].length === 0 && (
                    <p className="rounded-xl border border-dashed border-neutral-700/70 px-3 py-6 text-center text-sm text-neutral-600">
                      —
                    </p>
                  )}
                </Column>
              ))}
            </div>
          </DndContext>
        )}
      </main>

      {/* Metrics footer */}
      <footer className="sticky bottom-0 z-10 grid grid-cols-3 gap-px border-t border-neutral-800 bg-neutral-800 text-center sm:grid-cols-6">
        <Metric label="In coda" value={String(metrics.coda)} />
        <Metric label="In preparazione" value={String(metrics.inPrep)} />
        <Metric label="Pronti" value={String(metrics.pronti)} />
        <Metric label="Serviti (2h)" value={String(metrics.serviti)} />
        <Metric label="Tempo medio" value={`${metrics.tempoMedio}′`} />
        <Metric
          label="In ritardo"
          value={metrics.inRitardo ? `${metrics.inRitardo} · +${metrics.ritardoMedio}′` : "0"}
          danger={metrics.inRitardo > 0}
        />
      </footer>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="bg-[#14171c] px-2 py-2">
      <div className={`text-lg font-bold tabular-nums ${danger ? "text-red-400" : "text-neutral-100"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

function Column({
  stage,
  label,
  head,
  tint,
  count,
  valueCents,
  etaMin,
  approx,
  children,
}: {
  stage: KitchenStage;
  label: string;
  head: string;
  tint: string;
  count: number;
  valueCents: number;
  etaMin: number | null;
  approx: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border p-2 transition ${
        isOver ? "border-white/40 bg-white/5" : "border-neutral-800/60"
      }`}
    >
      <h2 className={`mb-1 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-widest ${head}`}>
        {label}
        <span className={`min-w-[1.6rem] rounded-lg px-2 py-0.5 text-center text-sm font-extrabold tabular-nums ${tint}`}>
          {count}
        </span>
      </h2>
      {count > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[11px] text-neutral-400">
          <span className="font-semibold text-neutral-300 tabular-nums">{formatEUR(valueCents)}</span>
          {etaMin != null && etaMin > 0 && (
            <span className="tabular-nums" title="Tempo stimato per smaltire la coda">
              · ~{etaMin}′ coda
            </span>
          )}
          {approx && (
            <span className="text-amber-400/90" title="Alcuni piatti non hanno un tempo di preparazione: la stima è approssimativa">
              · stima approssimativa
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
