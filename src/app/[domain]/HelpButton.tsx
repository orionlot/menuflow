"use client";

import { useState } from "react";

interface Pal {
  surface: string;
  text: string;
  brand: string;
  onBrand: string;
  surfaceBorder: string;
  textMuted: string;
}

export default function HelpButton({
  slug,
  tavolo,
  p,
}: {
  slug: string;
  tavolo: string;
  p: Pal;
}) {
  const [open, setOpen] = useState(false);
  const [tav, setTav] = useState(tavolo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function call(tipo: "cameriere" | "conto") {
    if (!tav.trim()) {
      setMsg("Inserisci il numero del tavolo.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/chiamata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tavolo: tav, tipo }),
      });
      if (r.ok) {
        setMsg("Fatto! Lo staff è stato avvisato.");
        setTimeout(() => setOpen(false), 1500);
      } else {
        setMsg("Riprova tra poco.");
      }
    } catch {
      setMsg("Errore di rete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setTav(tavolo);
          setMsg(null);
          setOpen(true);
        }}
        className="rounded-full px-3 py-2 text-xs font-semibold shadow-lg"
        style={{ background: p.surface, color: p.text, border: `1px solid ${p.surfaceBorder}` }}
      >
        🔔 Serve aiuto?
      </button>

      {open && (
        <div
          className="mf-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="mf-sheet w-full max-w-[480px] rounded-t-3xl p-5 sm:rounded-3xl"
            style={{ background: p.surface, color: p.text }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold">Serve aiuto?</h2>
            <input
              value={tav}
              onChange={(e) => setTav(e.target.value)}
              placeholder="Numero tavolo"
              className="mt-3 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: p.surfaceBorder, color: p.text }}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                disabled={busy}
                onClick={() => call("cameriere")}
                className="rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                style={{ background: p.brand, color: p.onBrand }}
              >
                🔔 Chiama cameriere
              </button>
              <button
                disabled={busy}
                onClick={() => call("conto")}
                className="rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                style={{ background: p.brand, color: p.onBrand }}
              >
                🧾 Chiedi il conto
              </button>
            </div>
            {msg && (
              <p className="mt-2 text-sm" style={{ color: p.textMuted }}>
                {msg}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
