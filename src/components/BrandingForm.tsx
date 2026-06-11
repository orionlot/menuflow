"use client";

import { useState, useTransition } from "react";
import type { BrandingPatch, CopertoModalita } from "@/types/db";
import { uploadImage } from "@/app/actions/upload";
import { brandPalette } from "@/lib/brand";

export default function BrandingForm({
  restaurantId,
  initial,
  action,
}: {
  restaurantId: string;
  initial: {
    nome: string;
    sottotitolo: string | null;
    colore_primario: string;
    tema: "light" | "dark";
    logo_url: string | null;
    coperto: number;
    coperto_modalita: CopertoModalita;
    coperto_label: string;
    accetta_mancia: boolean;
  };
  action: (patch: BrandingPatch) => Promise<void>;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [sottotitolo, setSottotitolo] = useState(initial.sottotitolo ?? "");
  const [colore, setColore] = useState(initial.colore_primario || "#c8453b");
  const [tema, setTema] = useState<"light" | "dark">(initial.tema);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logo_url);
  const [coperto, setCoperto] = useState(String(initial.coperto ?? 0));
  const [copertoMode, setCopertoMode] = useState<CopertoModalita>(
    initial.coperto_modalita ?? "nessuno",
  );
  const [copertoLabel, setCopertoLabel] = useState(initial.coperto_label || "Coperto");
  const [mancia, setMancia] = useState(Boolean(initial.accetta_mancia));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const p = brandPalette(colore, tema);

  async function uploadLogo(file: File) {
    setMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("restaurantId", restaurantId);
      fd.append("kind", "logo");
      const { url } = await uploadImage(fd);
      setLogoUrl(url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload non riuscito.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await action({
          nome: nome.trim(),
          sottotitolo: sottotitolo.trim() || null,
          colore_primario: colore,
          tema,
          logo_url: logoUrl,
          coperto: Math.max(0, parseFloat(coperto) || 0),
          coperto_modalita: copertoMode,
          coperto_label: copertoLabel.trim() || "Coperto",
          accetta_mancia: mancia,
        });
        setMsg("Salvato ✓");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore nel salvataggio.");
      }
    });
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Controls */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Nome del locale
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Sottotitolo / claim
          </label>
          <input
            value={sottotitolo}
            onChange={(e) => setSottotitolo(e.target.value)}
            placeholder="es. Forno a legna dal 1987"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Colore brand
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colore}
                onChange={(e) => setColore(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-neutral-300"
              />
              <input
                value={colore}
                onChange={(e) => setColore(e.target.value)}
                className="w-28 rounded-lg border border-neutral-300 px-2 py-2 text-sm uppercase"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Tema
            </label>
            <div className="flex overflow-hidden rounded-lg border border-neutral-300">
              {(["light", "dark"] as const).map((tm) => (
                <button
                  key={tm}
                  type="button"
                  onClick={() => setTema(tm)}
                  className={`px-4 py-2 text-sm font-medium ${
                    tema === tm
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-600"
                  }`}
                >
                  {tm === "light" ? "Chiaro" : "Scuro"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Logo
          </label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="logo"
                className="h-12 w-12 rounded-full object-cover ring-1 ring-neutral-200"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-xs text-neutral-400">
                —
              </div>
            )}
            <label className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">
              {uploading ? "Carico…" : "Carica logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                }}
              />
            </label>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl(null)}
                className="text-sm text-red-500 hover:underline"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-3">
          <div className="mb-2 text-xs font-medium text-neutral-500">Coperto</div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-neutral-400">Modalità</label>
              <select
                value={copertoMode}
                onChange={(e) => setCopertoMode(e.target.value as CopertoModalita)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="nessuno">Nessuno</option>
                <option value="persona">Per persona</option>
                <option value="ordine">Fisso per ordine</option>
                <option value="servizio">Servizio %</option>
              </select>
            </div>
            {copertoMode !== "nessuno" && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-400">
                    {copertoMode === "servizio"
                      ? "Percentuale (%)"
                      : copertoMode === "ordine"
                        ? "Importo (€ a ordine)"
                        : "Importo (€ a persona)"}
                  </label>
                  <input
                    type="number"
                    step={copertoMode === "servizio" ? "1" : "0.5"}
                    min="0"
                    value={coperto}
                    onChange={(e) => setCoperto(e.target.value)}
                    className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-neutral-400">Etichetta</label>
                  <input
                    value={copertoLabel}
                    onChange={(e) => setCopertoLabel(e.target.value)}
                    placeholder="Coperto"
                    className="w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mancia}
              onChange={(e) => setMancia(e.target.checked)}
            />
            Accetta mancia (solo con pagamenti online)
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={pending || uploading}
            className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
          >
            {pending ? "Salvataggio…" : "Salva impostazioni"}
          </button>
          {msg && <span className="text-sm text-neutral-500">{msg}</span>}
        </div>
      </div>

      {/* Live preview */}
      <div>
        <div className="mb-1 text-xs font-medium text-neutral-500">Anteprima</div>
        <div
          className="overflow-hidden rounded-2xl"
          style={{ background: p.pageBg, border: `1px solid ${p.surfaceBorder}` }}
        >
          <div
            className={tema === "dark" ? "px-4 pb-4 pt-5" : "rounded-b-3xl px-4 pb-4 pt-5"}
            style={{ background: p.headerBg, color: p.headerText }}
          >
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className={`h-11 w-11 object-cover ${tema === "dark" ? "rounded-lg" : "rounded-full"}`}
                  style={tema === "dark" ? { border: `2px solid ${p.brand}` } : undefined}
                />
              ) : (
                <div
                  className={`flex h-11 w-11 items-center justify-center font-display text-lg font-bold ${tema === "dark" ? "rounded-lg" : "rounded-full"}`}
                  style={
                    tema === "dark"
                      ? { border: `2px solid ${p.brand}`, color: p.brand }
                      : { background: "#fff", color: p.brand }
                  }
                >
                  {(nome || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-display text-lg font-bold leading-tight">
                  {nome || "Nome locale"}
                </div>
                {sottotitolo && (
                  <div
                    className={tema === "dark" ? "text-[10px] uppercase tracking-[0.2em]" : "text-xs"}
                    style={{ color: p.headerSub }}
                  >
                    {sottotitolo}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 px-4 py-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: p.chipActiveBg, color: p.chipActiveText }}
            >
              Categoria
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: p.chipBg, color: p.chipText, border: `1px solid ${p.surfaceBorder}` }}
            >
              Altra
            </span>
          </div>
          <div className="px-4 pb-4">
            <div
              className="flex items-center justify-between p-3"
              style={
                tema === "dark"
                  ? { borderBottom: `1px solid ${p.surfaceBorder}` }
                  : { background: p.surface, border: `1px solid ${p.surfaceBorder}`, borderRadius: 14 }
              }
            >
              <div style={{ color: p.text }}>
                <div className="font-display text-sm font-semibold">Piatto esempio</div>
                <div className="text-xs" style={{ color: p.textMuted }}>
                  descrizione breve
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color: p.price }}>
                  € 8,00
                </div>
              </div>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold"
                style={{ background: p.brand, color: p.onBrand }}
              >
                +
              </span>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div
              className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: p.brand, color: p.onBrand }}
            >
              <span className="uppercase tracking-wide">Vedi ordine</span>
              <span>1 piatto · € 8,00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
