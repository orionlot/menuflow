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

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await action(restaurantId, state);
        setMsg("✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">
        Disponibilità per questo locale (sovrascrive il piano).
      </p>
      <div className="grid gap-1">
        {features.map((f) => (
          <label key={f.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {f.nome} <span className="text-neutral-400">(piano {f.pianoMinimo})</span>
            </span>
            <input
              type="checkbox"
              checked={state[f.id]}
              onChange={(e) => setState((s) => ({ ...s, [f.id]: e.target.checked }))}
            />
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        {pending ? "…" : "Salva disponibilità"}
        {msg && <span className="ml-1">{msg}</span>}
      </button>
    </div>
  );
}
