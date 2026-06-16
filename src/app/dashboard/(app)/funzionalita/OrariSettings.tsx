"use client";

import { useState, useTransition } from "react";
import type { Orari } from "@/types/db";

const GIORNI = [
  { n: 1, l: "Lun" },
  { n: 2, l: "Mar" },
  { n: 3, l: "Mer" },
  { n: 4, l: "Gio" },
  { n: 5, l: "Ven" },
  { n: 6, l: "Sab" },
  { n: 0, l: "Dom" },
];

export default function OrariSettings({
  initial,
  action,
}: {
  initial: Orari | null;
  action: (orari: unknown) => Promise<void>;
}) {
  const [giorni, setGiorni] = useState<number[]>(initial?.giorni ?? []);
  const [da, setDa] = useState(initial?.da ?? "12:00");
  const [a, setA] = useState(initial?.a ?? "23:00");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(n: number) {
    setGiorni((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  }
  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await action(giorni.length ? { giorni, da, a } : null);
        setMsg("Salvato ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-1 text-xs font-medium text-neutral-500">Orari di apertura</div>
      <p className="mb-2 text-[11px] text-neutral-400">
        Nessun giorno = sempre aperto. Fuori orario gli ordini sono bloccati (solo se la funzione
        “Orari di apertura” è attiva qui sotto).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {GIORNI.map((d) => {
          const on = giorni.includes(d.n);
          return (
            <button
              key={d.n}
              type="button"
              onClick={() => toggle(d.n)}
              className={`rounded-full px-3 py-1 text-sm ${
                on ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {d.l}
            </button>
          );
        })}
      </div>
      {giorni.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>dalle</span>
          <input
            type="time"
            value={da}
            onChange={(e) => setDa(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1"
          />
          <span>alle</span>
          <input
            type="time"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1"
          />
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "…" : "Salva orari"}
        </button>
        {msg && (
          <span
            className={`text-sm ${msg.endsWith("✓") ? "text-green-600" : "text-neutral-500"}`}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
