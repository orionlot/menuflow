import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/config/plans";
import { resolveLayout } from "@/lib/config/layout";
import { FEATURES, isEntitled } from "@/lib/config/features";
import { buildTenantUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import type { Restaurant } from "@/types/db";
import BrandingForm from "@/components/BrandingForm";
import FeaturesAdmin from "./FeaturesAdmin";
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
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Nome">
            <input
              name="nome"
              required
              placeholder="Pizzeria da Mario"
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Piano">
            <select
              name="piano"
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              {Object.values(PLANS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="multilingua" /> Multilingua
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="pagamenti_attivi" /> Pagamenti
          </label>
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Crea
          </button>
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
            <div className="mb-3 flex items-center justify-between">
              <div>
                <a
                  href={buildTenantUrl(origin, r.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  {r.nome}
                </a>
                <span className="ml-2 text-xs text-neutral-500">
                  {r.slug} · {r.attivo ? "attivo" : "SOSPESO"}
                </span>
                <Link
                  href={`/admin/menu/${r.id}`}
                  className="ml-3 text-xs text-blue-600 hover:underline"
                >
                  Gestisci menu →
                </Link>
              </div>
              <form action={setAttivo.bind(null, r.id, !r.attivo)}>
                <button
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    r.attivo
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
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
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
              </Field>
              <Field label="Piano">
                <select
                  name="piano"
                  defaultValue={r.piano}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                >
                  {Object.values(PLANS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="multilingua"
                  defaultChecked={r.multilingua}
                />{" "}
                Multilingua
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="pagamenti_attivi"
                  defaultChecked={r.pagamenti_attivi}
                />{" "}
                Pagamenti
              </label>
              <label
                className="flex items-center gap-1 text-sm"
                title="Pagamenti simulati (finti). Disattiva per incassare davvero via Stripe."
              >
                <input
                  type="checkbox"
                  name="pagamenti_test"
                  defaultChecked={r.pagamenti_test}
                />{" "}
                Test (finti)
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="attivo" defaultChecked={r.attivo} />{" "}
                Attivo
              </label>
              <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100">
                Salva
              </button>
            </form>

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-neutral-500">
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
                  }}
                  action={updateRestaurantBranding.bind(null, r.id)}
                />
              </div>
            </details>

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-neutral-500">
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
              <summary className="cursor-pointer text-neutral-500">
                Inserimento menu iniziale
              </summary>
              <form
                action={addInitialMenuItem}
                className="mt-2 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="restaurant_id" value={r.id} />
                <input
                  name="categoria"
                  placeholder="Categoria"
                  className="rounded-md border border-neutral-300 px-2 py-1"
                />
                <input
                  name="nome"
                  placeholder="Nome voce"
                  className="rounded-md border border-neutral-300 px-2 py-1"
                />
                <input
                  name="prezzo"
                  type="number"
                  step="0.1"
                  placeholder="Prezzo"
                  className="w-24 rounded-md border border-neutral-300 px-2 py-1"
                />
                <button className="rounded-md bg-neutral-900 px-3 py-1 text-white">
                  Aggiungi
                </button>
              </form>
            </details>
          </div>
        ))}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      {label}
      {children}
    </label>
  );
}
