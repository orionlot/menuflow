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
    <div className="space-y-3">
      <p className="text-sm font-medium text-neutral-600">
        Incolla questo codice in qualsiasi pagina web per mostrare il menu di {nome}.
      </p>
      <textarea
        readOnly
        value={code}
        onFocus={(e) => e.currentTarget.select()}
        className="h-32 w-full rounded-lg border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          {copied ? "Copiato ✓" : "Copia codice"}
        </button>
        {copied && (
          <span className="text-sm font-medium text-green-700">
            Codice copiato negli appunti
          </span>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-sm text-sm text-neutral-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Apri il menu
        </a>
      </div>
    </div>
  );
}
