"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 print:hidden"
    >
      🖨️ Scarica / Stampa PDF
    </button>
  );
}
