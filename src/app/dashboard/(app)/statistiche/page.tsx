import Link from "next/link";
import { RevenueByDayChart, OrdersByHourChart } from "./Charts";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEUR } from "@/lib/config/plans";
import { computeStats, kitchenTimings } from "@/lib/stats";
import { isFeatureOn } from "@/lib/config/features";
import type { Order } from "@/types/db";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

export default async function StatistichePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { restaurant } = await requireOwner();
  const sp = await searchParams;
  const range = (RANGES as readonly number[]).includes(Number(sp.range))
    ? Number(sp.range)
    : 30;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - range + 1);
  const prevSince = new Date(since);
  prevSince.setDate(prevSince.getDate() - range); // previous window of equal length

  const supabase = await createSupabaseServerClient();
  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .in("stato", ["ricevuto", "pagato"])
      .is("annullato_at", null)
      .gte("created_at", prevSince.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("menu_items")
      .select("id,categoria")
      .eq("restaurant_id", restaurant.id),
  ]);

  const allOrders = (ordersRes.data as Order[]) ?? [];
  const sinceIso = since.toISOString();
  const orders = allOrders.filter((o) => o.created_at >= sinceIso);
  const prevOrders = allOrders.filter((o) => o.created_at < sinceIso);

  const catMap = new Map<string, string>();
  for (const r of (itemsRes.data ?? []) as { id: string; categoria: string }[]) {
    catMap.set(r.id, r.categoria);
  }

  const s = computeStats(orders, catMap);
  const prev = computeStats(prevOrders, catMap);
  const kt = kitchenTimings(orders);
  const tempoStimatoOn = isFeatureOn(restaurant, "tempo_stimato");
  const maxProdQty = Math.max(1, ...s.topProducts.map((p) => p.qty));
  const maxCatRev = Math.max(1, ...s.byCategory.map((c) => c.revenueCents));
  const brandColor = restaurant.colore_primario || "#525252";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Statistiche</h1>
          <p className="text-sm text-neutral-500">
            {restaurant.nome} · ultimi {range} giorni · confronto col periodo
            precedente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/dashboard/export?range=${range}`}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            ⬇ Esporta CSV
          </a>
          <div className="flex items-center gap-0.5 rounded-lg border border-neutral-200 p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/dashboard/statistiche?range=${r}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  r === range
                    ? "bg-[var(--brand-soft)] text-brand"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {r}g
              </Link>
            ))}
          </div>
        </div>
      </div>

      {s.ordersCount === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
          <div className="text-3xl">📊</div>
          <div className="mt-2 text-sm font-medium text-neutral-700">
            Nessun ordine in questo periodo
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Quando arriveranno ordini, qui vedrai incassi, prodotti più venduti
            e fasce orarie. Prova ad ampliare l&apos;intervallo o condividi il QR
            del menù per ricevere i primi ordini.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* KPI */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Incasso"
              value={formatEUR(s.revenueCents)}
              delta={pctDelta(s.revenueCents, prev.revenueCents)}
            />
            <Kpi
              label="Ordini"
              value={String(s.ordersCount)}
              delta={pctDelta(s.ordersCount, prev.ordersCount)}
            />
            <Kpi
              label="Scontrino medio"
              value={formatEUR(s.avgCents)}
              delta={pctDelta(s.avgCents, prev.avgCents)}
            />
            <Kpi
              label="Pezzi venduti"
              value={String(s.units)}
              delta={pctDelta(s.units, prev.units)}
            />
          </div>

          {(s.peakHour !== null || s.peakDayLabel) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600">
              {s.peakHour !== null && (
                <span>
                  ⏰ Ora di punta:{" "}
                  <b>
                    {String(s.peakHour).padStart(2, "0")}:00–
                    {String((s.peakHour + 1) % 24).padStart(2, "0")}:00
                  </b>
                </span>
              )}
              {s.peakDayLabel && (
                <span>
                  📈 Giorno migliore: <b>{s.peakDayLabel}</b>
                </span>
              )}
            </div>
          )}

          {s.scontriniToRegister > 0 && (
            <Link
              href="/dashboard/reconciliation"
              className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
            >
              ⚠️ {s.scontriniToRegister} scontrin
              {s.scontriniToRegister === 1 ? "o" : "i"} da registrare → vai alla
              riconciliazione
            </Link>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Top prodotti */}
            <Card title="Prodotti più venduti">
              <ul className="space-y-2.5">
                {s.topProducts.map((p) => (
                  <li key={p.nome}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{p.nome}</span>
                      <span className="shrink-0 text-neutral-500">
                        {p.qty} pz · {formatEUR(p.revenueCents)}
                      </span>
                    </div>
                    <Track>
                      <Fill pct={(p.qty / maxProdQty) * 100} />
                    </Track>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Fascia oraria */}
            <Card title="Ordini per fascia oraria">
              <OrdersByHourChart data={s.byHour} color={brandColor} />
            </Card>
          </div>

          {/* Tempi medi in cucina (time-in-state reporting) */}
          {tempoStimatoOn && kt.served > 0 && (
            <Card title="Tempi medi in cucina">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KitchenStat label="In coda" value={`${kt.avgQueueMin}′`} hint="ordine → presa in carico" />
                <KitchenStat label="In preparazione" value={`${kt.avgPrepMin}′`} hint="preparazione → pronto" />
                <KitchenStat label="Pronto → servito" value={`${kt.avgReadyMin}′`} hint="attesa prima di servire" />
                <KitchenStat label="Ordini serviti" value={String(kt.served)} hint="nel periodo" />
              </div>
            </Card>
          )}

          {/* Andamento giornaliero */}
          <Card title="Incasso per giorno">
            <RevenueByDayChart data={s.byDay} color={brandColor} />
          </Card>

          {/* Per categoria */}
          {s.byCategory.length > 0 && (
            <Card title="Incasso per categoria">
              <ul className="space-y-2.5">
                {s.byCategory.map((c) => (
                  <li key={c.categoria}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{c.categoria}</span>
                      <span className="shrink-0 text-neutral-500">
                        {formatEUR(c.revenueCents)} · {c.qty} pz
                      </span>
                    </div>
                    <Track>
                      <Fill pct={(c.revenueCents / maxCatRev) * 100} />
                    </Track>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/** % change vs previous period. null = no baseline (previous period empty). */
function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900">
        {value}
      </div>
      {delta === null ? (
        <div className="mt-2 text-xs text-neutral-400">nuovo periodo</div>
      ) : delta !== undefined ? (
        <div
          className={`mt-2 text-xs font-medium ${
            delta >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))}%{" "}
          <span className="font-normal text-neutral-400">vs prec.</span>
        </div>
      ) : null}
    </div>
  );
}

function KitchenStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-neutral-400">{hint}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h2>
      {children}
    </div>
  );
}

function Track({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100/70">
      {children}
    </div>
  );
}

function Fill({ pct }: { pct: number }) {
  return (
    <div
      className="h-full rounded-full bg-neutral-800"
      style={{ width: `${Math.max(2, pct)}%` }}
    />
  );
}
