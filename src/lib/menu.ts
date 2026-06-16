import { ALLERGENI_BY_ID } from "@/lib/config/allergeni";
import type {
  CategoryAddon,
  ComposizioneGruppo,
  ComposizioneScelta,
  ItemOption,
  TagliaComposizione,
} from "@/types/db";

/**
 * Effective option groups for an item = its own options + any category add-ons
 * that target the item's category. On a name clash, the item's own option wins.
 */
export function effectiveOptions(
  item: { categoria: string; opzioni?: ItemOption[] },
  aggiunte?: CategoryAddon[],
): ItemOption[] {
  const base = item.opzioni ?? [];
  const taken = new Set(base.map((g) => g.nome));
  const extra: ItemOption[] = (aggiunte ?? [])
    .filter((a) => a.categorie?.includes(item.categoria) && !taken.has(a.nome))
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      obbligatorio: a.obbligatorio,
      scelte: a.scelte,
    }));
  return [...base, ...extra];
}

export function sanitizeAggiunte(raw: unknown): CategoryAddon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((g, gi) => {
      const o = (g ?? {}) as Partial<CategoryAddon>;
      const scelte = Array.isArray(o.scelte)
        ? o.scelte
            .slice(0, 20)
            .map((s) => ({
              nome: String(s?.nome ?? "").trim().slice(0, 40),
              prezzo: Math.max(0, Math.round(Number(s?.prezzo ?? 0) * 100) / 100),
            }))
            .filter((s) => s.nome)
        : [];
      const categorie = Array.isArray(o.categorie)
        ? o.categorie.map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50)
        : [];
      return {
        id: String(o.id ?? `a${gi}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        tipo: o.tipo === "single" ? ("single" as const) : ("multi" as const),
        obbligatorio: Boolean(o.obbligatorio),
        scelte,
        categorie,
      };
    })
    .filter((g) => g.nome && g.scelte.length && g.categorie.length);
}

export interface ItemPatch {
  nome?: string;
  categoria?: string;
  descrizione?: string | null;
  prezzo?: number;
  disponibile?: boolean;
  foto_url?: string | null;
  ordine?: number;
  nome_i18n?: Record<string, string>;
  descrizione_i18n?: Record<string, string>;
  allergeni?: string[];
  opzioni?: ItemOption[];
  consigliato?: boolean;
  scorta?: number | null;
  ingredienti?: string[]; // ingredient ids (refs public.ingredients), display-only list
  composizione?: ComposizioneGruppo[]; // per-item composition groups (category-less)
  composizione_taglie?: TagliaComposizione[]; // per-item size variants (category-less)
}

export function sanitizeOpzioni(raw: unknown): ItemOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 10)
    .map((g, gi) => {
      const o = (g ?? {}) as Partial<ItemOption>;
      const scelte = Array.isArray(o.scelte)
        ? o.scelte
            .slice(0, 20)
            .map((s) => ({
              nome: String(s?.nome ?? "").trim().slice(0, 40),
              prezzo: Math.max(0, Math.round(Number(s?.prezzo ?? 0) * 100) / 100),
            }))
            .filter((s) => s.nome)
        : [];
      return {
        id: String(o.id ?? `g${gi}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        tipo: o.tipo === "single" ? ("single" as const) : ("multi" as const),
        obbligatorio: Boolean(o.obbligatorio),
        scelte,
      };
    })
    .filter((g) => g.nome && g.scelte.length);
}

