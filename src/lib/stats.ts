import type { Order } from "@/types/db";

/**
 * Pure business-analytics aggregation for the restaurateur dashboard.
 * "Sales" = orders that represent a real sale: `ricevuto` (Caso A, paid at the
 * till) or `pagato` (Caso B, paid in app). `in_attesa_pagamento` and `fallito`
 * are excluded. Timing uses `created_at` (when the customer ordered).
 */

const SALES_STATES = new Set(["ricevuto", "pagato"]);

export interface Stats {
  revenueCents: number;
  ordersCount: number;
  avgCents: number;
  units: number;
  scontriniToRegister: number;
  topProducts: { nome: string; qty: number; revenueCents: number }[];
  byHour: { hour: number; orders: number; revenueCents: number }[]; // length 24
  byDay: { date: string; orders: number; revenueCents: number }[];
  byCategory: { categoria: string; qty: number; revenueCents: number }[];
  peakHour: number | null;
  peakDayLabel: string | null;
}

function cents(n: number): number {
  return Math.round(Number(n) * 100);
}

export function computeStats(
  orders: Order[],
  catByItemId: Map<string, string>,
): Stats {
  // Cancelled orders never count toward sales/revenue/charts.
  const sales = orders.filter((o) => SALES_STATES.has(o.stato) && !o.annullato_at);

  let revenueCents = 0;
  let units = 0;
  let scontriniToRegister = 0;

  const products = new Map<string, { nome: string; qty: number; revenueCents: number }>();
  const categories = new Map<string, { qty: number; revenueCents: number }>();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    revenueCents: 0,
  }));
  const days = new Map<string, { orders: number; revenueCents: number }>();

  for (const o of sales) {
    const oc = cents(o.totale);
    revenueCents += oc;

    if (o.stato === "pagato" && !o.scontrino_registrato) scontriniToRegister += 1;

    const d = new Date(o.created_at);
    const h = d.getHours();
    byHour[h].orders += 1;
    byHour[h].revenueCents += oc;

    const dayKey = o.created_at.slice(0, 10);
    const day = days.get(dayKey) ?? { orders: 0, revenueCents: 0 };
    day.orders += 1;
    day.revenueCents += oc;
    days.set(dayKey, day);

    for (const it of o.items ?? []) {
      const lineCents = cents(it.prezzo) * it.qta;
      units += it.qta;

      const key = it.item_id || it.nome;
      const p = products.get(key) ?? { nome: it.nome, qty: 0, revenueCents: 0 };
      p.qty += it.qta;
      p.revenueCents += lineCents;
      p.nome = it.nome;
      products.set(key, p);

      const cat = catByItemId.get(it.item_id) ?? "Altro";
      const c = categories.get(cat) ?? { qty: 0, revenueCents: 0 };
      c.qty += it.qta;
      c.revenueCents += lineCents;
      categories.set(cat, c);
    }
  }

  const ordersCount = sales.length;

  const topProducts = [...products.values()]
    .sort((a, b) => b.qty - a.qty || b.revenueCents - a.revenueCents)
    .slice(0, 10);

  const byCategory = [...categories.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const byDay = [...days.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const peakHourBucket = [...byHour].sort((a, b) => b.orders - a.orders)[0];
  const peakHour = peakHourBucket && peakHourBucket.orders > 0 ? peakHourBucket.hour : null;

  const peakDay = [...byDay].sort((a, b) => b.revenueCents - a.revenueCents)[0];
  const peakDayLabel =
    peakDay && peakDay.revenueCents > 0
      ? new Date(`${peakDay.date}T12:00:00`).toLocaleDateString("it-IT", {
          weekday: "long",
          day: "numeric",
          month: "short",
        })
      : null;

  return {
    revenueCents,
    ordersCount,
    avgCents: ordersCount ? Math.round(revenueCents / ordersCount) : 0,
    units,
    scontriniToRegister,
    topProducts,
    byHour,
    byDay,
    byCategory,
    peakHour,
    peakDayLabel,
  };
}
