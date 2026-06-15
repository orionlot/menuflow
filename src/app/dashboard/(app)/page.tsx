import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildTenantUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import { PLANS, MULTILINGUA_ADDON, formatEUR } from "@/lib/config/plans";
import type { Order } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const { restaurant } = await requireOwner();
  const publicUrl = buildTenantUrl(await appOrigin(), restaurant.slug);
  const plan = PLANS[restaurant.piano];
  const monthly =
    plan.priceCents + (restaurant.multilingua ? MULTILINGUA_ADDON.priceCents : 0);

  // KPI di oggi.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("totale, stato, scontrino_registrato")
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", since.toISOString());
  const today =
    (data as Pick<Order, "totale" | "stato" | "scontrino_registrato">[]) ?? [];
  const valid = today.filter((o) => o.stato === "ricevuto" || o.stato === "pagato");
  const incassoCents = Math.round(
    valid.reduce((s, o) => s + Number(o.totale || 0), 0) * 100,
  );
  const ordersToday = valid.length;
  const scontrini = today.filter(
    (o) => o.stato === "pagato" && !o.scontrino_registrato,
  ).length;

  return (
    <div className="space-y-6">
      {/* KPI di oggi */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Oggi
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiLink href="/dashboard/statistiche" label="Incasso" value={formatEUR(incassoCents)} />
          <KpiLink href="/dashboard/ordini" label="Ordini" value={String(ordersToday)} />
          <KpiLink
            href="/dashboard/reconciliation"
            label="Scontrini da battere"
            value={String(scontrini)}
            tone={scontrini > 0 ? "warn" : undefined}
          />
        </div>
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
          tone === "ok" ? "text-green-600" : tone === "bad" ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
