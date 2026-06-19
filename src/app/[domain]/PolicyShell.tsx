/* eslint-disable @next/next/no-html-link-for-pages --
   These hrefs (/, /cookie-policy, /privacy-policy) are tenant-relative routes
   served via the Host-based middleware rewrite to app/[domain]/…. A <Link> would
   client-match the dynamic [domain] root (treating "cookie-policy" as a slug);
   full <a> navigation lets middleware resolve the tenant correctly. */
import type { ReactNode } from "react";

/** Readable document chrome for the per-tenant legal pages (cookie/privacy).
 *  Intentionally neutral and high-contrast (a legal document, not a branded
 *  surface). Server component. */
export default function PolicyShell({
  nome,
  titolo,
  aggiornatoIl,
  children,
}: {
  nome: string;
  titolo: string;
  aggiornatoIl: string | null;
  children: ReactNode;
}) {
  // Format YYYY-MM-DD as a readable Italian date (falls back to the raw value).
  let aggiornato: string | null = null;
  if (aggiornatoIl) {
    const d = new Date(`${aggiornatoIl}T00:00:00`);
    aggiornato = Number.isNaN(d.getTime())
      ? aggiornatoIl
      : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  }
  return (
    <main className="min-h-screen bg-white text-neutral-800">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <a href="/" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
          ← Torna al menu
        </a>
        <h1 className="mt-4 font-display text-3xl font-bold text-neutral-900">{titolo}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {nome}
          {aggiornato ? ` · Ultimo aggiornamento: ${aggiornato}` : ""}
        </p>
        <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-neutral-700">
          {children}
        </div>
      </div>
    </main>
  );
}

/** A titled section block used by both policy pages. */
export function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-bold text-neutral-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** A labelled data row (used in the "Titolare" block). */
export function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p>
      <span className="font-semibold text-neutral-900">{label}:</span> {value}
    </p>
  );
}
