"use client";

import { useState, useTransition } from "react";
import type { BrandingPatch, CopertoModalita } from "@/types/db";

export default function ServiceSettings({
  initial,
  action,
}: {
  initial: {
    coperto: number;
    coperto_modalita: CopertoModalita;
    coperto_label: string;
    accetta_mancia: boolean;
    pagamenti_attivi: boolean;
  };
  action: (patch: BrandingPatch) => Promise<void>;
}) {
  const [mode, setMode] = useState<CopertoModalita>(initial.coperto_modalita ?? "nessuno");
  const [coperto, setCoperto] = useState(String(initial.coperto ?? 0));
  const [label, setLabel] = useState(initial.coperto_label || "Coperto");
  const [mancia, setMancia] = useState(Boolean(initial.accetta_mancia));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await action({
          coperto: Math.max(0, parseFloat(coperto) || 0),
          coperto_modalita: mode,
          coperto_label: label.trim() || "Coperto",
          accetta_mancia: mancia,
        });
        setMsg("Salvato ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore nel salvataggio.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 text-xs font-medium text-neutral-500">Coperto</div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-neutral-400">Modalità</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as CopertoModalita)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="nessuno">Nessuno</option>
            <option value="persona">Per persona</option>
            <option value="ordine">Fisso per ordine</option>
            <option value="servizio">Servizio %</option>
          </select>
        </div>
        {mode !== "nessuno" && (
          <>
            <div>
              <label className="mb-1 block text-[11px] text-neutral-400">
                {mode === "servizio"
                  ? "Percentuale (%)"
                  : mode === "ordine"
                    ? "Importo (€ a ordine)"
                    : "Importo (€ a persona)"}
              </label>
              <input
                type="number"
                step={mode === "servizio" ? "1" : "0.5"}
                min="0"
                value={coperto}
                onChange={(e) => setCoperto(e.target.value)}
                className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-neutral-400">Etichetta</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Coperto"
                className="w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </>
        )}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mancia} onChange={(e) => setMancia(e.target.checked)} />
        Accetta mancia {initial.pagamenti_attivi ? "" : "(richiede i pagamenti online attivi)"}
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva servizio"}
        </button>
        {msg && <span className="text-sm text-neutral-500">{msg}</span>}
      </div>
    </div>
  );
}
