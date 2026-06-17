import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tenantSubdomainUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import { isFeatureOn } from "@/lib/config/features";
import { contoGroupKey } from "@/lib/conto";
import { OrdersTimeline } from "./DashboardCharts";
import { PLANS, MULTILINGUA_ADDON, formatEUR } from "@/lib/config/plans";
import type { Order } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { restaurant } = await requireOwner();
  const publicUrl = tenantSubdomainUrl(await appOrigin(), restaurant.slug);
  const plan = PLANS[restaurant.piano];
  const monthly =
    plan.priceCents + (restaurant.multilingua ? MULTILINGUA_ADDON.priceCents : 0);

  const supabase = await createSupabaseServerClient();
  const contiOn = isFeatureOn(restaurant, "conti");
  const tempoStimatoOn = isFeatureOn(restaurant, "tempo_stimato");

  // ── Today's orders → KPIs + orders-per-hour timeline ──
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("orders")
    .select("totale, stato, scontrino_registrato, annullato_at, created_at")
    .eq("restaurant_id", restaurant.id)
    .is("annullato_at", null)
    .gte("created_at", since.toISOString());
  const today =
    (data as Pick<Order, "totale" | "stato" | "scontrino_registrato" | "annullato_at" | "created_at">[]) ?? [];
  const valid = today.filter((o) => o.stato === "ricevuto" || o.stato === "pagato");
  const incassoCents = Math.round(
    valid.reduce((s, o) => s + Number(o.totale || 0), 0) * 100,
  );
  const ordersToday = valid.length;
  const scontrini = today.filter(
    (o) => o.stato === "pagato" && !o.scontrino_registrato,
  ).length;

  // Orders-per-hour over the last ~9 hours (timeline replaces the occupancy bar).
  const nowH = new Date().getHours();
  const startH = Math.max(0, nowH - 8);
  const hourly: { hour: number; orders: number }[] = [];
  for (let h = startH; h <= nowH; h++) hourly.push({ hour: h, orders: 0 });
  for (const o of valid) {
    const slot = hourly.find((x) => x.hour === new Date(o.created_at).getHours());
    if (slot) slot.orders += 1;
  }

  // ── Active tables = distinct occupied (unsettled) dine-in tables, any day ──
  const { data: openRows } = await supabase
    .from("orders")
    .select("tavolo, sala")
    .eq("restaurant_id", restaurant.id)
    .is("conto_chiuso_at", null)
    .is("annullato_at", null)
    .eq("asporto", false)
    .not("tavolo", "is", null)
    .in("stato", ["ricevuto", "pagato"]);
  const activeTables = new Set(
    ((openRows as Pick<Order, "tavolo" | "sala">[]) ?? []).map((o) => contoGroupKey(o.sala, o.tavolo)),
  ).size;

  // ── Kitchen load → expired-prep alerts + service-status estimate ──
  let alerts = 0;
  let serviceStatus: "normale" | "alto" | "elevato" | null = null;
  if (tempoStimatoOn) {
    const { data: pend } = await supabase
      .from("orders")
      .select("preparazione_at, tempo_stimato")
      .eq("restaurant_id", restaurant.id)
      .in("stato", ["ricevuto", "pagato"])
      .is("annullato_at", null)
      .is("servito_at", null);
    const pending = (pend as Pick<Order, "preparazione_at" | "tempo_stimato">[]) ?? [];
    const nowMs = Date.now();
    alerts = pending.filter(
      (o) =>
        o.tempo_stimato &&
        o.preparazione_at &&
        nowMs > new Date(o.preparazione_at).getTime() + o.tempo_stimato * 60000,
    ).length;
    const ests = pending.map((o) => Number(o.tempo_stimato) || 0).filter((t) => t > 0);
    if (ests.length) {
      const avg = ests.reduce((s, t) => s + t, 0) / ests.length;
      serviceStatus = avg > 54 ? "elevato" : avg > 30 ? "alto" : "normale";
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI di oggi */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Oggi</h2>
          {tempoStimatoOn && serviceStatus && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                serviceStatus === "elevato"
                  ? "bg-red-100 text-red-700"
                  : serviceStatus === "alto"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
              }`}
              title="Stima sul tempo medio di preparazione degli ordini attivi"
            >
              Servizio: {serviceStatus}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiLink href="/dashboard/statistiche" label="Incasso" value={formatEUR(incassoCents)} />
          <KpiLink href="/dashboard/ordini" label="Ordini" value={String(ordersToday)} />
          <KpiLink
            href={contiOn ? "/dashboard/conti" : "/dashboard/cucina"}
            label={contiOn ? "Conti aperti" : "Tavoli attivi"}
            value={String(activeTables)}
          />
          <KpiLink
            href="/dashboard/reconciliation"
            label="Scontrini da battere"
            value={String(scontrini)}
            tone={scontrini > 0 ? "warn" : undefined}
          />
        </div>
        {tempoStimatoOn && alerts > 0 && (
          <Link
            href="/dashboard/cucina"
            className="mt-3 block rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            ⚠️ {alerts} ordin{alerts === 1 ? "e" : "i"} oltre il tempo di preparazione stimato → vai in
            Cucina
          </Link>
        )}
        {ordersToday === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Nessun ordine oggi, per ora. I dati si aggiornano man mano che arrivano.
          </p>
        ) : (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Andamento ordini (ultime ore)
            </h3>
            <OrdersTimeline data={hourly} color={restaurant.colore_primario || "#525252"} />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Abbonamento
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Piano" value={plan.label} />
          <Stat label="Canone mensile" value={formatEUR(monthly)} />
          <Stat
            label="Stato"
            value={restaurant.attivo ? "Attivo" : "Sospeso"}
            tone={restaurant.attivo ? "ok" : "bad"}
          />
          <Stat
            label="Pagamenti al tavolo"
            value={restaurant.pagamenti_attivi ? "On" : "Off"}
          />
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          {restaurant.multilingua
            ? `Add-on Multilingua attivo (+${formatEUR(MULTILINGUA_ADDON.priceCents)}/mese).`
            : "Add-on Multilingua non attivo."}{" "}
          Rinnovo e fatturazione gestiti via Stripe Billing.
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Azioni rapide
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/menu"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Gestisci menu
          </Link>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            Vedi menu pubblico
          </a>
          <Link
            href="/dashboard/qr"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            QR code
          </Link>
        </div>
      </section>
    </div>
  );
}

function KpiLink({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${tone === "warn" ? "text-amber-600" : "text-neutral-900"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-brand opacity-0 transition group-hover:opacity-100">
        Apri →
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`text-lg font-semibold ${
          tone === "ok"
            ? "text-green-600"
            : tone === "bad"
              ? "text-red-600"
              : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
