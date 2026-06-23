"use client";

import { useState, useTransition } from "react";

export default function PagamentiSettings({
  piano,
  stripeConnectId,
  pagamentiAttivi,
  pagamentiTest,
  onboard,
  disconnect,
}: {
  piano: string;
  stripeConnectId: string | null;
  pagamentiAttivi: boolean;
  pagamentiTest: boolean;
  onboard: () => Promise<{ url: string } | { error: string }>;
  disconnect: () => Promise<void>;
}) {
  const hasPlan = piano === "plus" || piano === "pro";
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function doOnboard() {
    setMsg(null);
    startTransition(async () => {
      const res = await onboard();
      if ("url" in res) window.location.href = res.url;
      else setMsg(res.error);
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
        I pagamenti al tavolo sono inclusi dal piano <b>Plus</b>. Fai l&apos;upgrade per incassare
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

      {stripeConnectId && pagamentiAttivi ? (
        <div className="text-sm">
          <div>Incassi al tavolo <b className="text-green-700">attivi</b> ✓</div>
          <button
            onClick={doDisconnect}
            disabled={pending}
            className="mt-2 text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            Scollega
          </button>
        </div>
      ) : stripeConnectId ? (
        <div>
          <p className="mb-2 text-sm text-neutral-600">
            Onboarding non ancora completato. Completa la procedura su Stripe per iniziare a
            incassare.
          </p>
          <button
            onClick={doOnboard}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "…" : "Completa su Stripe"}
          </button>
          <button
            onClick={doDisconnect}
            disabled={pending}
            className="ml-3 text-sm text-red-500 hover:underline disabled:opacity-50"
          >
            Scollega
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm text-neutral-600">
            Collega il tuo conto Stripe: la procedura guidata ti chiede i dati dell&apos;attività e
            l&apos;IBAN per i bonifici. Gli incassi al tavolo arriveranno direttamente sul tuo conto.
          </p>
          <button
            onClick={doOnboard}
            disabled={pending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "…" : "Connetti con Stripe"}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-red-500">{msg}</p>}
      <p className="mt-2 text-[11px] text-neutral-400">
        La modalità test (pagamenti finti o reali) è gestita dall&apos;amministratore.
      </p>
    </div>
  );
}
