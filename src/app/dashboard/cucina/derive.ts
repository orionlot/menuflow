import type { KitchenStage } from "@/app/dashboard/actions";

export type { KitchenStage };

/** Per-item kitchen stamps (subset of an order line). */
export interface ItemState {
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
}

/** Stage of a single dish, derived from its stamps. */
export function itemStageOf(it: ItemState): KitchenStage {
  if (it.servito_at) return "serviti";
  if (it.pronto_at) return "pronti";
  if (it.preparazione_at) return "in_preparazione";
  return "da_preparare";
}

const isReady = (it: ItemState) => Boolean(it.pronto_at || it.servito_at);

/** Order-level stage derived from its items (the chosen "all dishes" semantics). */
export function orderStageOf(items: ItemState[]): KitchenStage {
  if (items.length === 0) return "da_preparare";
  if (items.every((i) => i.servito_at)) return "serviti";
  if (items.every(isReady)) return "pronti";
  if (items.some((i) => i.preparazione_at || isReady(i))) return "in_preparazione";
  return "da_preparare";
}

const min = (xs: string[]) => xs.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
const max = (xs: string[]) => xs.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));

/** Roll the per-item stamps up to order-level (mirror of the SQL in 0043). */
export function rollupTimestamps(items: ItemState[]): {
  preparazione_at: string | null;
  pronto_at: string | null;
  servito_at: string | null;
} {
  const preps = items.map((i) => i.preparazione_at).filter((x): x is string => Boolean(x));
  const ready = items
    .map((i) => i.pronto_at ?? i.servito_at)
    .filter((x): x is string => Boolean(x));
  const served = items.map((i) => i.servito_at).filter((x): x is string => Boolean(x));
  const allReady = items.length > 0 && items.every(isReady);
  const allServed = items.length > 0 && items.every((i) => i.servito_at);
  return {
    preparazione_at: preps.length ? min(preps) : null,
    pronto_at: allReady && ready.length ? max(ready) : null,
    servito_at: allServed && served.length ? max(served) : null,
  };
}

/** Optimistic per-item stamp patch (forward-preserve / backward-clear). */
export function applyItemStageLocal<T extends ItemState>(it: T, stage: KitchenStage, nowIso: string): T {
  switch (stage) {
    case "da_preparare":
      return { ...it, preparazione_at: null, pronto_at: null, servito_at: null };
    case "in_preparazione":
      return { ...it, preparazione_at: it.preparazione_at ?? nowIso, pronto_at: null, servito_at: null };
    case "pronti":
      return {
        ...it,
        preparazione_at: it.preparazione_at ?? nowIso,
        pronto_at: it.pronto_at ?? nowIso,
        servito_at: null,
      };
    case "serviti":
      return { ...it, servito_at: it.servito_at ?? nowIso };
  }
}

/** Group active orders by table; asporto/delivery orders each get their own group. */
export function groupByTable<
  T extends { id: string; tavolo: string | null; sala?: string | null; asporto?: boolean; created_at: string },
>(orders: T[]): { key: string; tavolo: string | null; sala: string | null; asporto: boolean; orders: T[] }[] {
  const keyOf = (o: T) => (o.asporto || !o.tavolo ? `solo:${o.id}` : `tav:${o.tavolo}`);
  const byKey = new Map<string, T[]>();
  for (const o of orders) {
    const k = keyOf(o);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(o);
  }
  const groups = [...byKey.entries()].map(([key, os]) => {
    const sorted = [...os].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const head = sorted[0];
    return {
      key,
      tavolo: head.tavolo,
      sala: head.sala ?? null,
      asporto: Boolean(head.asporto),
      orders: sorted,
    };
  });
  // Oldest activity first (a table waiting longest floats up).
  return groups.sort((a, b) => a.orders[0].created_at.localeCompare(b.orders[0].created_at));
}
