/**
 * I 14 allergeni a dichiarazione obbligatoria (Reg. UE 1169/2011, Allegato II).
 * `id` è la chiave salvata su menu_items.allergeni; `label` e `short` per la UI.
 */
export interface Allergene {
  id: string;
  label: string;
  short: string;
}

export const ALLERGENI: Allergene[] = [
  { id: "glutine", label: "Glutine (cereali)", short: "Glu" },
  { id: "crostacei", label: "Crostacei", short: "Cro" },
  { id: "uova", label: "Uova", short: "Uov" },
  { id: "pesce", label: "Pesce", short: "Pes" },
  { id: "arachidi", label: "Arachidi", short: "Ara" },
  { id: "soia", label: "Soia", short: "Soi" },
  { id: "latte", label: "Latte e lattosio", short: "Lat" },
  { id: "frutta_guscio", label: "Frutta a guscio", short: "Fru" },
  { id: "sedano", label: "Sedano", short: "Sed" },
  { id: "senape", label: "Senape", short: "Sen" },
  { id: "sesamo", label: "Sesamo", short: "Ses" },
  { id: "solfiti", label: "Anidride solforosa e solfiti", short: "Sol" },
  { id: "lupini", label: "Lupini", short: "Lup" },
  { id: "molluschi", label: "Molluschi", short: "Mol" },
];

export const ALLERGENI_BY_ID = new Map(ALLERGENI.map((a) => [a.id, a]));

export function allergeneLabel(id: string): string {
  return ALLERGENI_BY_ID.get(id)?.label ?? id;
}
export function allergeneShort(id: string): string {
  return ALLERGENI_BY_ID.get(id)?.short ?? id.slice(0, 3);
}
