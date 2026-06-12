import { ALLERGENI_BY_ID } from "@/lib/config/allergeni";
import type { ItemPatch } from "@/lib/menu";

function detectSep(text: string): string {
  const first = text.split(/\r?\n/)[0] ?? "";
  return first.split(";").length > first.split(",").length ? ";" : ",";
}

/** Minimal but correct CSV parser: handles quotes, "" escaping, , or ; separators. */
export function parseCsv(text: string): string[][] {
  const sep = detectSep(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Map CSV rows to item patches. Expected header:
 * categoria, nome, descrizione, prezzo, disponibile, allergeni (separati da |).
 */
export function rowsToItemPatches(rows: string[][]): {
  patches: ItemPatch[];
  skipped: number;
} {
  if (rows.length < 2) return { patches: [], skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iCat = col("categoria");
  const iNome = col("nome");
  const iDesc = col("descrizione");
  const iPrezzo = col("prezzo");
  const iDisp = col("disponibile");
  const iAll = col("allergeni");
  const patches: ItemPatch[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const nome = (r[iNome] ?? "").trim();
    const categoria = (r[iCat] ?? "").trim();
    if (!nome || !categoria) {
      skipped++;
      continue;
    }
    const prezzo = parseFloat((r[iPrezzo] ?? "0").replace(",", ".")) || 0;
    const disp = (r[iDisp] ?? "").trim().toLowerCase();
    const disponibile = !(disp === "no" || disp === "false" || disp === "0" || disp === "n");
    const allergeni = (r[iAll] ?? "")
      .split("|")
      .map((a) => a.trim().toLowerCase())
      .filter((a) => ALLERGENI_BY_ID.has(a));
    patches.push({
      nome: nome.slice(0, 120),
      categoria: categoria.slice(0, 60),
      descrizione: (r[iDesc] ?? "").trim().slice(0, 400) || null,
      prezzo,
      disponibile,
      allergeni,
    });
  }
  return { patches, skipped };
}
