"use client";

import { useState, useTransition } from "react";

export default function AbbonamentoCTA({
  attivo,
  hasLiveSub,
  stripeOn,
  startCheckout,
  openPortal,
}: {
  attivo: boolean;
  hasLiveSub: boolean;
  stripeOn: boolean;
  startCheckout: () => Promise<{ url: string } | { error: string }>;
  openPortal: () => Promise<{ url: string } | { error: string }>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!stripeOn) return null;

  function go(action: () => Promise<{ url: string } | { error: string }>) {
    setMsg(null);
    start(async () => {
      const res = await action();
      if ("url" in res) window.location.href = res.url;
      else setMsg(res.error);
    });
  }

  return (
    <div className="mt-4">
      {!attivo && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Abbonamento non attivo — completa il pagamento per pubblicare il menu.
        </div>
      )}
      <button
        onClick={() => go(hasLiveSub ? openPortal : startCheckout)}
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : hasLiveSub ? "Gestisci abbonamento" : "Completa l'abbonamento"}
      </button>
      {msg && <p className="mt-2 text-sm text-red-500">{msg}</p>}
    </div>
  );
}
