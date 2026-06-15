"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildTenantUrl } from "@/lib/urls";

export default function QrClient({ slug, nome }: { slug: string; nome: string }) {
  const [base, setBase] = useState("");
  const [tables, setTables] = useState(8);
  const [menuQr, setMenuQr] = useState("");
  const [tableQrs, setTableQrs] = useState<{ n: number; url: string; qr: string }[]>([]);

  useEffect(() => setBase(window.location.origin), []);
  const menuUrl = base ? buildTenantUrl(base, slug) : "";

  useEffect(() => {
    if (!menuUrl) return;
    QRCode.toDataURL(menuUrl, { width: 512, margin: 1 }).then(setMenuQr).catch(() => {});
  }, [menuUrl]);

  useEffect(() => {
    if (!base) return;
    let alive = true;
    Promise.all(
      Array.from({ length: tables }, (_, i) => {
        const n = i + 1;
        const url = buildTenantUrl(base, slug, String(n));
        return QRCode.toDataURL(url, { width: 320, margin: 1 }).then((qr) => ({ n, url, qr }));
      }),
    ).then((rs) => alive && setTableQrs(rs));
    return () => {
      alive = false;
    };
  }, [base, tables, slug]);

  return (
    <div>
      <h1 className="text-xl font-bold">QR code</h1>
      <p className="mb-5 text-sm text-neutral-500">
        I QR puntano automaticamente al dominio attuale
        {base ? (
          <>
            {" "}
            (<code className="rounded bg-neutral-100 px-1">{base}</code>)
          </>
        ) : null}
        : online useranno il tuo dominio Vercel/personalizzato, mai localhost.
      </p>

      {/* Menu QR */}
      <section className="mb-8 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">QR del menu — {nome}</h2>
        <p className="mb-3 break-all text-xs text-neutral-500">{menuUrl}</p>
        <div className="flex flex-wrap items-center gap-5">
          {menuQr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={menuQr} alt="QR menu" className="h-44 w-44 rounded-lg border border-neutral-200" />
          )}
          <div className="flex flex-col gap-2 text-sm">
            {menuQr && (
              <a
                href={menuQr}
                download={`menuflow-${slug}.png`}
                className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700"
              >
                Scarica PNG
              </a>
            )}
            <a
              href={menuUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-center font-medium hover:bg-neutral-100"
            >
              Apri menu
            </a>
          </div>
        </div>
      </section>

      {/* Per-table QR */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">QR per tavolo (pre-compilano il numero)</h2>
          <div className="flex items-center gap-2 text-sm print:hidden">
            <label className="text-neutral-500">Tavoli</label>
            <input
              type="number"
              min={1}
              max={60}
              value={tables}
              onChange={(e) => setTables(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className="w-20 rounded-md border border-neutral-300 px-2 py-1"
            />
            <button
              onClick={() => window.print()}
              title="Apre la stampa: scegli «Salva come PDF» per il foglio completo"
              className="rounded-lg border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
            >
              Stampa / Salva PDF (tutti)
            </button>
          </div>
        </div>
        <h3 className="mb-3 hidden text-lg font-bold print:block">
          QR tavoli — {nome}
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {tableQrs.map((t) => (
            <div key={t.n} className="flex flex-col items-center rounded-lg border border-neutral-200 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.qr} alt={`QR tavolo ${t.n}`} className="h-32 w-32" />
              <div className="mt-2 text-sm font-bold">Tavolo {t.n}</div>
              <a
                href={t.qr}
                download={`menuflow-${slug}-tavolo-${t.n}.png`}
                className="mt-1 text-xs text-blue-600 hover:underline print:hidden"
              >
                Scarica
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
