"use client";

import { useState, useTransition } from "react";
import type { PlanId } from "@/lib/config/plans";

interface Row {
  id: string;
  nome: string;
  pianoMinimo: PlanId;
  available: boolean;
}

export default function FeaturesAdmin({
  restaurantId,
  features,
  action,
}: {
  restaurantId: string;
  features: Row[];
  action: (id: string, m: Record<string, boolean>) => Promise<void>;
}) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(features.map((f) => [f.id, f.available])),
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [ok, setOk] = useState(false);

  function save() {
    setMsg(null);
    setOk(false);
    startTransition(async () => {
      try {
        await action(restaurantId, state);
        setOk(true);
        setMsg("Salvato ✓");
      } catch (e) {
        setOk(false);
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-neutral-600">
        Disponibilità per questo locale (sovrascrive il piano).
      </p>
      <div className="grid gap-1.5">
        {features.map((f) => (
          <label
            key={f.id}
            className="flex items-center justify-between gap-2 rounded-lg p-1.5 text-sm hover:bg-neutral-50"
          >
            <span>
              {f.nome}{" "}
              <span className="text-neutral-400">(piano {f.pianoMinimo})</span>
            </span>
            <input
              type="checkbox"
              checked={state[f.id]}
              onChange={(e) =>
                setState((s) => ({ ...s, [f.id]: e.target.checked }))
              }
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          {pending ? "Salvataggio…" : "Salva disponibilità"}
        </button>
        {msg && (
          <span
            className={
              "text-sm font-medium " +
              (ok ? "text-green-700" : "text-red-700")
            }
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
