"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { brandPalette } from "@/lib/brand";

export type ItemFase = "in_attesa" | "a_seguire" | "in_preparazione" | "pronto" | "servito";

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
  items: { nome: string; qta: number; fase: ItemFase }[];
};

/** Per-dish status chip styling (theme-safe fixed accents). */
const ITEM_STATUS: Record<
  ItemFase,
  { label: string; dot: string; pill: (m: { textMuted: string; surfaceBorder: string }) => CSSProperties }
> = {
  in_attesa: {
    label: "In attesa",
    dot: "#9ca3af",
    pill: (m) => ({ background: "transparent", color: m.textMuted, border: `1px solid ${m.surfaceBorder}` }),
  },
  a_seguire: {
    label: "A seguire",
    dot: "#7c3aed",
    pill: () => ({ background: "#7c3aed", color: "#ffffff" }),
  },
  in_preparazione: {
    label: "In preparazione",
    dot: "#f59e0b",
    pill: () => ({ background: "#f59e0b", color: "#3a2a00" }),
  },
  pronto: {
    label: "Pronto",
    dot: "#16a34a",
    pill: () => ({ background: "#16a34a", color: "#ffffff" }),
  },
  servito: {
    label: "Servito",
    dot: "#16a34a",
    pill: (m) => ({ background: "transparent", color: m.textMuted, border: `1px solid ${m.surfaceBorder}` }),
  },
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
  reviewUrl,
  countdownOn = false,
  perDishOn = true,
  paymentReturn = false,
}: {
  initial: TrackedOrder;
  nome: string;
  colorePrimario: string;
  coloreSecondario?: string | null;
  tema: "light" | "dark";
  reviewUrl?: string | null;
  countdownOn?: boolean;
  perDishOn?: boolean;
  paymentReturn?: boolean;
}) {
  const p = brandPalette(colorePrimario, tema, coloreSecondario);
  const [o, setO] = useState<TrackedOrder>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [paying, setPaying] = useState(false);
  async function pay() {
    setPaying(true);
    try {
      const r = await fetch(`/api/ordine/${o.id}/pay`, { method: "POST" });
      const d = await r.json();
      if (d.ok && d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      if (d.ok && d.devSimulateAvailable) {
        await fetch(`/api/dev/simulate-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: o.id }),
        });
        window.location.reload();
        return;
      }
    } catch {
      /* keep state; user can retry */
    }
    setPaying(false);
  }

  // Poll the public status endpoint while the order is still in progress.
  // The interval restarts on every phase change, so an actively-progressing
  // order keeps polling; a STUCK phase (e.g. an abandoned online payment) stops
  // after ~10 min so we don't poll forever.
  useEffect(() => {
    if (o.fase === "servito" || (o.fase === "fallito" && !paymentReturn)) return;
    let alive = true;
    let polls = 0;
    const MAX_POLLS = 75; // ~10 min at 8s
    const load = async () => {
      try {
        const r = await fetch(`/api/ordine/${initial.id}`, { cache: "no-store" });
        const d = await r.json();
        if (!alive || !d.ok) return;
        setO((prev) => {
          const merged = { ...prev, ...d } as TrackedOrder;
          // Fold the per-dish phases (by line index) into the items we already hold.
          if (Array.isArray(d.itemFasi)) {
            merged.items = prev.items.map((it, i) => ({ ...it, fase: (d.itemFasi[i] as ItemFase) ?? it.fase }));
          } else {
            merged.items = prev.items;
          }
          return merged;
        });
      } catch {
        /* keep last state */
      }
    };
    load();
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
  }, [initial.id, o.fase, paymentReturn]);

  // 1s countdown tick only while a dish is being prepared AND the countdown is shown.
  useEffect(() => {
    if (!countdownOn || o.fase !== "in_preparazione") return;
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(c);
  }, [countdownOn, o.fase]);

  const currentIdx = STEP_ORDER.indexOf(o.fase === "attesa_pagamento" ? "ricevuto" : o.fase);

  // Countdown while in preparation.
  let countdown: string | null = null;
  if (countdownOn && o.fase === "in_preparazione" && o.preparazione_at && o.tempo_stimato) {
    const remaining = new Date(o.preparazione_at).getTime() + o.tempo_stimato * 60000 - now;
    const late = remaining < 0;
    const abs = Math.abs(remaining);
    const mm = Math.floor(abs / 60000);
    countdown = late ? `da ${mm} min oltre la stima` : `circa ${mm + 1} min`;
  }

  const dest = o.asporto ? `Ritiro · ${o.tavolo ?? "—"}` : `Tavolo ${o.tavolo ?? "—"}`;

  const readyCount = o.items.filter((it) => it.fase === "pronto" || it.fase === "servito").length;
  const pctReady = o.items.length ? Math.round((readyCount / o.items.length) * 100) : 0;
  // Per-dish chips (gated by the owner toggle); the progress count/bar only when it adds info.
  const perDish = perDishOn && o.fase !== "attesa_pagamento" && o.fase !== "fallito";
  const showProgress = perDish && o.items.length > 1;

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
              Puoi riprovare il pagamento qui sotto.
            </p>
            <button
              onClick={pay}
              disabled={paying}
              className="mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-60"
              style={{ background: p.brand, color: p.onBrand }}
            >
              {paying ? "…" : "Paga ora"}
            </button>
          </div>
        ) : o.fase === "attesa_pagamento" ? (
          <div className="mt-6 rounded-2xl border p-5 text-center" style={{ background: p.surface, borderColor: p.surfaceBorder }}>
            {paymentReturn ? (
              <>
                <p className="text-lg font-semibold" style={{ color: p.text }}>Pagamento in elaborazione…</p>
                <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
                  Attendi qualche secondo, stiamo confermando il pagamento.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold" style={{ color: p.text }}>In attesa di pagamento</p>
                <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
                  Completa il pagamento per inviare l&apos;ordine in cucina.
                </p>
              </>
            )}
            <button
              onClick={pay}
              disabled={paying}
              className="mt-4 w-full rounded-xl py-3 font-semibold disabled:opacity-60"
              style={{ background: p.brand, color: p.onBrand }}
            >
              {paying ? "…" : "Paga ora"}
            </button>
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
              {showProgress && o.fase === "in_preparazione" && (
                <p className="mt-1 text-sm opacity-90">{readyCount} di {o.items.length} piatti pronti</p>
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

        {/* Per-dish live status */}
        {o.items.length > 0 && (
          <div className="mt-6 rounded-2xl border p-4" style={{ background: p.surface, borderColor: p.surfaceBorder }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: p.textMuted }}>
                Il tuo ordine
              </p>
              {showProgress && (
                <span className="text-xs font-semibold tabular-nums" style={{ color: p.textMuted }}>
                  {readyCount}/{o.items.length} pronti
                </span>
              )}
            </div>

            {showProgress && (
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: p.surfaceBorder }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pctReady}%`, background: p.brand }} />
              </div>
            )}

            <ul className={perDish ? "space-y-2" : "space-y-1"}>
              {o.items.map((it, i) => {
                const s = ITEM_STATUS[it.fase];
                return (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2" style={{ color: p.text }}>
                      {perDish && (
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.dot }} />
                      )}
                      <span className="truncate">
                        <span className="font-bold">{it.qta}×</span> {it.nome}
                      </span>
                    </span>
                    {perDish && (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={s.pill({ textMuted: p.textMuted, surfaceBorder: p.surfaceBorder })}
                      >
                        {s.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {reviewUrl && (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 block rounded-2xl border p-4 text-center text-sm font-semibold"
            style={{ background: p.surface, borderColor: p.surfaceBorder, color: p.text }}
          >
            ⭐ Ti è piaciuto? Lascia una recensione
          </a>
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
