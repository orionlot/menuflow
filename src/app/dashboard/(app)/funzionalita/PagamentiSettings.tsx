"use client";

import { useState, useTransition } from "react";

export default function PagamentiSettings({
  piano,
  stripeConnectId,
  pagamentiAttivi,
  pagamentiTest,
  connect,
  disconnect,
}: {
  piano: string;
  stripeConnectId: string | null;
  pagamentiAttivi: boolean;
  pagamentiTest: boolean;
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
}) {
  const hasPlan = piano === "plus" || piano === "pro";
  const [id, setId] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function doConnect() {
    setMsg(null);
    startTransition(async () => {
      try {
        await connect(id);
        setMsg("Pagamenti collegati ✓");
        setId("");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }
  function doDisconnect() {
    setMsg(null);
    startTransition(async () => {
      try {
        await disconnect();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  if (!hasPlan) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        I pagamenti al tavolo sono inclusi dal piano <b>Plus</b>. Fai l’upgrade per incassare
        online direttamente sul tuo conto.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 text-xs font-medium text-neutral-500">
        Pagamenti al tavolo (Stripe Connect)
      </div>
      <span
        className="mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{
          background: pagamentiTest ? "#fef3c7" : "#dcfce7",
          color: pagamentiTest ? "#92400e" : "#166534",
        }}
      >
        {pagamentiTest ? "Modalità test — pagamenti simulati" : "Pagamenti reali attivi"}
      </span>

      {stripeConnectId ? (
        <div className="text-sm">
          <div>
            Collegato:{" "}
            <span className="font-mono text-neutral-800">{stripeConnectId}</span>
            {pagamentiAttivi ? " · attivo" : ""}
          </div>
          <button
            onClick={doDisconnect}
            disabled={pending}
            className="mt-2 text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            Scollega
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm text-neutral-600">
            Inserisci l’ID del tuo account Stripe Connect (lo trovi nella tua dashboard Stripe,
            inizia con <span className="font-mono">acct_</span>): i pagamenti arriveranno
            direttamente sul tuo conto.
          </p>
          <div className="flex gap-2">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="acct_..."
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
            />
            <button
              onClick={doConnect}
              disabled={pending || !id.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "…" : "Collega"}
            </button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-neutral-500">{msg}</p>}
      <p className="mt-2 text-[11px] text-neutral-400">
        La modalità test (pagamenti finti o reali) è gestita dall’amministratore.
      </p>
    </div>
  );
}
