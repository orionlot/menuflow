"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, ServiceRequest } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import { isMapsUrl } from "@/lib/urls";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { markOrdersRead } from "@/app/dashboard/actions";
import ManualOrderModal from "./ManualOrderModal";

export type PickerItem = { id: string; nome: string; prezzo: number; categoria: string; disponibile: boolean };

type OrdiniActions = {
  annullaOrdine: (id: string, annulla?: boolean) => Promise<void>;
  markServiceRequestHandled: (id: string) => Promise<void>;
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

const BADGE_BASE = "rounded-full px-2 py-0.5 text-[11px] font-semibold";
type StateKey = "annullato" | "in_attesa" | "fallito" | "servito" | "pronto" | "in_preparazione";

function orderState(o: Order): StateKey {
  if (o.annullato_at) return "annullato";
  if (o.stato === "in_attesa_pagamento") return "in_attesa";
  if (o.stato === "fallito") return "fallito";
  if (o.servito_at) return "servito";
  if (o.pronto_at) return "pronto";
  return "in_preparazione";
}
function statoBadge(o: Order): { text: string; cls: string } {
  switch (orderState(o)) {
    case "annullato":
      return { text: "Annullato", cls: "bg-neutral-200 text-neutral-500 line-through" };
    case "in_attesa":
      return { text: "In attesa pagamento", cls: "bg-amber-100 text-amber-700" };
    case "fallito":
      return { text: "Pagamento fallito", cls: "bg-red-100 text-red-700" };
    case "servito":
      return { text: "Servito", cls: "bg-neutral-100 text-neutral-500" };
    case "pronto":
      return { text: "Pronto", cls: "bg-green-100 text-green-700" };
    default:
      return { text: "In preparazione", cls: "bg-sky-100 text-sky-700" };
  }
}

const STATE_FILTERS: { key: StateKey | "all"; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "in_preparazione", label: "In preparazione" },
  { key: "pronto", label: "Pronto" },
  { key: "servito", label: "Servito" },
  { key: "in_attesa", label: "Attesa pagamento" },
  { key: "annullato", label: "Annullati" },
];
const TIPO_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Tutti i tipi" },
  { key: "tavolo", label: "Tavolo" },
  { key: "asporto", label: "Asporto" },
  { key: "delivery", label: "Delivery" },
];
const ORARIO_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Tutto il giorno" },
  { key: "pranzo", label: "Pranzo" },
  { key: "cena", label: "Cena" },
];

