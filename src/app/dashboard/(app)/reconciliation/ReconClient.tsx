"use client";

import { useState, useTransition } from "react";
import type { Order } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import { toggleScontrino } from "@/app/dashboard/actions";

export default function ReconClient({ orders }: { orders: Order[] }) {
  const [local, setLocal] = useState(orders);
  const [pending, startTransition] = useTransition();

  function toggle(o: Order) {
    const next = !o.scontrino_registrato;
    setLocal((prev) =>
      prev.map((x) => (x.id === o.id ? { ...x, scontrino_registrato: next } : x)),
    );
    startTransition(async () => {
      try {
        await toggleScontrino(o.id, next);
      } catch {
        setLocal((prev) =>
          prev.map((x) =>
            x.id === o.id ? { ...x, scontrino_registrato: !next } : x,
          ),
        );
      }
    });
  }

  if (local.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
        <p className="font-medium text-neutral-700">
          Nessun pagamento in questo giorno.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          I pagamenti incassati in app compariranno qui.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {local.map((o) => (
        <li
          key={o.id}
          className="rounded-xl border border-neutral-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <label className="flex flex-1 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={o.scontrino_registrato}
                onChange={() => toggle(o)}
                disabled={pending}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
              />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">Tavolo {o.tavolo ?? "—"}</span>
                <span className="text-sm text-neutral-500">
                  {o.pagato_at
                    ? new Date(o.pagato_at).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    o.scontrino_registrato
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {o.scontrino_registrato
                    ? "scontrino registrato"
                    : "da registrare"}
                </span>
              </span>
            </label>
            <span className="shrink-0 font-semibold">
              {formatEUR(Math.round(Number(o.totale) * 100))}
            </span>
          </div>

          {/* Dettaglio prodotti dell'ordine */}
          <ul className="mt-2 space-y-0.5 border-t border-neutral-100 pl-4 pt-2 text-sm sm:pl-8">
            {(o.items ?? []).map((it, i) => (
              <li
                key={`${o.id}-${it.item_id || i}`}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-neutral-700">
                  <span className="font-medium text-neutral-900">{it.qta}×</span>{" "}
                  {it.nome}
                </span>
                <span className="shrink-0 text-neutral-500">
                  {formatEUR(Math.round(Number(it.prezzo) * 100) * it.qta)}
                </span>
              </li>
            ))}
          </ul>

          {o.note && (
            <p className="mt-2 pl-4 text-sm text-neutral-500 sm:pl-8">
              📝 <span className="italic">{o.note}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
