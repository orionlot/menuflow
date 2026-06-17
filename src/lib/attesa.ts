/**
 * Customer wait estimate with a PARALLEL-capacity model. A kitchen prepares
 * several dishes at once (e.g. a pizzeria with 3 ovens), so the wait is NOT a
 * serial sum. Per reparto (station) the queue is processed in waves of
 * `capienza`: wait = ceil(dishes / capienza) × batch-prep. An order is ready
 * when its slowest station finishes, hence the MAX across stations.
 *
 * Pure + shared by /api/attesa (kitchen queue) and the public menu (queue + the
 * customer's cart), so both agree on the figure.
 */
import type { Reparto } from "@/types/db";

export interface RepartoLoad {
  count: number; // dishes queued in this station
  prep: number; // batch prep minutes (longest dish in the station)
  capienza: number; // parallel slots
}

/** Effective prep (minutes): the item's own time, else its category average. */
export function effectivePrep(
  tempoPreparazione: number | null | undefined,
  categoria: string | null | undefined,
  categoriaTempi: Record<string, number> | null | undefined,
): number {
  if (typeof tempoPreparazione === "number" && tempoPreparazione > 0) return tempoPreparazione;
  const cat = Number((categoriaTempi ?? {})[categoria ?? ""]) || 0;
  return cat > 0 ? cat : 0;
}

/** Parallel capacity for a reparto id ("" = unassigned), with the kitchen default. */
export function capienzaFor(
  repartoId: string,
  reparti: Reparto[] | null | undefined,
  capienzaDefault: number | null | undefined,
): number {
  const r = (reparti ?? []).find((x) => x.id === repartoId);
  const cap = r?.capienza ?? (Number(capienzaDefault) || 0);
  return cap > 0 ? cap : 1;
}

/** Add `qta` dishes of effective prep `prep` to station `repartoId`. */
export function addLoad(
  loads: Record<string, RepartoLoad>,
  repartoId: string,
  qta: number,
  prep: number,
  capienza: number,
): void {
  if (qta <= 0 || prep <= 0) return;
  const cur = loads[repartoId];
  if (cur) {
    cur.count += qta;
    cur.prep = Math.max(cur.prep, prep);
  } else {
    loads[repartoId] = { count: qta, prep, capienza };
  }
}

/** Minutes until the whole load is served: max over stations of batched wait. */
export function waitMinutes(loads: Record<string, RepartoLoad>): number {
  let max = 0;
  for (const l of Object.values(loads)) {
    if (l.count <= 0 || l.prep <= 0) continue;
    max = Math.max(max, Math.ceil(l.count / Math.max(1, l.capienza)) * l.prep);
  }
  return Math.round(max);
}