function tipoLabel(o: Order): string {
  const t = o.tipo ?? (o.asporto ? "asporto" : "tavolo");
  if (t === "delivery") return `🛵 Delivery · ${o.tavolo ?? "—"}`;
  if (t === "asporto") return `🛍 Asporto · ${o.tavolo ?? "—"}`;
  return `Tavolo ${o.tavolo ?? "—"}`;
}
function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

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
  initialRequests,
  pickerItems,
  day,
  restaurantId,
  stampaOn,
  riepilogoOn,
  asportoOn,
  deliveryOn,
  ordineManualeOn,
  richiestaServizioOn,
  copertoModalita,
  actions,
}: {
  initialOrders: Order[];
  initialRequests: ServiceRequest[];
  pickerItems: PickerItem[];
  day: string;
  restaurantId: string;
  stampaOn: boolean;
  riepilogoOn: boolean;
  asportoOn: boolean;
  deliveryOn: boolean;
  ordineManualeOn: boolean;
  richiestaServizioOn: boolean;
  copertoModalita: string;
  actions: OrdiniActions;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [soundOn, setSoundOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [stato, setStato] = useState<StateKey | "all">("all");
  const [tipo, setTipo] = useState("all");
  const [orario, setOrario] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const knownIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const audioRef = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(false);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    setOrders(initialOrders);
    knownIds.current = new Set(initialOrders.map((o) => o.id));
  }, [initialOrders, day]);
  useEffect(() => setRequests(initialRequests), [initialRequests]);

  // Poll the live order feed; ring once on a genuinely new unread order.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/dashboard/novita?day=${encodeURIComponent(day)}`, { cache: "no-store" });
        const d = await r.json();
        if (!alive || !d.ok) return;
        const next: Order[] = d.orders ?? [];
        const fresh = next.filter((o) => !knownIds.current.has(o.id));
        const newUnread = fresh.some((o) => !o.visto_at);
        next.forEach((o) => knownIds.current.add(o.id));
        setOrders(next);
        if (newUnread && soundOnRef.current) playBeep(audioRef);
      } catch {
        /* keep last list */
      }
    }
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [day]);

  // Realtime service requests (call-waiter / ask-bill).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel(`service-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_requests", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = payload.new as ServiceRequest | undefined;
          if (payload.eventType === "INSERT" && row) {
            setRequests((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
            if (soundOnRef.current) playBeep(audioRef);
          } else if (payload.eventType === "UPDATE" && row?.gestita_at) {
            setRequests((prev) => prev.filter((r) => r.id !== row.id));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  const unread = orders.filter((o) => !o.visto_at);
  const sales = orders.filter((o) => !o.annullato_at && (o.stato === "ricevuto" || o.stato === "pagato"));
  const incassoCents = sales.reduce((s, o) => s + Math.round(Number(o.totale) * 100), 0);
  const daBattere = sales.filter((o) => o.stato === "pagato" && !o.scontrino_registrato).length;

  const visible = useMemo(() => {
    return orders.filter((o) => {
      if (stato !== "all" && orderState(o) !== stato) return false;
      const t = o.tipo ?? (o.asporto ? "asporto" : "tavolo");
      if (tipo !== "all" && t !== tipo) return false;
      if (orario !== "all") {
        const h = new Date(o.created_at).getHours();
        const isCena = h >= 16 || h < 5;
        if (orario === "cena" && !isCena) return false;
        if (orario === "pranzo" && isCena) return false;
      }
      return true;
    });
  }, [orders, stato, tipo, orario]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

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
      /* next poll reconciles */
    } finally {
      setPending(false);
    }
  }
  function annulla(o: Order, annulla = true) {
    const now = new Date().toISOString();
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, annullato_at: annulla ? now : null } : x)));
    void actions.annullaOrdine(o.id, annulla).catch(() => router.refresh());
  }
  function gestisci(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    void actions.markServiceRequestHandled(id).catch(() => router.refresh());
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Ordini</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            defaultValue={day}
            onChange={(e) => router.push(`/dashboard/ordini?day=${e.target.value}`)}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          />
          {ordineManualeOn && (
            <button
              onClick={() => setManualOpen(true)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-700"
            >
              + Nuovo ordine
            </button>
          )}
        </div>
      </div>

      {riepilogoOn && (
        <div className="mb-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm">
          <span className="font-semibold">Riepilogo di oggi:</span> {sales.length} ordini · incasso{" "}
          {formatEUR(incassoCents)} · {daBattere} scontrini da battere
        </div>
      )}

      {/* Service requests (call-waiter / ask-bill) */}
      {richiestaServizioOn && requests.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            🛎 Richieste dai tavoli ({requests.length})
          </p>
          <ul className="flex flex-wrap gap-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm"
              >
                <span className="font-medium">
                  {r.tipo === "conto" ? "🧾 Conto" : "🛎 Cameriere"} · {r.tavolo}
                </span>
                <span className="text-xs text-neutral-400">{hhmm(r.created_at)}</span>
                <button
                  onClick={() => gestisci(r.id)}
                  className="rounded-md bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-neutral-700"
                >
                  Gestita
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sound + unread */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {soundOn ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-[var(--brand-ring)]">
            🔔 Avvisi sonori attivi
          </span>
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
            <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-sm font-semibold text-brand">
              {unread.length} {unread.length === 1 ? "nuovo" : "nuovi"}
            </span>
            <button onClick={segnaLetti} disabled={pending} className="text-sm text-neutral-600 hover:underline disabled:opacity-50">
              Segna letti
            </button>
          </>
        )}
        <span className="ml-auto text-xs text-neutral-400">Aggiornamento automatico ogni 15s</span>
      </div>

      {/* Filters */}
      <div className="mb-3 space-y-2">
        <FilterRow options={STATE_FILTERS} value={stato} onChange={(k) => setStato(k as StateKey | "all")} />
        <div className="flex flex-wrap gap-2">
          <FilterRow options={TIPO_FILTERS} value={tipo} onChange={setTipo} small />
          <FilterRow options={ORARIO_FILTERS} value={orario} onChange={setOrario} small />
        </div>
      </div>

      {/* 3-pane: list + detail */}
      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">Nessun ordine in questo giorno.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* List */}
          <ul className="space-y-2">
            {visible.length === 0 ? (
              <li className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-600">
                Nessun ordine con questi filtri.
              </li>
            ) : (
              visible.map((o) => {
                const b = statoBadge(o);
                const nuovo = !o.visto_at && !o.annullato_at;
                return (
                  <li key={o.id}>
                    <button
                      onClick={() => setSelectedId(o.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border bg-white p-3 text-left transition hover:border-neutral-300 ${
                        selectedId === o.id ? "border-brand ring-1 ring-[var(--brand-ring)]" : "border-neutral-200"
                      } ${o.annullato_at ? "opacity-60" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {nuovo && <span className={`bg-[var(--brand-soft)] text-brand ${BADGE_BASE}`}>NUOVO</span>}
                          <span className="truncate font-medium">{tipoLabel(o)}</span>
                          <span className="text-xs text-neutral-400">{hhmm(o.created_at)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className={`${BADGE_BASE} ${b.cls}`}>{b.text}</span>
                          {o.sala && <span className="text-xs text-neutral-400">· {o.sala}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold">{formatEUR(Math.round(Number(o.totale) * 100))}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {/* Detail (desktop) */}
          <div className="hidden lg:block">
            {selected ? (
              <div className="sticky top-4">
                <DetailPane order={selected} stampaOn={stampaOn} onAnnulla={annulla} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                Seleziona un ordine per vederne i dettagli.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail (mobile modal) */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 lg:hidden" onClick={() => setSelectedId(null)}>
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => setSelectedId(null)} aria-label="Chiudi" className="text-2xl leading-none text-neutral-400">
                ×
              </button>
            </div>
            <DetailPane order={selected} stampaOn={stampaOn} onAnnulla={annulla} />
          </div>
        </div>
      )}

      {manualOpen && (
        <ManualOrderModal
          items={pickerItems}
          asportoOn={asportoOn}
          deliveryOn={deliveryOn}
          copertoModalita={copertoModalita}
          onClose={() => setManualOpen(false)}
          onCreate={async (input) => {
            await actions.createManualOrder(input);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FilterRow({
  options,
  value,
  onChange,
  small = false,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
  small?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          aria-pressed={value === f.key}
          className={`rounded-full font-medium transition ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1 text-sm"} ${
            value === f.key
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-[var(--brand-soft)] hover:text-brand"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function DetailPane({
  order: o,
  stampaOn,
  onAnnulla,
}: {
  order: Order;
  stampaOn: boolean;
  onAnnulla: (o: Order, annulla?: boolean) => void;
}) {
  const b = statoBadge(o);
  const steps: { label: string; at: string | null }[] = [
    { label: "Ricevuto", at: o.created_at },
    { label: "In preparazione", at: o.preparazione_at },
    { label: "Pronto", at: o.pronto_at },
    { label: "Servito", at: o.servito_at },
  ];
  if (o.pagato_at) steps.push({ label: "Pagato", at: o.pagato_at });
  if (o.annullato_at) steps.push({ label: "Annullato", at: o.annullato_at });

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{tipoLabel(o)}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <span className={`${BADGE_BASE} ${b.cls}`}>{b.text}</span>
            <span>{hhmm(o.created_at)}</span>
            {o.sala && <span>· {o.sala}</span>}
            {o.voto ? <span className="font-semibold text-amber-600">★ {o.voto}/5</span> : null}
          </div>
          {o.indirizzo && <p className="mt-1 text-sm text-neutral-600">📍 {o.indirizzo}</p>}
          {o.posizione && isMapsUrl(o.posizione) && (
            <a
              href={o.posizione}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm font-medium text-brand hover:underline"
            >
              🗺 Apri posizione in Maps
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {stampaOn && (
            <button
              onClick={() => window.open(`/dashboard/stampa/${o.id}`, "_blank")}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
            >
              🖨 Stampa
            </button>
          )}
          {o.annullato_at ? (
            <button
              onClick={() => onAnnulla(o, false)}
              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
            >
              Ripristina
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm("Annullare questo ordine?")) onAnnulla(o, true);
              }}
              className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Annulla ordine
            </button>
          )}
        </div>
      </div>

      {/* Cronologia */}
      <ol className="mt-4 space-y-1.5 border-t border-neutral-100 pt-3">
        {steps
          .filter((s) => s.at)
          .map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="text-neutral-700">{s.label}</span>
              <span className="ml-auto text-neutral-400">{hhmm(s.at!)}</span>
            </li>
          ))}
      </ol>

      {/* Piatti */}
      <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm">
        {(o.items ?? []).map((it, i) => (
          <li key={`${o.id}-${i}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-neutral-700">
                <span className="font-medium text-neutral-900">{it.qta}×</span> {it.nome}
                {it.taglia ? <span className="font-medium text-neutral-500"> · {it.taglia}</span> : null}
                {it.opzioni?.length ? (
                  <span className="text-neutral-400"> ({it.opzioni.map((x) => x.scelta).join(", ")})</span>
                ) : null}
              </span>
              <span className="shrink-0 text-neutral-500">{formatEUR(Math.round(Number(it.prezzo) * 100) * it.qta)}</span>
            </div>
            {it.composizione?.length ? (
              <ul className="mt-0.5 space-y-0.5 pl-5 text-xs text-neutral-500">
                {it.composizione.map((c, ci) => (
                  <li key={ci}>
                    {c.qta}× {c.nome}
                    {Number(c.prezzo) > 0 ? ` (+${formatEUR(Math.round(Number(c.prezzo) * 100))})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {it.nota ? <p className="mt-0.5 pl-5 text-xs italic text-amber-700">📝 {it.nota}</p> : null}
          </li>
        ))}
      </ul>

      {/* Totals */}
      <div className="mt-3 space-y-0.5 border-t border-neutral-100 pt-3 text-sm">
        {o.coperti ? (
          <div className="flex justify-between text-neutral-500">
            <span>Coperti ({o.coperti})</span>
            <span>{formatEUR(Math.round(Number(o.coperto_tot) * 100))}</span>
          </div>
        ) : o.coperto_tot > 0 ? (
          <div className="flex justify-between text-neutral-500">
            <span>Coperto</span>
            <span>{formatEUR(Math.round(Number(o.coperto_tot) * 100))}</span>
          </div>
        ) : null}
        {o.mancia > 0 && (
          <div className="flex justify-between text-neutral-500">
            <span>Mancia</span>
            <span>{formatEUR(Math.round(Number(o.mancia) * 100))}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 text-base font-bold">
          <span>Totale</span>
          <span>{formatEUR(Math.round(Number(o.totale) * 100))}</span>
        </div>
      </div>

      {o.note && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">📝 {o.note}</p>
      )}
    </div>
  );
}