export function sanitizeItemPatch(patch: ItemPatch): ItemPatch {
  const out: ItemPatch = {};
  if (typeof patch.nome === "string") out.nome = patch.nome.trim().slice(0, 120);
  if (typeof patch.categoria === "string")
    out.categoria = patch.categoria.trim().slice(0, 60);
  if ("descrizione" in patch)
    out.descrizione = patch.descrizione
      ? String(patch.descrizione).slice(0, 400)
      : null;
  if (typeof patch.prezzo === "number" && patch.prezzo >= 0)
    out.prezzo = Math.round(patch.prezzo * 100) / 100;
  if (typeof patch.disponibile === "boolean") out.disponibile = patch.disponibile;
  if ("foto_url" in patch) out.foto_url = patch.foto_url || null;
  if (typeof patch.ordine === "number") out.ordine = patch.ordine;
  if (patch.nome_i18n && typeof patch.nome_i18n === "object")
    out.nome_i18n = patch.nome_i18n;
  if (patch.descrizione_i18n && typeof patch.descrizione_i18n === "object")
    out.descrizione_i18n = patch.descrizione_i18n;
  if (Array.isArray(patch.allergeni))
    out.allergeni = patch.allergeni.filter((a) => ALLERGENI_BY_ID.has(a)).slice(0, 14);
  if (Array.isArray(patch.opzioni)) out.opzioni = sanitizeOpzioni(patch.opzioni);
  if (typeof patch.consigliato === "boolean") out.consigliato = patch.consigliato;
  if ("scorta" in patch)
    out.scorta =
      patch.scorta == null ? null : Math.max(0, Math.floor(Number(patch.scorta) || 0));
  if (Array.isArray(patch.ingredienti))
    out.ingredienti = patch.ingredienti
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 40);
  if (Array.isArray(patch.composizione))
    out.composizione = sanitizeComposizione(patch.composizione, { requireCategorie: false });
  if (Array.isArray(patch.composizione_taglie))
    out.composizione_taglie = sanitizeTaglie(patch.composizione_taglie, { requireCategorie: false });
  return out;
}

/** Whitelist a composition config (groups of ingredients). With
 *  `requireCategorie` (the default) a group must target ≥1 category — used for
 *  the per-category restaurant config. For per-item composition pass
 *  `{ requireCategorie: false }`: the item itself is the scope, so `categorie`
 *  is forced empty and not required. */
export function sanitizeComposizione(
  raw: unknown,
  { requireCategorie = true }: { requireCategorie?: boolean } = {},
): ComposizioneGruppo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((g, gi) => {
      const o = (g ?? {}) as Partial<ComposizioneGruppo>;
      const ingredienti = Array.isArray(o.ingredienti)
        ? o.ingredienti
            .slice(0, 30)
            .map((s) => {
              const sc = (s ?? {}) as Partial<ComposizioneScelta>;
              const out: ComposizioneScelta = {
                ingredient_id: String(sc.ingredient_id ?? "").trim().slice(0, 40),
              };
              if (sc.prezzo != null && Number.isFinite(Number(sc.prezzo)))
                out.prezzo = Math.max(0, Math.round(Number(sc.prezzo) * 100) / 100);
              return out;
            })
            .filter((s) => s.ingredient_id)
        : [];
      const categorie = requireCategorie && Array.isArray(o.categorie)
        ? o.categorie.map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50)
        : [];
      const max = Math.max(1, Math.floor(Number(o.max) || 1));
      const min = Math.min(max, Math.max(0, Math.floor(Number(o.min) || 0)));
      return {
        id: String(o.id ?? `c${gi}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        categorie,
        min,
        max,
        ingredienti,
      };
    })
    .filter((g) => g.nome && (requireCategorie ? g.categorie.length : true) && g.ingredienti.length);
}

/** Sanitize size variants. Caps counts and shapes the per-group max map.
 *  With `requireCategorie` (default) a size must target ≥1 category (per-category
 *  config). For per-item sizes pass `{ requireCategorie: false }`: `categorie` is
 *  forced empty and only a name is required. */
export function sanitizeTaglie(
  raw: unknown,
  { requireCategorie = true }: { requireCategorie?: boolean } = {},
): TagliaComposizione[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 12)
    .map((t, ti) => {
      const o = (t ?? {}) as Partial<TagliaComposizione>;
      const categorie = requireCategorie && Array.isArray(o.categorie)
        ? o.categorie.map((c) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 50)
        : [];
      const max: Record<string, number> = {};
      if (o.max && typeof o.max === "object") {
        for (const [k, v] of Object.entries(o.max).slice(0, 30)) {
          const n = Math.floor(Number(v));
          if (Number.isFinite(n) && n >= 0) max[String(k).slice(0, 40)] = Math.min(99, n);
        }
      }
      return {
        id: String(o.id ?? `t${ti}`).slice(0, 40),
        nome: String(o.nome ?? "").trim().slice(0, 40),
        categorie,
        max,
        prezzo: Math.max(0, Math.round((Number(o.prezzo) || 0) * 100) / 100),
      };
    })
    .filter((t) => t.nome && (requireCategorie ? t.categorie.length : true));
}
