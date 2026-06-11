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
    return <p className="text-neutral-500">Nessun pagamento in questo giorno.</p>;
  }

  return (
    <ul className="space-y-3">
      {local.map((o) => (
        <li
          key={o.id}
          className="rounded-xl border border-neutral-200 bg-white p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <label className="flex flex-1 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={o.scontrino_registrato}
                onChange={() => toggle(o)}
                disabled={pending}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                <span className="font-medium">Tavolo {o.tavolo ?? "—"}</span>
                <span className="ml-2 text-sm text-neutral-500">
                  {o.pagato_at
                    ? new Date(o.pagato_at).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
                <span
                  className={`ml-2 text-xs ${
                    o.scontrino_registrato ? "text-green-600" : "text-amber-600"
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
          <ul className="mt-2 space-y-0.5 border-t border-neutral-100 pl-8 pt-2 text-sm">
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
            <p className="mt-2 pl-8 text-sm text-neutral-500">
              📝 <span className="italic">{o.note}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
