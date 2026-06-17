/**
 * Conto (table bill) aggregation — shared by the on-screen conti board
 * (`ContiClient`) and the printed 80mm bill (`conto/stampa`) so the two can
 * never drift on how lines merge or how the total is computed.
 *
 * The grand total is the SUM of each order's already-server-computed `totale`
 * (never re-derived from lines + coperto + mancia), so it always equals what was
 * actually charged. Money is summed in integer cents to avoid float drift.
 */
import type { Order, OrderItem } from "@/types/db";

/** Max orders aggregated into one conto. Settle + print share this cap. */
export const MAX_CONTO_ORDERS = 500;

/** Sentinel for orders without a room, so a table key never collides. */
export const NO_SALA = " senza";

/** Group key for a table's conto: room + table (two rooms can reuse a name). */
export const contoGroupKey = (sala: string | null, tavolo: string | null): string =>
  `${sala ?? NO_SALA}|${tavolo}`;

/** euros → integer cents, rounded once. */
export const contoCents = (n: number | null | undefined): number => Math.round(Number(n ?? 0) * 100);

/** Stable signature so identical lines across a table's orders merge into one. */
export function lineKey(it: OrderItem): string {
  const opz = (it.opzioni ?? []).map((o) => `${o.gruppo}:${o.scelta}`).sort().join("|");
  const comp = (it.composizione ?? []).map((c) => `${c.nome}:${c.qta}`).sort().join("|");
  return [it.nome, it.taglia ?? "", opz, comp, Number(it.prezzo).toFixed(2)].join("§");
}

export interface ContoLine {
  nome: string;
  taglia?: string;
  opzioni: string;
  qta: number;
  totCents: number;
}

export interface ContoTotals {
  lines: ContoLine[];
  prodottiCents: number;
  copertoCents: number;
  manciaCents: number;
  totCents: number;
  coperti: number;
}

/** Aggregate a set of orders into one conto: merged priced lines + summed money. */
export function aggregateConto(orders: Order[]): ContoTotals {
  const lineMap = new Map<string, ContoLine>();
  let prodottiCents = 0;
  let copertoCents = 0;
  let manciaCents = 0;
  let totCents = 0;
  let coperti = 0;
  for (const o of orders) {
    copertoCents += contoCents(o.coperto_tot);
    manciaCents += contoCents(o.mancia);
    totCents += contoCents(o.totale);
    coperti += o.coperti ?? 0;
    for (const it of o.items ?? []) {
      const lc = contoCents(it.prezzo) * it.qta;
      prodottiCents += lc;
      const lk = lineKey(it);
      const cur = lineMap.get(lk);
      if (cur) {
        cur.qta += it.qta;
        cur.totCents += lc;
      } else {
        lineMap.set(lk, {
          nome: it.nome,
          taglia: it.taglia,
          opzioni: (it.opzioni ?? []).map((x) => x.scelta).join(", "),
          qta: it.qta,
          totCents: lc,
        });
      }
    }
  }
  return { lines: [...lineMap.values()], prodottiCents, copertoCents, manciaCents, totCents, coperti };
}
