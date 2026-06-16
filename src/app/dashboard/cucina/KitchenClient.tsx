"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  markOrderReady,
  markOrderServed,
  undoOrderReady,
} from "@/app/dashboard/actions";

interface KItem {
  item_id?: string;
  nome: string;
  qta: number;
  prezzo: number;
  taglia?: string;
  opzioni?: { gruppo: string; scelta: string; prezzo: number }[];
  composizione?: { ingredient_id: string; nome: string; qta: number; prezzo: number; unita?: string | null }[];
}

/** Chosen options + composition for one order line, for the cook to read. */
function itemDetails(it: KItem): string[] {
  return [
    ...(it.opzioni ?? []).map((x) => x.scelta),
    ...(it.composizione ?? []).map((c) => `${c.qta}× ${c.nome}`),
  ];
}
interface KOrder {
  id: string;
  tavolo: string | null;
  items: KItem[];
  totale: number;
  note: string | null;
  created_at: string;
  pronto_at: string | null;
  stato: string;
}

// Wait-time thresholds (minutes) for the age colour of a "da preparare" card.
const WARN_MIN = 8;
const LATE_MIN = 15;

export default function KitchenClient({
  restaurantName,
  restaurantId,
}: {
  restaurantName: string;
  restaurantId: string;
}) {
  const [orders, setOrders] = useState<KOrder[]>([]);
  const [audioOn, setAudioOn] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Ids of just-arrived orders — drives a brief visual pulse on the card accent
  // to complement the audio chime. Purely presentational; cleared on a timer.
  const [pulseIds, setPulseIds] = useState<Set<string>>(new Set());

  const ac = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const audioOnRef = useRef(false);
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Audio (Web Audio API; no asset files) ──────────────────────────
  const enableAudio = useCallback(() => {
    if (!ac.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
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
      const fresh = incoming.filter(
        (o) => !o.pronto_at && !seen.current.has(o.id),
      );
      if (!firstLoad.current && fresh.length && audioOnRef.current) chime();
      // Pulse the accent on genuinely new cards (skip the very first load so the
      // whole board doesn't blink on mount).
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
    const c = setInterval(() => setNow(Date.now()), 10000);
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

  // ── Actions (optimistic) ───────────────────────────────────────────
  function setReady(o: KOrder) {
    ringBell();
    setOrders((prev) =>
      prev.map((x) =>
        x.id === o.id ? { ...x, pronto_at: new Date().toISOString() } : x,
      ),
    );
    void markOrderReady(o.id).then(load);
  }
  function setServed(o: KOrder) {
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    void markOrderServed(o.id).then(load);
  }
  function undo(o: KOrder) {
    setOrders((prev) =>
      prev.map((x) => (x.id === o.id ? { ...x, pronto_at: null } : x)),
    );
    void undoOrderReady(o.id).then(load);
  }

  const toPrepare = orders.filter((o) => !o.pronto_at);
  const ready = orders.filter((o) => o.pronto_at);

  const mins = (iso: string) =>
    Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  // Border/accent colour by wait time.
  const ageColor = (m: number) =>
    m >= LATE_MIN ? "#dc2626" : m >= WARN_MIN ? "#d97706" : "#16a34a";

  return (
    <div className="min-h-screen bg-[#0f1115] text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-neutral-800 bg-[#14171c] px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-bold">Cucina · {restaurantName}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-neutral-800 px-3 py-1">
            {toPrepare.length} da preparare · {ready.length} pronti
          </span>
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
        </div>
      </header>

      {/* Compact, dismissible audio hint — only until audio is enabled. */}
      {!audioOn && !bannerOff && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 sm:mx-6">
          <span className="flex-1">
            Attiva l&apos;audio per la campanella quando un ordine è pronto.
          </span>
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

      <main className="px-4 py-5 sm:px-6">
        {orders.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center text-neutral-400">
            <div className="flex flex-col items-center rounded-2xl border border-neutral-800 bg-[#14171c] px-10 py-12 shadow-lg">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-neutral-800/60 text-6xl shadow-inner">
                🍽️
              </div>
              <p className="mt-5 text-2xl font-semibold text-neutral-200">Nessun ordine in cucina</p>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">
                I nuovi ordini compaiono qui automaticamente.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300 ring-1 ring-inset ring-green-500/30">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                In ascolto
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ── Colonna 1: DA PREPARARE ── */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-neutral-300">
                Da preparare
                <span
                  className={`min-w-[1.75rem] rounded-xl px-2.5 py-1 text-center text-sm font-extrabold tabular-nums shadow-sm ${
                    toPrepare.length > 0
                      ? "bg-amber-400 text-neutral-950 ring-1 ring-amber-300"
                      : "bg-neutral-800 text-neutral-400"
                  }`}
                >
                  {toPrepare.length}
                </span>
              </h2>
              {toPrepare.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-700 px-4 py-8 text-center text-neutral-600">
                  Tutto preparato 👏
                </p>
              ) : (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
                >
                  {toPrepare.map((o) => {
                    const m = mins(o.created_at);
                    const col = ageColor(m);
                    const isNew = pulseIds.has(o.id);
                    const dest = o.tavolo === "Asporto" ? "🛍 Asporto" : `Tavolo ${o.tavolo ?? "—"}`;
                    return (
                      <article
                        key={o.id}
                        className={`relative flex flex-col overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-lg transition-shadow ${
                          isNew ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0f1115]" : ""
                        }`}
                        style={{ borderLeft: `6px solid ${col}` }}
                      >
                        {isNew && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 left-0 w-[6px] animate-pulse"
                            style={{ backgroundColor: col }}
                          />
                        )}
                        <div className="flex items-center justify-between gap-2 bg-neutral-900 px-4 py-3 text-white">
                          <span className="text-2xl font-extrabold">
                            {dest}
                          </span>
                          <span className="text-right text-xs leading-tight">
                            <span
                              className="block text-sm font-bold"
                              style={{ color: col }}
                            >
                              {m === 0 ? "adesso" : `${m} min`}
                            </span>
                            <span className="text-neutral-400">{clock(o.created_at)}</span>
                          </span>
                        </div>
                        <ul className="flex-1 space-y-2 px-4 py-3">
                          {o.items.map((it, i) => {
                            const det = itemDetails(it);
                            return (
                              <li key={`${o.id}-${i}`}>
                                <div className="flex items-baseline gap-2 text-xl">
                                  <span className="min-w-[2.2rem] font-extrabold text-neutral-900">
                                    {it.qta}×
                                  </span>
                                  <span>
                                    {it.nome}
                                    {it.taglia && (
                                      <span className="font-bold text-neutral-500"> · {it.taglia}</span>
                                    )}
                                  </span>
                                </div>
                                {det.length > 0 && (
                                  <ul className="mt-1 space-y-0.5 pl-[2.2rem] text-lg font-semibold text-neutral-700">
                                    {det.map((d, di) => (
                                      <li key={di}>+ {d}</li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                          {o.note && (
                            <li className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-lg font-semibold text-amber-900">
                              📝 {o.note}
                            </li>
                          )}
                        </ul>
                        <button
                          onClick={() => setReady(o)}
                          className="min-h-[52px] bg-green-600 py-4 text-xl font-bold text-white shadow-sm transition hover:bg-green-700 hover:brightness-110 hover:shadow-md active:scale-[0.99] active:bg-green-800"
                        >
                          ✓ PRONTO
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Colonna 2: PRONTI — DA SERVIRE ── */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-green-400">
                Pronti — da servire
                <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                  {ready.length}
                </span>
              </h2>
              {ready.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-700 px-4 py-8 text-center text-neutral-600">
                  Niente in attesa di essere servito.
                </p>
              ) : (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
                >
                  {ready.map((o) => {
                    const dest = o.tavolo === "Asporto" ? "🛍 Asporto" : `Tavolo ${o.tavolo ?? "—"}`;
                    return (
                    <article
                      key={o.id}
                      className="flex flex-col overflow-hidden rounded-2xl bg-green-50 text-neutral-900 shadow-lg"
                      style={{ borderLeft: "6px solid #16a34a" }}
                    >
                      <div className="flex items-center justify-between gap-2 bg-green-600 px-4 py-3 text-white">
                        <span className="text-2xl font-extrabold">
                          {dest}
                        </span>
                        <span className="text-right text-xs leading-tight">
                          <span className="block text-sm font-bold">PRONTO 🔔</span>
                          <span className="text-green-100">dalle {clock(o.created_at)}</span>
                        </span>
                      </div>
                      <ul className="flex-1 space-y-1 px-4 py-3">
                        {o.items.map((it, i) => {
                          const det = itemDetails(it);
                          return (
                            <li key={`${o.id}-${i}`} className="text-lg">
                              <span className="font-bold">{it.qta}×</span> {it.nome}
                              {it.taglia && <span className="text-neutral-500"> · {it.taglia}</span>}
                              {det.length > 0 && (
                                <span className="block pl-5 text-base font-medium text-neutral-600">
                                  {det.join(", ")}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex">
                        <button
                          onClick={() => undo(o)}
                          className="min-h-[48px] w-1/3 border-r border-green-200 bg-white py-3 text-sm font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700 active:scale-[0.99] active:bg-neutral-100"
                        >
                          ↶ Annulla
                        </button>
                        <button
                          onClick={() => setServed(o)}
                          className="min-h-[48px] w-2/3 bg-neutral-900 py-3 text-base font-bold text-white shadow-sm transition hover:bg-neutral-700 hover:brightness-110 hover:shadow-md active:scale-[0.99] active:bg-black"
                        >
                          Ritirato
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
