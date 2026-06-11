"use client";

import { useState, useTransition } from "react";
import { PLANS, type PlanId } from "@/lib/config/plans";

interface Row {
  id: string;
  nome: string;
  descrizione: string;
  pianoMinimo: PlanId;
  entitled: boolean;
  on: boolean;
}

export default function FeaturesOwner({
  features,
  action,
}: {
  features: Row[];
  action: (m: Record<string, boolean>) => Promise<void>;
}) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(features.map((f) => [f.id, f.on])),
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await action(state);
        setMsg("Salvato ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore nel salvataggio.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {features.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="font-medium">{f.nome}</div>
              <div className="text-sm text-neutral-500">{f.descrizione}</div>
              {!f.entitled && (
                <div className="mt-0.5 text-xs text-amber-600">
                  Disponibile dal piano {PLANS[f.pianoMinimo].label}
                </div>
              )}
            </div>
            {f.entitled ? (
              <button
                type="button"
                role="switch"
                aria-checked={state[f.id]}
                onClick={() => setState((s) => ({ ...s, [f.id]: !s[f.id] }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  state[f.id] ? "bg-green-500" : "bg-neutral-300"
                }`}
                aria-label={f.nome}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                  style={{ left: state[f.id] ? 22 : 2 }}
                />
              </button>
            ) : (
              <span
                className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-400"
                title="Non disponibile col tuo piano"
              >
                🔒
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        {msg && <span className="text-sm text-neutral-500">{msg}</span>}
      </div>
    </div>
  );
}
