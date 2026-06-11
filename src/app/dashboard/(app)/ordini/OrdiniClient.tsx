"use client";

import { useEffect, useRef, useState } from "react";
import type { Order } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import { markOrdersRead } from "@/app/dashboard/actions";

function statoBadge(o: Order): { text: string; cls: string } {
  if (o.stato === "in_attesa_pagamento")
    return { text: "In attesa pagamento", cls: "bg-amber-100 text-amber-700" };
  if (o.stato === "fallito")
    return { text: "Pagamento fallito", cls: "bg-red-100 text-red-700" };
  if (o.servito_at) return { text: "Servito", cls: "bg-neutral-200 text-neutral-600" };
  if (o.pronto_at) return { text: "Pronto", cls: "bg-green-100 text-green-700" };
  return { text: "In preparazione", cls: "bg-blue-100 text-blue-700" };
}

/** Short "new order" chime via Web Audio — no audio asset, no autoplay issues
 *  (only fires after the user has enabled sound with a click). */
function playBeep(ctxRef: { current: AudioContext | null }) {
  try {
    const ctx = ctxRef.current ?? (ctxRef.current = new AudioContext());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch {
    /* audio not available */
  }
}

export default function OrdiniClient({
  initialOrders,
  day,
}: {
  initialOrders: Order[];
  day: string;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [soundOn, setSoundOn] = useState(false);
  const [pending, setPending] = useState(false);

  const knownIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const audioRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(false);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // Reset when the selected day (or its server data) changes.
  useEffect(() => {
    setOrders(initialOrders);
    knownIds.current = new Set(initialOrders.map((o) => o.id));
  }, [initialOrders, day]);

  // Poll the live feed; ring once if a genuinely new unread order shows up.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/dashboard/novita?day=${encodeURIComponent(day)}`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (!alive || !d.ok) return;
        const next: Order[] = d.orders ?? [];
        const fresh = next.filter((o) => !knownIds.current.has(o.id));
        const newUnread = fresh.some((o) => !o.visto_at);
        next.forEach((o) => knownIds.current.add(o.id));
        setOrders(next);
        if (newUnread && soundOnRef.current) playBeep(audioRef);
      } catch {
        /* keep the last good list on a transient error */
      }
    }
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [day]);

  const unread = orders.filter((o) => !o.visto_at);

  function enableSound() {
    try {
      audioRef.current = audioRef.current ?? new AudioContext();
      void audioRef.current.resume?.();
    } catch {
      /* ignore */
    }
    setSoundOn(true);
    playBeep(audioRef);
  }

  async function segnaLetti() {
    if (!unread.length) return;
    setPending(true);
    const now = new Date().toISOString();
    try {
      await markOrdersRead(unread.map((o) => o.id));
      setOrders((prev) => prev.map((o) => (o.visto_at ? o : { ...o, visto_at: now })));
    } catch {
      /* ignore — next poll reconciles */
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {soundOn ? (
          <span className="text-sm text-neutral-500">🔔 Avvisi sonori attivi</span>
        ) : (
          <button
            onClick={enableSound}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            🔔 Attiva avvisi sonori
          </button>
        )}
        {unread.length > 0 && (
          <>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-sm font-semibold text-blue-700">
              {unread.length} {unread.length === 1 ? "nuovo" : "nuovi"}
            </span>
            <button
              onClick={segnaLetti}
              disabled={pending}
              className="text-sm text-neutral-600 hover:underline disabled:opacity-50"
            >
              Segna letti
            </button>
          </>
        )}
        <span className="ml-auto text-xs text-neutral-400">
          Aggiornamento automatico ogni 15s
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="text-neutral-500">Nessun ordine in questo giorno.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const b = statoBadge(o);
            const nuovo = !o.visto_at;
            return (
              <li
                key={o.id}
                className="rounded-xl border bg-white p-4 transition"
                style={{ borderColor: nuovo ? "#3b82f6" : "#e5e5e5" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {nuovo && (
                      <span className="mr-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
                        NUOVO
                      </span>
                    )}
                    <span className="font-medium">Tavolo {o.tavolo ?? "—"}</span>
                    <span className="ml-2 text-sm text-neutral-500">
                      {new Date(o.created_at).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}>
                      {b.text}
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold">
                    {formatEUR(Math.round(Number(o.totale) * 100))}
                  </span>
                </div>

                <ul className="mt-2 space-y-0.5 border-t border-neutral-100 pl-1 pt-2 text-sm">
                  {(o.items ?? []).map((it, i) => (
                    <li key={`${o.id}-${i}`} className="flex items-baseline justify-between gap-2">
                      <span className="text-neutral-700">
                        <span className="font-medium text-neutral-900">{it.qta}×</span> {it.nome}
                        {it.opzioni?.length ? (
                          <span className="text-neutral-400">
                            {" "}
                            ({it.opzioni.map((x) => x.scelta).join(", ")})
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-neutral-500">
                        {formatEUR(Math.round(Number(it.prezzo) * 100) * it.qta)}
                      </span>
                    </li>
                  ))}
                </ul>

                {(o.coperti || o.coperto_tot > 0 || o.mancia > 0 || o.note) && (
                  <p className="mt-2 pl-1 text-xs text-neutral-500">
                    {o.coperti ? `Coperti: ${o.coperti}` : ""}
                    {o.coperto_tot > 0
                      ? ` · Coperto: ${formatEUR(Math.round(Number(o.coperto_tot) * 100))}`
                      : ""}
                    {o.mancia > 0
                      ? ` · Mancia: ${formatEUR(Math.round(Number(o.mancia) * 100))}`
                      : ""}
                    {o.note ? ` · 📝 ${o.note}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
