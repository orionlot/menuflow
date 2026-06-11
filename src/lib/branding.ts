import type { BrandingPatch } from "@/types/db";
import { sanitizeLayout } from "@/lib/config/layout";

/** Whitelist + validate branding fields. Used by the dashboard and admin actions. */
export function sanitizeBranding(patch: BrandingPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof patch.nome === "string" && patch.nome.trim())
    out.nome = patch.nome.trim().slice(0, 80);
  if ("sottotitolo" in patch)
    out.sottotitolo = patch.sottotitolo
      ? String(patch.sottotitolo).slice(0, 120)
      : null;
  if (
    typeof patch.colore_primario === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(patch.colore_primario)
  )
    out.colore_primario = patch.colore_primario.toLowerCase();
  if (patch.tema === "light" || patch.tema === "dark") out.tema = patch.tema;
  if ("logo_url" in patch) out.logo_url = patch.logo_url || null;
  if (typeof patch.coperto === "number" && patch.coperto >= 0)
    out.coperto = Math.min(Math.round(patch.coperto * 100) / 100, 999);
  if (
    patch.coperto_modalita === "nessuno" ||
    patch.coperto_modalita === "persona" ||
    patch.coperto_modalita === "ordine" ||
    patch.coperto_modalita === "servizio"
  )
    out.coperto_modalita = patch.coperto_modalita;
  if (typeof patch.coperto_label === "string")
    out.coperto_label = patch.coperto_label.trim().slice(0, 40) || "Coperto";
  if (typeof patch.accetta_mancia === "boolean")
    out.accetta_mancia = patch.accetta_mancia;
  if ("colore_secondario" in patch) {
    if (!patch.colore_secondario) out.colore_secondario = null;
    else if (/^#[0-9a-fA-F]{6}$/.test(patch.colore_secondario))
      out.colore_secondario = patch.colore_secondario.toLowerCase();
  }
  if (patch.layout !== undefined) out.layout = sanitizeLayout(patch.layout);
  if ("google_review_url" in patch)
    out.google_review_url = patch.google_review_url
      ? String(patch.google_review_url).trim().slice(0, 300)
      : null;
  return out;
}
