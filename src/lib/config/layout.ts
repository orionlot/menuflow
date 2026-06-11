import type { MenuLayout } from "@/types/db";

/**
 * Menu layout configuration (Module 1 — Aspetto). Parametric: defaults, control
 * metadata, font mapping and one-click presets all live here, not as magic
 * values scattered in components. DEFAULT_LAYOUT equals the look the app had
 * before per-tenant layout existed, so an empty `layout` keeps the current style.
 */
export const DEFAULT_LAYOUT: MenuLayout = {
  bordi: "arrotondati",
  foto_pos: "lato",
  foto_categorie_nascoste: [],
  intestazione: "banner",
  densita: "comoda",
  font: "classico",
};

/** The user-facing toggles, rendered as choice cards in the dashboard. */
export const LAYOUT_CONTROLS: {
  key: "font" | "bordi" | "foto_pos" | "intestazione" | "densita";
  label: string;
  hint: string;
  scelte: { value: string; label: string }[];
}[] = [
  {
    key: "font",
    label: "Tipografia",
    hint: "Stile dei caratteri del menu",
    scelte: [
      { value: "classico", label: "Classico" },
      { value: "moderno", label: "Moderno" },
      { value: "elegante", label: "Elegante" },
      { value: "tondo", label: "Tondo" },
    ],
  },
  {
    key: "bordi",
    label: "Bordi",
    hint: "Angoli delle schede e dei pulsanti",
    scelte: [
      { value: "arrotondati", label: "Arrotondati" },
      { value: "squadrati", label: "Squadrati" },
    ],
  },
  {
    key: "foto_pos",
    label: "Foto prodotto",
    hint: "Come appare l'immagine di ogni piatto",
    scelte: [
      { value: "lato", label: "A lato" },
      { value: "sopra", label: "Grande sopra" },
    ],
  },
  {
    key: "intestazione",
    label: "Intestazione",
    hint: "Stile della testata col nome del locale",
    scelte: [
      { value: "banner", label: "Banner + logo" },
      { value: "minimal", label: "Minimal" },
    ],
  },
  {
    key: "densita",
    label: "Densità",
    hint: "Spaziatura della lista",
    scelte: [
      { value: "comoda", label: "Comoda" },
      { value: "compatta", label: "Compatta" },
    ],
  },
];

/**
 * Maps each typography choice to its display + body font CSS variables
 * (defined in src/app/layout.tsx via next/font). Applied by overriding
 * `--font-display`/`--font-body` on the menu root so only the menu changes.
 */
export const FONT_VARS: Record<MenuLayout["font"], { display: string; body: string }> = {
  classico: { display: "var(--font-display)", body: "var(--font-body)" },
  moderno: { display: "var(--font-space)", body: "var(--font-body)" },
  elegante: { display: "var(--font-playfair)", body: "var(--font-body)" },
  tondo: { display: "var(--font-baloo)", body: "var(--font-baloo)" },
};

/**
 * One-click "ready styles": each applies a coherent colour + theme + layout +
 * typography bundle. The restaurateur can fine-tune afterwards before saving.
 */
export const STILI_PRONTI: {
  id: string;
  nome: string;
  colore_primario: string;
  colore_secondario: string;
  tema: "light" | "dark";
  layout: Omit<MenuLayout, "foto_categorie_nascoste">;
}[] = [
  {
    id: "trattoria",
    nome: "Trattoria",
    colore_primario: "#c8453b",
    colore_secondario: "#3f7d4e",
    tema: "light",
    layout: { bordi: "arrotondati", foto_pos: "lato", intestazione: "banner", densita: "comoda", font: "classico" },
  },
  {
    id: "moderno",
    nome: "Moderno",
    colore_primario: "#111827",
    colore_secondario: "#6366f1",
    tema: "light",
    layout: { bordi: "squadrati", foto_pos: "sopra", intestazione: "minimal", densita: "compatta", font: "moderno" },
  },
  {
    id: "elegante",
    nome: "Elegante",
    colore_primario: "#161616",
    colore_secondario: "#b08d57",
    tema: "dark",
    layout: { bordi: "squadrati", foto_pos: "lato", intestazione: "minimal", densita: "comoda", font: "elegante" },
  },
  {
    id: "caffe",
    nome: "Caffè",
    colore_primario: "#6f4e37",
    colore_secondario: "#d39a5b",
    tema: "light",
    layout: { bordi: "arrotondati", foto_pos: "sopra", intestazione: "banner", densita: "comoda", font: "tondo" },
  },
  {
    id: "pub",
    nome: "Pub",
    colore_primario: "#12100e",
    colore_secondario: "#e0a83d",
    tema: "dark",
    layout: { bordi: "arrotondati", foto_pos: "lato", intestazione: "banner", densita: "comoda", font: "moderno" },
  },
];

function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

/**
 * Merge a stored (possibly partial/invalid/empty) layout with the defaults.
 * Used both for rendering and as the validator before persisting.
 */
export function resolveLayout(raw: unknown): MenuLayout {
  const o = (raw ?? {}) as Partial<MenuLayout>;
  return {
    bordi: oneOf(o.bordi, ["arrotondati", "squadrati"] as const, DEFAULT_LAYOUT.bordi),
    foto_pos: oneOf(o.foto_pos, ["lato", "sopra"] as const, DEFAULT_LAYOUT.foto_pos),
    foto_categorie_nascoste: Array.isArray(o.foto_categorie_nascoste)
      ? o.foto_categorie_nascoste
          .map((c) => String(c).trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 50)
      : [],
    intestazione: oneOf(
      o.intestazione,
      ["banner", "minimal"] as const,
      DEFAULT_LAYOUT.intestazione,
    ),
    densita: oneOf(o.densita, ["comoda", "compatta"] as const, DEFAULT_LAYOUT.densita),
    font: oneOf(
      o.font,
      ["classico", "moderno", "elegante", "tondo"] as const,
      DEFAULT_LAYOUT.font,
    ),
  };
}

/** Whitelist/normalise a layout patch before saving. */
export function sanitizeLayout(raw: unknown): MenuLayout {
  return resolveLayout(raw);
}
