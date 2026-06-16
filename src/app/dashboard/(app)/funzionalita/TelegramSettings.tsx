"use client";

import { useState, useTransition } from "react";

export default function TelegramSettings({
  chatOrdini,
  chatPagamenti,
  tokenConfigured,
  update,
  test,
}: {
  chatOrdini: string | null;
  chatPagamenti: string | null;
  tokenConfigured: boolean;
  update: (ordini: string, pagamenti: string) => Promise<void>;
  test: () => Promise<{ stub: boolean }>;
}) {
  const [ord, setOrd] = useState(chatOrdini ?? "");
  const [pag, setPag] = useState(chatPagamenti ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const connected = Boolean(chatOrdini);

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await update(ord, pag);
        setMsg("Salvato ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }
  function doTest() {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await test();
        setMsg(
          r.stub
            ? "Inviata in modalità stub (token o chat mancanti): controlla la console del server."
            : "Notifica di prova inviata ✓ — controlla Telegram.",
        );
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-1 text-xs font-medium text-neutral-500">Notifiche Telegram</div>
      <span
        className="mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{
          background: !tokenConfigured ? "#f1f5f9" : connected ? "#dcfce7" : "#fef3c7",
          color: !tokenConfigured ? "#64748b" : connected ? "#166534" : "#92400e",
        }}
      >
        {!tokenConfigured
          ? "Bot non configurato sul server"
          : connected
            ? "Bot Ordini collegato"
            : "Chat non ancora impostata"}
      </span>
      <p className="mb-2 text-sm text-neutral-600">
        Inserisci la chat ID Telegram dove vuoi ricevere gli ordini. Per trovarla: scrivi un
        messaggio al bot, poi apri{" "}
        <span className="font-mono">api.telegram.org/bot&lt;token&gt;/getUpdates</span> e copia{" "}
        <span className="font-mono">chat.id</span>.
      </p>
      <p className="mb-3 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
        ⚠️ Quell&apos;URL contiene il <b>token del bot</b>: non condividerlo né
        pubblicarlo: chi lo possiede può controllare il bot.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-500">Chat ordini</span>
          <input
            value={ord}
            onChange={(e) => setOrd(e.target.value)}
            placeholder="es. 123456789"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-500">
            Chat pagamenti (opzionale)
          </span>
          <input
            value={pag}
            onChange={(e) => setPag(e.target.value)}
            placeholder="es. 987654321"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "…" : "Salva"}
        </button>
        <button
          onClick={doTest}
          disabled={pending}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
        >
          Invia notifica di prova
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
