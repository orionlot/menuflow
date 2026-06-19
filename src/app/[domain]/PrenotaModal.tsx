"use client";

import { useState } from "react";
import type { Palette } from "@/lib/brand";
import type { Sala } from "@/types/db";

/** "Prenota un tavolo" — trigger button + request form (gated by `prenotazioni`).
 *  Sends a reservation REQUEST; the restaurateur confirms/declines from the
 *  dashboard. No availability engine. */
export default function PrenotaModal({
  slug,
  p,
  sale = [],
}: {
  slug: string;
  p: Palette;
  sale?: Sala[];
}) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [data, setData] = useState("");
  const [ora, setOra] = useState("");
  const [coperti, setCoperti] = useState(2);
  const [salaSel, setSalaSel] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  // Today (local) for the date picker minimum.
  const todayStr = new Intl.DateTimeFormat("en-CA").format(new Date());

  async function submit() {
    setErr(null);
    if (nome.trim().length < 2) return setErr("Inserisci il tuo nome.");
    if (telefono.trim().length < 6) return setErr("Inserisci un numero di telefono valido.");
    if (!data) return setErr("Scegli una data.");
    if (!ora) return setErr("Scegli un orario.");
    setState("sending");
    try {
      const res = await fetch("/api/prenota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, nome, telefono, data, ora, coperti, sala: salaSel, note }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setState("error");
        setErr(j?.error ?? "Errore durante l'invio. Riprova.");
        return;
      }
      setState("ok");
    } catch {
      setState("error");
      setErr("Errore di rete. Riprova.");
    }
  }

  const field = "mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm transition active:scale-[0.99]"
        style={{ background: p.brand, color: p.onBrand }}
      >
        📅 Prenota un tavolo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
            style={{ background: p.surface, color: p.text }}
            role="dialog"
            aria-modal="true"
            aria-label="Prenota un tavolo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Prenota un tavolo</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
                className="text-2xl leading-none"
                style={{ color: p.textMuted }}
              >
                ×
              </button>
            </div>

            {state === "ok" ? (
              <div className="py-6 text-center">
                <div className="text-4xl">✅</div>
                <p className="mt-3 font-semibold">Richiesta inviata!</p>
                <p className="mt-1 text-sm" style={{ color: p.textMuted }}>
                  Il locale ti contatterà per confermare la prenotazione.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 rounded-full px-5 py-2 text-sm font-bold"
                  style={{ background: p.brand, color: p.onBrand }}
                >
                  Chiudi
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <label className="block text-sm font-medium">
                  Nome
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Il tuo nome"
                    maxLength={80}
                    className={field}
                    style={{ borderColor: p.surfaceBorder, color: p.text }}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Telefono
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    type="tel"
                    placeholder="Es. 333 1234567"
                    maxLength={30}
                    className={field}
                    style={{ borderColor: p.surfaceBorder, color: p.text }}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Data
                    <input
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      type="date"
                      min={todayStr}
                      className={field}
                      style={{ borderColor: p.surfaceBorder, color: p.text }}
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Ora
                    <input
                      value={ora}
                      onChange={(e) => setOra(e.target.value)}
                      type="time"
                      className={field}
                      style={{ borderColor: p.surfaceBorder, color: p.text }}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Persone
                    <input
                      value={coperti}
                      onChange={(e) =>
                        setCoperti(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))
                      }
                      type="number"
                      min={1}
                      max={50}
                      className={field}
                      style={{ borderColor: p.surfaceBorder, color: p.text }}
                    />
                  </label>
                  {sale.length > 0 && (
                    <label className="block text-sm font-medium">
                      Sala (facoltativa)
                      <select
                        value={salaSel}
                        onChange={(e) => setSalaSel(e.target.value)}
                        className={field}
                        style={{ borderColor: p.surfaceBorder, color: p.text, background: p.surface }}
                      >
                        <option value="">—</option>
                        {sale.map((s) => (
                          <option key={s.id} value={s.nome}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <label className="block text-sm font-medium">
                  Note (facoltative)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Allergie, occasioni speciali…"
                    className={`${field} resize-none`}
                    style={{ borderColor: p.surfaceBorder, color: p.text }}
                  />
                </label>

                {err && <p className="text-sm font-medium text-red-500">{err}</p>}

                <button
                  onClick={submit}
                  disabled={state === "sending"}
                  className="w-full rounded-2xl py-3 text-sm font-bold transition active:scale-[0.99] disabled:opacity-60"
                  style={{ background: p.brand, color: p.onBrand }}
                >
                  {state === "sending" ? "Invio…" : "Invia richiesta"}
                </button>
                <p className="text-center text-[11px]" style={{ color: p.textMuted }}>
                  È una richiesta: la prenotazione è valida solo dopo la conferma del locale.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
