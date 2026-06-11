/**
 * Per-tenant theming. Given a brand colour (+ optional secondary/accent) and a
 * theme, derive a full palette so the same code renders a warm light menu
 * (pizzeria) or a dark elegant one (cocktail bar) — the "stessa app, due locali"
 * idea. The accent colour drives calls-to-action (buttons, prices, active chip)
 * while the brand colour stays on the header.
 *
 * Pure + framework-agnostic so it can run in client components.
 */

export interface Palette {
  tema: "light" | "dark";
  brand: string;
  onBrand: string; // readable text over the brand colour
  accent: string; // secondary/accent colour (falls back to brand)
  onAccent: string; // readable text over the accent colour
  pageBg: string;
  surface: string;
  surfaceBorder: string;
  headerBg: string;
  headerText: string;
  headerSub: string;
  text: string;
  textMuted: string;
  price: string;
  chipActiveBg: string;
  chipActiveText: string;
  chipBg: string;
  chipText: string;
  tint: string; // translucent brand wash
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function brandPalette(
  hex: string,
  tema: "light" | "dark" = "light",
  secondary?: string | null,
): Palette {
  const { r, g, b } = hexToRgb(hex || "#c8453b");
  const onBrand = luminance(r, g, b) > 0.62 ? "#1a1206" : "#ffffff";

  // Accent = secondary colour when valid, else falls back to the brand colour
  // (existing tenants without a secondary keep their current look).
  const accentHex =
    secondary && /^#[0-9a-fA-F]{6}$/.test(secondary) ? secondary : hex || "#c8453b";
  const ac = hexToRgb(accentHex);
  const onAccent = luminance(ac.r, ac.g, ac.b) > 0.62 ? "#1a1206" : "#ffffff";

  if (tema === "dark") {
    return {
      tema,
      brand: hex,
      onBrand,
      accent: accentHex,
      onAccent,
      pageBg: "#0e1013",
      surface: "#181b21",
      surfaceBorder: "#272c35",
      headerBg: "#14171c",
      headerText: "#f5f2ec",
      headerSub: "#9aa1ad",
      text: "#f1eee8",
      textMuted: "#98a0ac",
      price: "#f1eee8",
      chipActiveBg: accentHex,
      chipActiveText: onAccent,
      chipBg: "#1f242c",
      chipText: "#c7cdd6",
      tint: `rgba(${r},${g},${b},0.16)`,
    };
  }

  return {
    tema,
    brand: hex,
    onBrand,
    accent: accentHex,
    onAccent,
    pageBg: "#f5f1ec",
    surface: "#ffffff",
    surfaceBorder: "#ece4da",
    headerBg: hex,
    headerText: onBrand,
    headerSub:
      onBrand === "#ffffff" ? "rgba(255,255,255,0.82)" : "rgba(26,18,6,0.7)",
    text: "#211b15",
    textMuted: "#8c8279",
    price: accentHex,
    chipActiveBg: accentHex,
    chipActiveText: onAccent,
    chipBg: "#ffffff",
    chipText: "#6d635b",
    tint: `rgba(${r},${g},${b},0.10)`,
  };
}
