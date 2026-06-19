/**
 * Server-side validation for a table-reservation request. Pure + framework-free
 * so it can be unit-tested and reused. Never trust the client: every field is
 * re-checked here before the row is inserted.
 */
export interface PrenotazioneInput {
  nome: string;
  telefono: string;
  data: string; // YYYY-MM-DD
  ora: string; // HH:MM
  coperti: number;
  sala: string | null;
  note: string | null;
}

export type PrenotazioneResult =
  | { ok: true; value: PrenotazioneInput }
  | { ok: false; error: string };

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function validatePrenotazione(
  raw: {
    nome?: unknown;
    telefono?: unknown;
    data?: unknown;
    ora?: unknown;
    coperti?: unknown;
    sala?: unknown;
    note?: unknown;
  },
  opts: { minDate?: string } = {},
): PrenotazioneResult {
  const nome = clean(raw.nome, 80);
  if (nome.length < 2) return { ok: false, error: "Inserisci il tuo nome." };

  const telefono = clean(raw.telefono, 30);
  if (!/^[+\d][\d\s().\-]{5,}$/.test(telefono))
    return { ok: false, error: "Inserisci un numero di telefono valido." };

  const data = clean(raw.data, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
    return { ok: false, error: "Seleziona una data valida." };
  if (opts.minDate && data < opts.minDate)
    return { ok: false, error: "Scegli una data futura." };

  const ora = clean(raw.ora, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(ora))
    return { ok: false, error: "Seleziona un orario valido." };

  const coperti = Math.floor(Number(raw.coperti));
  if (!Number.isFinite(coperti) || coperti < 1 || coperti > 200)
    return { ok: false, error: "Numero di persone non valido." };

  const sala = clean(raw.sala, 60) || null;
  const note = clean(raw.note, 500) || null;

  return { ok: true, value: { nome, telefono, data, ora, coperti, sala, note } };
}
