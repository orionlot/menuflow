import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { buildTenantUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import { PLANS, MULTILINGUA_ADDON, formatEUR } from "@/lib/config/plans";

export default async function DashboardHome() {
  const { restaurant } = await requireOwner();
  const publicUrl = buildTenantUrl(await appOrigin(), restaurant.slug);
  const plan = PLANS[restaurant.piano];
  const monthly =
    plan.priceCents + (restaurant.multilingua ? MULTILINGUA_ADDON.priceCents : 0);

  return (
    <div className="space-y-6">
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
