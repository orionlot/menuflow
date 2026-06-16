"use client";

import { useState, useTransition } from "react";
import type { Chiusura } from "@/types/db";

type Stato = "auto" | "aperto" | "chiuso";

function statoOf(override: boolean | null): Stato {
  return override === true ? "aperto" : override === false ? "chiuso" : "auto";
}

const OPTS: { v: Stato; l: string; hint: string }[] = [
  { v: "auto", l: "Automatico", hint: "Segue orari e chiusure" },
  { v: "aperto", l: "Aperto", hint: "Forza aperto" },
  { v: "chiuso", l: "Chiuso", hint: "Forza chiuso ora" },
];

export default function DisponibilitaSettings({
  initialOverride,
  initialChiusure,
  setStato,
  setChiusure,
}: {
  initialOverride: boolean | null;
  initialChiusure: Chiusura[];
  setStato: (stato: string) => Promise<void>;
  setChiusure: (chiusure: unknown) => Promise<void>;
}) {
  const [stato, setStatoLocal] = useState<Stato>(statoOf(initialOverride));
  const [rows, setRows] = useState<Chiusura[]>(initialChiusure ?? []);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function chooseStato(v: Stato) {
    const prev = stato;
    setStatoLocal(v);
    startTransition(async () => {
      try {
        await setStato(v);
      } catch {
        setStatoLocal(prev); // revert on failure
      }
    });
  }

  function addRow() {
    setRows((r) => [...r, { da: "", motivo: "" }]);
  }
  function patchRow(i: number, patch: Partial<Chiusura>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, j) => j !== i));
  }
  function saveChiusure() {
    setMsg(null);
    const clean = rows.filter((r) => r.da);
    startTransition(async () => {
      try {
        await setChiusure(clean);
        setRows(clean);
        setMsg("Salvato ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Manual open/close override */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-1 text-xs font-medium text-neutral-500">Apertura del locale</div>
        <p className="mb-2 text-[11px] text-neutral-400">
          Apri o chiudi al volo, sovrascrivendo gli orari fissi. «Automatico» segue orari e
          chiusure programmate.
        </p>
        <div className="inline-flex flex-wrap gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {OPTS.map((o) => {
            const on = stato === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => chooseStato(o.v)}
                disabled={pending}
                title={o.hint}
                aria-pressed={on}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  on
                    ? o.v === "chiuso"
                      ? "bg-red-600 text-white"
                      : o.v === "aperto"
                        ? "bg-green-600 text-white"
                        : "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {o.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scheduled closures */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-1 text-xs font-medium text-neutral-500">Chiusure programmate</div>
        <p className="mb-2 text-[11px] text-neutral-400">
          Festività o giorni di chiusura straordinaria. Nei giorni indicati il locale risulta
          chiuso (lascia vuota la «fine» per un solo giorno).
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-400">Nessuna chiusura programmata.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="date"
                  value={r.da}
                  onChange={(e) => patchRow(i, { da: e.target.value })}
                  className="rounded-md border border-neutral-300 px-2 py-1"
                  aria-label="Data inizio"
                />
                <span className="text-neutral-400">→</span>
                <input
                  type="date"
                  value={r.a ?? ""}
                  min={r.da || undefined}
                  onChange={(e) => patchRow(i, { a: e.target.value || undefined })}
                  className="rounded-md border border-neutral-300 px-2 py-1"
                  aria-label="Data fine (facoltativa)"
                />
                <input
                  type="text"
                  value={r.motivo ?? ""}
                  onChange={(e) => patchRow(i, { motivo: e.target.value })}
                  placeholder="Motivo (es. Ferie)"
                  maxLength={80}
                  className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Rimuovi chiusura"
                  className="rounded-md px-2 py-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            + Aggiungi chiusura
          </button>
          <button
            onClick={saveChiusure}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            {pending ? "…" : "Salva chiusure"}
          </button>
          {msg && (
            <span className={`text-sm ${msg.endsWith("✓") ? "text-green-600" : "text-neutral-500"}`}>
              {msg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
