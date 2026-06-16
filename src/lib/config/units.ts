/** Controlled vocabulary for ingredient units of measure. Shared between the
 *  Inventario dropdown (client) and `upsertIngredient` (server whitelist) so the
 *  two never drift. Quantity (`scorta`) stays an integer; this is only the unit. */
export const UNITA_MISURA = [
  { value: "pz", label: "pz — pezzi" },
  { value: "porzione", label: "porzione" },
  { value: "g", label: "g — grammi" },
  { value: "kg", label: "kg — chilogrammi" },
  { value: "ml", label: "ml — millilitri" },
  { value: "l", label: "l — litri" },
  { value: "conf", label: "conf — confezioni" },
  { value: "bottiglia", label: "bottiglia" },
  { value: "lattina", label: "lattina" },
  { value: "fetta", label: "fetta" },
] as const;

export const UNITA_VALUES: readonly string[] = UNITA_MISURA.map((u) => u.value);

/** Server-side whitelist: returns a valid unit value or null (no free text). */
export function sanitizeUnita(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return UNITA_VALUES.includes(v) ? v : null;
}
