import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/config/plans";
import { resolveLayout } from "@/lib/config/layout";
import { FEATURES, isEntitled } from "@/lib/config/features";
import { buildTenantUrl, tenantSubdomainUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import type { Restaurant } from "@/types/db";
import BrandingForm from "@/components/BrandingForm";
import FeaturesAdmin from "./FeaturesAdmin";
import EmbedSnippet from "./EmbedSnippet";
import {
  addInitialMenuItem,
  createRestaurant,
  setAttivo,
  updateRestaurant,
  updateRestaurantBranding,
  updateRestaurantFunzionalita,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: true });
  const restaurants = (data as Restaurant[]) ?? [];
  const origin = await appOrigin();

  return (
    <div className="space-y-8">
      {/* Create */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Nuovo ristorante</h2>
        <form
          action={createRestaurant}
          className="flex flex-wrap items-end gap-3"
        >
          <Field label="Slug">
            <input
              name="slug"
              required
              placeholder="pizzeria-mario"
              className={inputClass}
            />
          </Field>
          <Field label="Nome">
            <input
              name="nome"
              required
              placeholder="Pizzeria da Mario"
              className={inputClass}
            />
          </Field>
          <Field label="Piano">
            <select name="piano" className={inputClass}>
              {Object.values(PLANS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="multilingua" /> Multilingua
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="pagamenti_attivi" /> Pagamenti
          </label>
          <button className={btnPrimary}>Crea</button>
        </form>
      </section>

      {/* List */}
      <section className="space-y-4">
        <h2 className="font-semibold">Ristoranti ({restaurants.length})</h2>
        {restaurants.map((r) => (
          <div
            key={r.id}
            className="rounded-xl border border-neutral-200 bg-white p-5"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={tenantSubdomainUrl(origin, r.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                  >
                    {r.nome}
                  </a>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                      (r.attivo
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700")
                    }
                  >
                    {r.attivo ? "attivo" : "SOSPESO"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>{r.slug}</span>
                  <span aria-hidden>·</span>
                  <Link
                    href={`/admin/menu/${r.id}`}
                    className="rounded-sm text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                  >
                    Gestisci menu →
                  </Link>
                </div>
              </div>
              <form action={setAttivo.bind(null, r.id, !r.attivo)}>
                <button
                  className={
                    "rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 " +
                    (r.attivo
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200")
                  }
                >
                  {r.attivo ? "Sospendi" : "Riattiva"}
                </button>
              </form>
            </div>

            <form action={updateRestaurant} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={r.id} />
              <Field label="Nome">
                <input
                  name="nome"
                  defaultValue={r.nome}
                  className={inputClass}
                />
              </Field>
              <Field label="Piano">
                <select
                  name="piano"
                  defaultValue={r.piano}
                  className={inputClass}
                >
                  {Object.values(PLANS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  name="multilingua"
                  defaultChecked={r.multilingua}
                />{" "}
                Multilingua
              </label>
              <label className={checkboxLabelClass}>
                <input
                  type="checkbox"
                  name="pagamenti_attivi"
                  defaultChecked={r.pagamenti_attivi}
                />{" "}
                Pagamenti
              </label>
              <label
                className={checkboxLabelClass}
                title="Pagamenti simulati (finti). Disattiva per incassare davvero via Stripe."
              >
                <input
                  type="checkbox"
                  name="pagamenti_test"
                  defaultChecked={r.pagamenti_test}
                />{" "}
                Test (finti)
              </label>
              <label className={checkboxLabelClass}>
                <input type="checkbox" name="attivo" defaultChecked={r.attivo} />{" "}
                Attivo
              </label>
              <button className={btnSecondary}>Salva</button>
            </form>

            <details className="mt-3 text-sm">
              <summary className={summaryClass}>
                Aspetto / brand
              </summary>
              <div className="mt-3">
                <BrandingForm
                  restaurantId={r.id}
                  categories={[]}
                  initial={{
                    nome: r.nome,
                    sottotitolo: r.sottotitolo,
                    colore_primario: r.colore_primario,
                    colore_secondario: r.colore_secondario,
                    tema: r.tema,
                    layout: resolveLayout(r.layout),
                    logo_url: r.logo_url,
                    coperto: r.coperto,
                    coperto_modalita: r.coperto_modalita,
                    coperto_label: r.coperto_label,
                    accetta_mancia: r.accetta_mancia,
                    google_review_url: r.google_review_url,
                    annuncio: r.annuncio,
                  }}
                  action={updateRestaurantBranding.bind(null, r.id)}
                />
              </div>
            </details>

            <details className="mt-3 text-sm">
              <summary className={summaryClass}>
                Funzionalità (disponibilità)
              </summary>
              <div className="mt-3">
                <FeaturesAdmin
                  restaurantId={r.id}
                  action={updateRestaurantFunzionalita}
                  features={FEATURES.map((f) => ({
                    id: f.id,
                    nome: f.nome,
                    pianoMinimo: f.pianoMinimo,
                    available: isEntitled(r, f.id),
                  }))}
                />
              </div>
            </details>

            <details className="mt-3 text-sm">
              <summary className={summaryClass}>
                Incorpora (iframe)
              </summary>
              <div className="mt-3">
                <EmbedSnippet url={buildTenantUrl(origin, r.slug)} nome={r.nome} />
              </div>
            </details>

            <details className="mt-3 text-sm">
              <summary className={summaryClass}>
                Inserimento menu iniziale
              </summary>
              <form
                action={addInitialMenuItem}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="restaurant_id" value={r.id} />
                <input
                  name="categoria"
                  placeholder="Categoria"
                  className={inputClass}
                />
                <input
                  name="nome"
                  placeholder="Nome voce"
                  className={inputClass}
                />
                <input
                  name="prezzo"
                  type="number"
                  step="0.1"
                  placeholder="Prezzo"
                  className={`w-24 ${inputClass}`}
                />
                <button className={btnPrimary}>Aggiungi</button>
              </form>
            </details>
          </div>
        ))}
      </section>
    </div>
  );
}

const inputClass =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

const checkboxLabelClass = "flex items-center gap-2 text-sm font-medium text-neutral-600";

const btnPrimary =
  "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

const btnSecondary =
  "rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

const summaryClass =
  "cursor-pointer rounded-sm text-sm font-medium text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-600">
      {label}
      {children}
    </label>
  );
}
