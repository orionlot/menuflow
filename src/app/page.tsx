import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { buildTenantUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import { PLANS, formatEUR, MULTILINGUA_ADDON } from "@/lib/config/plans";

export const dynamic = "force-dynamic";

async function getTenants() {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("restaurants")
      .select("slug, nome, piano, pagamenti_attivi, attivo")
      .order("created_at", { ascending: true });
    return data ?? [];
  } catch {
    return null;
  }
}

export default async function Home() {
  const tenants = await getTenants();
  const origin = await appOrigin();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">MenuFlow</h1>
        <p className="mt-2 text-lg text-neutral-600">
          Menu digitali e ordini al tavolo per ristoranti e bar. Una sola
          piattaforma, ogni locale è un sottodominio.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Locali (ambiente di sviluppo)
        </h2>
        {tenants === null ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            Backend non raggiungibile. Avvia Supabase con{" "}
            <code className="rounded bg-amber-100 px-1">npm run db:start</code> e
            ricarica.
          </div>
        ) : tenants.length === 0 ? (
          <p className="text-neutral-500">
            Nessun locale ancora. Crea il primo da /admin.
          </p>
        ) : (
          <ul className="space-y-3">
            {tenants.map((t) => (
              <li
                key={t.slug}
                className="flex items-center justify-between rounded-lg border border-neutral-200 p-4"
              >
                <div>
                  <a
                    href={buildTenantUrl(origin, t.slug)}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {t.nome}
                  </a>
                  <div className="text-xs text-neutral-500">
                    /{t.slug} · piano {t.piano}
                    {t.pagamenti_attivi ? " · pagamenti ON" : ""}
                    {!t.attivo ? " · SOSPESO" : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Aree riservate
        </h2>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Dashboard ristoratore
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            Admin
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Piani
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.values(PLANS).map((p) => (
            <div key={p.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="font-semibold">{p.label}</div>
              <div className="text-2xl font-bold">{formatEUR(p.priceCents)}</div>
              <div className="text-xs text-neutral-500">/mese</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Add-on {MULTILINGUA_ADDON.label}:{" "}
          {formatEUR(MULTILINGUA_ADDON.priceCents)}/mese.
        </p>
      </section>
    </main>
  );
}
