"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brandPalette } from "@/lib/brand";

export type TrackedOrder = {
  id: string;
  fase: "attesa_pagamento" | "fallito" | "ricevuto" | "in_preparazione" | "pronto" | "servito";
  stato: string;
  preparazione_at: string | null;
  pronto_at: string | null;
  servito_at: string | null;
  created_at: string;
  tempo_stimato: number | null;
  asporto: boolean;
  tavolo: string | null;
  totale: number;
  items: { nome: string; qta: number }[];
};

const STEPS: { fase: TrackedOrder["fase"]; label: string; icon: string }[] = [
  { fase: "ricevuto", label: "Ricevuto", icon: "📥" },
  { fase: "in_preparazione", label: "In preparazione", icon: "👨‍🍳" },
  { fase: "pronto", label: "Pronto", icon: "🔔" },
  { fase: "servito", label: "Servito", icon: "✅" },
];
const STEP_ORDER: TrackedOrder["fase"][] = ["ricevuto", "in_preparazione", "pronto", "servito"];

function eur(n: number) {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default function OrderTracker({
  initial,
  nome,
  colorePrimario,
  coloreSecondario,
  tema,
}: {
  initial: TrackedOrder;
  nome: string;
  colorePrimario: string;
  coloreSecondario?: string | null;
  tema: "light" | "dark";
}) {
  const p = brandPalette(colorePrimario, tema, coloreSecondario);
  const [o, setO] = useState<TrackedOrder>(initial);
  const [now, setNow] = useState(() => Date.now());

  // Poll the public status endpoint while the order is still in progress.
  // The interval restarts on every phase change, so an actively-progressing
  // order keeps polling; a STUCK phase (e.g. an abandoned online payment) stops
  // after ~10 min so we don't poll forever.
  useEffect(() => {
    if (o.fase === "servito" || o.fase === "fallito") return;
    let alive = true;
    let polls = 0;
    const MAX_POLLS = 75; // ~10 min at 8s
    const load = async () => {
      try {
        const r = await fetch(`/api/ordine/${initial.id}`, { cache: "no-store" });
        const d = await r.json();
        if (!alive || !d.ok) return;
        setO((prev) => ({ ...prev, ...d }));
      } catch {
        /* keep last state */
      }
    };
    const t = setInterval(() => {
      if (++polls > MAX_POLLS) {
        clearInterval(t);
        return;
      }
      load();
    }, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [initial.id, o.fase]);

  // 1s countdown tick only while a dish is actually being prepared.
  useEffect(() => {
    if (o.fase !== "in_preparazione") return;
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(c);
  }, [o.fase]);

  const currentIdx = STEP_ORDER.indexOf(o.fase === "attesa_pagamento" ? "ricevuto" : o.fase);

  // Countdown while in preparation.
  let countdown: string | null = null;
  if (o.fase === "in_preparazione" && o.preparazione_at && o.tempo_stimato) {
    const remaining = new Date(o.preparazione_at).getTime() + o.tempo_stimato * 60000 - now;
    const late = remaining < 0;
    const abs = Math.abs(remaining);
    const mm = Math.floor(abs / 60000);
    countdown = late ? `da ${mm} min oltre la stima` : `circa ${mm + 1} min`;
  }

  const dest = o.asporto ? `Ritiro · ${o.tavolo ?? "—"}` : `Tavolo ${o.tavolo ?? "—"}`;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: p.pageBg, color: p.text }}>
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: p.text }}>
            {nome}
          </h1>
          <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
            {dest} · {eur(o.totale)}
          </p>
        </div>

        {o.fase === "fallito" ? (
          <div className="mt-6 rounded-2xl border p-5 text-center" style={{ background: p.surface, borderColor: p.surfaceBorder }}>
            <p className="text-lg font-semibold text-red-600">Pagamento non riuscito</p>
            <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
              Rivolgiti allo staff per completare l&apos;ordine.
            </p>
          </div>
        ) : o.fase === "attesa_pagamento" ? (
          <div className="mt-6 rounded-2xl border p-5 text-center" style={{ background: p.surface, borderColor: p.surfaceBorder }}>
            <p className="text-lg font-semibold" style={{ color: p.text }}>
              In attesa di pagamento
            </p>
            <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
              Completa il pagamento per inviare l&apos;ordine in cucina.
            </p>
          </div>
        ) : (
          <>
            {/* Big current-state banner */}
            <div
              className="mt-6 rounded-2xl p-6 text-center"
              style={{ background: o.fase === "pronto" || o.fase === "servito" ? p.brand : p.surface, color: o.fase === "pronto" || o.fase === "servito" ? p.onBrand : p.text, border: `1px solid ${p.surfaceBorder}` }}
            >
              <div className="text-5xl">{STEPS[Math.max(0, currentIdx)].icon}</div>
              <p className="mt-2 text-xl font-bold">{STEPS[Math.max(0, currentIdx)].label}</p>
              {countdown && (
                <p className="mt-1 text-sm opacity-90">⏱ {countdown}</p>
              )}
              {o.fase === "pronto" && <p className="mt-1 text-sm opacity-90">Il tuo ordine è pronto!</p>}
            </div>

            {/* Stepper */}
            <ol className="mt-6 space-y-3">
              {STEPS.map((s, i) => {
                const doneStep = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <li key={s.fase} className="flex items-center gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold"
                      style={
                        doneStep || active
                          ? { background: p.brand, color: p.onBrand }
                          : { background: p.surface, color: p.textMuted, border: `1px solid ${p.surfaceBorder}` }
                      }
                    >
                      {doneStep ? "✓" : i + 1}
                    </span>
                    <span
                      className={`text-base ${active ? "font-bold" : "font-medium"}`}
                      style={{ color: doneStep || active ? p.text : p.textMuted }}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {/* Order summary */}
        {o.items.length > 0 && (
          <div className="mt-6 rounded-2xl border p-4" style={{ background: p.surface, borderColor: p.surfaceBorder }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: p.textMuted }}>
              Il tuo ordine
            </p>
            <ul className="space-y-1">
              {o.items.map((it, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span style={{ color: p.text }}>
                    <span className="font-bold">{it.qta}×</span> {it.nome}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-block rounded-xl px-5 py-2.5 text-sm font-semibold"
            style={{ background: p.brand, color: p.onBrand }}
          >
            Torna al menu
          </Link>
        </div>
      </div>
    </main>
  );
}
