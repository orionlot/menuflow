import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tenantSubdomainUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import { isFeatureOn } from "@/lib/config/features";
import { contoGroupKey } from "@/lib/conto";
import { PLANS, MULTILINGUA_ADDON, formatEUR } from "@/lib/config/plans";
import type { Order } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { restaurant } = await requireOwner();
  const publicUrl = tenantSubdomainUrl(await appOrigin(), restaurant.slug);
  const plan = PLANS[restaurant.piano];
  const monthly =
    plan.priceCents + (restaurant.multilingua ? MULTILINGUA_ADDON.priceCents : 0);

  // KPI di oggi.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("totale, stato, scontrino_registrato, annullato_at")
    .eq("restaurant_id", restaurant.id)
    .is("annullato_at", null)
    .gte("created_at", since.toISOString());
  const today =
    (data as Pick<Order, "totale" | "stato" | "scontrino_registrato" | "annullato_at">[]) ?? [];
  const valid = today.filter((o) => o.stato === "ricevuto" || o.stato === "pagato");
  const incassoCents = Math.round(
    valid.reduce((s, o) => s + Number(o.totale || 0), 0) * 100,
  );
  const ordersToday = valid.length;
  const scontrini = today.filter(
    (o) => o.stato === "pagato" && !o.scontrino_registrato,
  ).length;

  // Open contos = distinct dine-in tables with unsettled orders (any day).
  const contiOn = isFeatureOn(restaurant, "conti");
  let contiAperti = 0;
  if (contiOn) {
    const { data: openRows } = await supabase
      .from("orders")
      .select("tavolo, sala")
      .eq("restaurant_id", restaurant.id)
      .is("conto_chiuso_at", null)
      .is("annullato_at", null)
      .eq("asporto", false)
      .not("tavolo", "is", null)
      .in("stato", ["ricevuto", "pagato"]);
    contiAperti = new Set(
      ((openRows as Pick<Order, "tavolo" | "sala">[]) ?? []).map((o) => contoGroupKey(o.sala, o.tavolo)),
    ).size;
  }

  return (
    <div className="space-y-6">
      {/* KPI di oggi */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Oggi
        </h2>
        <div className={`grid grid-cols-2 gap-3 ${contiOn ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <KpiLink href="/dashboard/statistiche" label="Incasso" value={formatEUR(incassoCents)} />
          <KpiLink href="/dashboard/ordini" label="Ordini" value={String(ordersToday)} />
          {contiOn && (
            <KpiLink href="/dashboard/conti" label="Conti aperti" value={String(contiAperti)} />
          )}
          <KpiLink
            href="/dashboard/reconciliation"
            label="Scontrini da battere"
            value={String(scontrini)}
            tone={scontrini > 0 ? "warn" : undefined}
          />
        </div>
        {ordersToday === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Nessun ordine oggi, per ora. I dati si aggiornano man mano che arrivano.
          </p>
        ) : null}
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
