"use client";

import { useState } from "react";

export default function EmbedSnippet({ url, nome }: { url: string; nome: string }) {
  const code = `<iframe src="${url}" title="Menu — ${nome}" style="width:100%;min-height:720px;border:0" loading="lazy" allow="fullscreen"></iframe>`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500">
        Incolla questo codice in qualsiasi pagina web per mostrare il menu di {nome}.
      </p>
      <textarea
        readOnly
        value={code}
        onFocus={(e) => e.currentTarget.select()}
        className="h-24 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-2 font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
        >
          {copied ? "Copiato ✓" : "Copia codice"}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-neutral-500 hover:underline">
          Apri il menu
        </a>
      </div>
    </div>
  );
}
