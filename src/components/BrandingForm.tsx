"use client";

import { useState, useTransition, type CSSProperties } from "react";
import type { BrandingPatch, CopertoModalita, MenuLayout } from "@/types/db";
import { uploadImage } from "@/app/actions/upload";
import { brandPalette } from "@/lib/brand";
import {
  LAYOUT_CONTROLS,
  DEFAULT_LAYOUT,
  STILI_PRONTI,
  FONT_VARS,
} from "@/lib/config/layout";

export default function BrandingForm({
  restaurantId,
  categories,
  initial,
  action,
}: {
  restaurantId: string;
  categories: string[];
  initial: {
    nome: string;
    sottotitolo: string | null;
    colore_primario: string;
    colore_secondario: string | null;
    tema: "light" | "dark";
    layout: MenuLayout;
    logo_url: string | null;
    coperto: number;
    coperto_modalita: CopertoModalita;
    coperto_label: string;
    accetta_mancia: boolean;
    google_review_url: string | null;
  };
  action: (patch: BrandingPatch) => Promise<void>;
}) {
  const [nome, setNome] = useState(initial.nome);
  const [sottotitolo, setSottotitolo] = useState(initial.sottotitolo ?? "");
  const [colore, setColore] = useState(initial.colore_primario || "#c8453b");
  const [secondario, setSecondario] = useState(initial.colore_secondario ?? "");
  const [tema, setTema] = useState<"light" | "dark">(initial.tema);
  const [layout, setLayout] = useState<MenuLayout>(initial.layout ?? DEFAULT_LAYOUT);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logo_url);
  const [reviewUrl, setReviewUrl] = useState(initial.google_review_url ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const p = brandPalette(colore, tema, secondario || null);
  const radius = layout.bordi === "squadrati" ? 6 : 16;
  const compact = layout.densita === "compatta";
  const photoTop = layout.foto_pos === "sopra";
  const minimal = layout.intestazione === "minimal";

  function toggleCategoryPhoto(cat: string) {
    setLayout((l) => {
      const hidden = new Set(l.foto_categorie_nascoste);
      if (hidden.has(cat)) hidden.delete(cat);
      else hidden.add(cat);
      return { ...l, foto_categorie_nascoste: [...hidden] };
    });
  }

  function applyPreset(preset: (typeof STILI_PRONTI)[number]) {
    setColore(preset.colore_primario);
    setSecondario(preset.colore_secondario);
    setTema(preset.tema);
    setLayout((l) => ({
      ...preset.layout,
      foto_categorie_nascoste: l.foto_categorie_nascoste,
    }));
  }

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
          colore_secondario: secondario || null,
          tema,
          layout,
          logo_url: logoUrl,
          google_review_url: reviewUrl.trim() || null,
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
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2 text-xs font-medium text-neutral-500">Stili pronti</div>
          <div className="flex flex-wrap gap-2">
            {STILI_PRONTI.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applyPreset(s)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-neutral-900"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: s.colore_primario, outline: `2px solid ${s.colore_secondario}`, outlineOffset: -1 }}
                />
                {s.nome}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            Un clic imposta colori, tema, layout e tipografia coordinati. Poi puoi ritoccare e premere Salva.
          </p>
        </div>

        <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Identità e colori
        </div>

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

        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Colore principale
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
                className="w-24 rounded-lg border border-neutral-300 px-2 py-2 text-sm uppercase"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-neutral-500">
              Colore secondario
            </div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={!secondario}
                onChange={(e) => setSecondario(e.target.checked ? "" : colore)}
              />
              Usa il colore principale
            </label>
            {secondario && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondario}
                  onChange={(e) => setSecondario(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-neutral-300"
                />
                <input
                  value={secondario}
                  onChange={(e) => setSecondario(e.target.value)}
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-2 text-sm uppercase"
                />
              </div>
            )}
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
                    tema === tm ? "bg-neutral-900 text-white" : "bg-white text-neutral-600"
                  }`}
                >
                  {tm === "light" ? "Chiaro" : "Scuro"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Logo</label>
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

        {/* Layout */}
        <div className="rounded-lg border border-neutral-200 p-3">
          <div className="mb-2 text-xs font-medium text-neutral-500">Layout del menu</div>
          <div className="space-y-3">
            {LAYOUT_CONTROLS.map((ctrl) => (
              <div key={ctrl.key}>
                <div className="text-[13px] font-medium text-neutral-700">{ctrl.label}</div>
                <div className="mb-1 text-[11px] text-neutral-400">{ctrl.hint}</div>
                <div className="flex overflow-hidden rounded-lg border border-neutral-300">
                  {ctrl.scelte.map((s) => {
                    const on = layout[ctrl.key] === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          setLayout((l) => ({ ...l, [ctrl.key]: s.value }) as MenuLayout)
                        }
                        className={`flex-1 px-3 py-1.5 text-sm font-medium ${
                          on
                            ? "bg-neutral-900 text-white"
                            : "bg-white text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {categories.length > 0 && (
              <div>
                <div className="text-[13px] font-medium text-neutral-700">
                  Foto per categoria
                </div>
                <div className="mb-1 text-[11px] text-neutral-400">
                  Tocca per mostrare/nascondere le foto dei prodotti di una categoria
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const shown = !layout.foto_categorie_nascoste.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoryPhoto(cat)}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          shown
                            ? "bg-green-100 text-green-700"
                            : "bg-neutral-100 text-neutral-400 line-through"
                        }`}
                        title={shown ? "Foto mostrate" : "Foto nascoste"}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">
            Link recensioni Google
          </label>
          <input
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder="https://g.page/r/…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Usato dalla card “lascia una recensione” dopo l’ordine (se la funzione è attiva).
          </p>
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

      {/* Live preview — stays in view while scrolling the controls */}
      <div className="md:sticky md:top-24 md:self-start">
        <div className="mb-1 text-xs font-medium text-neutral-500">Anteprima</div>
        <div
          className="overflow-hidden font-sans"
          style={
            {
              background: p.pageBg,
              border: `1px solid ${p.surfaceBorder}`,
              borderRadius: radius + 4,
              "--font-display": FONT_VARS[layout.font].display,
              "--font-body": FONT_VARS[layout.font].body,
            } as CSSProperties
          }
        >
          {/* Header */}
          {minimal ? (
            <div
              className="flex items-center gap-3 px-4 pb-3 pt-4"
              style={{ background: p.pageBg, color: p.text }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-8 w-8 object-cover"
                  style={{ borderRadius: radius }}
                />
              ) : null}
              <div className="font-display text-lg font-bold">{nome || "Nome locale"}</div>
            </div>
          ) : (
            <div
              className="px-4 pb-4 pt-5"
              style={{
                background: p.headerBg,
                color: p.headerText,
                borderBottomLeftRadius: tema === "dark" ? 0 : radius + 8,
                borderBottomRightRadius: tema === "dark" ? 0 : radius + 8,
              }}
            >
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-11 w-11 object-cover"
                    style={{ borderRadius: radius }}
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 items-center justify-center font-display text-lg font-bold"
                    style={{
                      background: tema === "dark" ? "transparent" : "#fff",
                      color: p.brand,
                      borderRadius: radius,
                      border: tema === "dark" ? `2px solid ${p.brand}` : undefined,
                    }}
                  >
                    {(nome || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-display text-lg font-bold leading-tight">
                    {nome || "Nome locale"}
                  </div>
                  {sottotitolo && (
                    <div className="text-xs" style={{ color: p.headerSub }}>
                      {sottotitolo}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Category chips */}
          <div className={`flex gap-2 px-4 ${compact ? "py-2" : "py-3"}`}>
            <span
              className="px-3 py-1 text-xs font-semibold"
              style={{ background: p.chipActiveBg, color: p.chipActiveText, borderRadius: 999 }}
            >
              Categoria
            </span>
            <span
              className="px-3 py-1 text-xs font-semibold"
              style={{
                background: p.chipBg,
                color: p.chipText,
                border: `1px solid ${p.surfaceBorder}`,
                borderRadius: 999,
              }}
            >
              Altra
            </span>
          </div>

          {/* Sample item */}
          <div className="px-4 pb-4">
            <div
              style={
                tema === "dark"
                  ? { borderBottom: `1px solid ${p.surfaceBorder}`, paddingBottom: compact ? 8 : 12 }
                  : {
                      background: p.surface,
                      border: `1px solid ${p.surfaceBorder}`,
                      borderRadius: radius,
                      padding: compact ? 8 : 12,
                    }
              }
            >
              {photoTop && (
                <div className="mb-2 h-24 w-full" style={{ background: p.tint, borderRadius: radius }} />
              )}
              <div className="flex items-center gap-3">
                {!photoTop && (
                  <div className="h-12 w-12 shrink-0" style={{ background: p.tint, borderRadius: radius }} />
                )}
                <div className="flex-1" style={{ color: p.text }}>
                  <div className="font-display text-sm font-semibold">Piatto esempio</div>
                  <div className="text-xs" style={{ color: p.textMuted }}>
                    descrizione breve
                  </div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: p.price }}>
                    € 8,00
                  </div>
                </div>
                <span
                  className="flex h-8 w-8 items-center justify-center text-lg font-bold"
                  style={{ background: p.accent, color: p.onAccent, borderRadius: 999 }}
                >
                  +
                </span>
              </div>
            </div>
          </div>

          {/* Vedi ordine */}
          <div className="px-4 pb-4">
            <div
              className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold"
              style={{ background: p.accent, color: p.onAccent, borderRadius: radius }}
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
