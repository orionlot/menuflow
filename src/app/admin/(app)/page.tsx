import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, MULTILINGUA_ADDON, formatEUR } from "@/lib/config/plans";
import { resolveLayout } from "@/lib/config/layout";
import { FEATURES, isEntitled } from "@/lib/config/features";
import { buildTenantUrl, tenantSubdomainUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import type { Restaurant } from "@/types/db";
import BrandingForm from "@/components/BrandingForm";
import LegalDataForm from "@/components/LegalDataForm";
import FeaturesAdmin from "./FeaturesAdmin";
import EmbedSnippet from "./EmbedSnippet";
import TenantsExplorer from "./TenantsExplorer";
import {
  addInitialMenuItem,
  adminCreateOrLinkOwner,
  adminDeleteRestaurant,
  adminSetOwnerPassword,
  adminUpdateDatiLegali,
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

  // Owner email per restaurant (to label the account when changing its password).
  // Best-effort: if the auth admin call fails, the page still renders.
  const emailById = new Map<string, string>();
  try {
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersData?.users ?? []) if (u.email) emailById.set(u.id, u.email);
  } catch {
    /* leave emails blank */
  }

  // Platform KPIs. MRR = sum of plan prices (+ multilingua add-on) of ACTIVE tenants.
  const attivi = restaurants.filter((r) => r.attivo);
  const sospesi = restaurants.length - attivi.length;
  const mrrCents = attivi.reduce(
    (s, r) => s + (PLANS[r.piano]?.priceCents ?? 0) + (r.multilingua ? MULTILINGUA_ADDON.priceCents : 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* KPI band */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tenant totali" value={String(restaurants.length)} />
        <Kpi label="Attivi" value={String(attivi.length)} />
        <Kpi label="Sospesi" value={String(sospesi)} accent={sospesi > 0 ? "magenta" : undefined} />
        <Kpi label="MRR stimato" value={formatEUR(mrrCents)} />
      </section>

      {/* Create */}
      <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition group-open:opacity-80">
            <span aria-hidden className="text-base leading-none">＋</span> Nuovo ristorante
          </span>
          <span className="text-xs text-slate-400 transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <form action={createRestaurant} className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-5 py-4">
          <Field label="Slug">
            <input name="slug" required placeholder="pizzeria-mario" className={inputClass} />
          </Field>
          <Field label="Nome">
            <input name="nome" required placeholder="Pizzeria da Mario" className={inputClass} />
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
            <input type="checkbox" name="multilingua" className={checkboxClass} /> Multilingua
          </label>
          <label className={checkboxLabelClass}>
            <input type="checkbox" name="pagamenti_attivi" className={checkboxClass} /> Pagamenti
          </label>
          <button className={btnPrimary}>Crea</button>
        </form>
      </details>

      {/* List: client-side search/filter over server-rendered cards */}
      <section>
        <TenantsExplorer
          plans={Object.values(PLANS).map((p) => ({ id: p.id, label: p.label }))}
          items={restaurants.map((r) => ({
            id: r.id,
            nome: r.nome,
            slug: r.slug,
            piano: r.piano,
            attivo: r.attivo,
            node: (
              <TenantCard key={r.id} r={r} origin={origin} ownerEmail={r.owner_id ? emailById.get(r.owner_id) : undefined} />
            ),
          }))}
        />
      </section>
    </div>
  );
}

/* ── Tenant card (server component: forms + actions unchanged) ─────────── */

function TenantCard({
  r,
  origin,
  ownerEmail,
}: {
  r: Restaurant;
  origin: string;
  ownerEmail?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Compact header row — always visible */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-500 font-display text-base font-bold text-white"
        >
          {r.nome.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={tenantSubdomainUrl(origin, r.slug)}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm font-semibold text-slate-900 hover:text-cyan-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              {r.nome}
            </a>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {PLANS[r.piano]?.label ?? r.piano}
            </span>
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                (r.attivo ? "bg-cyan-100 text-cyan-800" : "bg-fuchsia-100 text-fuchsia-700")
              }
            >
              {r.attivo ? "attivo" : "SOSPESO"}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">{r.slug}</span>
            <span aria-hidden>·</span>
            <Link
              href={`/admin/menu/${r.id}`}
              className="rounded-sm font-medium text-cyan-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              Gestisci menu →
            </Link>
          </div>
        </div>
        <form action={setAttivo.bind(null, r.id, !r.attivo)}>
          <button
            className={
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 " +
              (r.attivo
                ? "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200"
                : "bg-cyan-100 text-cyan-800 hover:bg-cyan-200")
            }
          >
            {r.attivo ? "Sospendi" : "Riattiva"}
          </button>
        </form>
      </div>

      {/* Full management — collapsed by default */}
      <details className="group border-t border-slate-100">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-2.5 text-sm font-medium text-cyan-700 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          Gestione completa
          <span className="text-xs text-slate-400 transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="space-y-3 px-5 pb-5">
          <form action={updateRestaurant} className="flex flex-wrap items-end gap-3 pt-2">
            <input type="hidden" name="id" value={r.id} />
            <Field label="Nome">
              <input name="nome" defaultValue={r.nome} className={inputClass} />
            </Field>
            <Field label="Piano">
              <select name="piano" defaultValue={r.piano} className={inputClass}>
                {Object.values(PLANS).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <label className={checkboxLabelClass}>
              <input type="checkbox" name="multilingua" defaultChecked={r.multilingua} className={checkboxClass} />{" "}
              Multilingua
            </label>
            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                name="pagamenti_attivi"
                defaultChecked={r.pagamenti_attivi}
                className={checkboxClass}
              />{" "}
              Pagamenti
            </label>
            <label
              className={checkboxLabelClass}
              title="Pagamenti simulati (finti). Disattiva per incassare davvero via Stripe."
            >
              <input type="checkbox" name="pagamenti_test" defaultChecked={r.pagamenti_test} className={checkboxClass} />{" "}
              Test (finti)
            </label>
            <label className={checkboxLabelClass}>
              <input type="checkbox" name="attivo" defaultChecked={r.attivo} className={checkboxClass} /> Attivo
            </label>
            <button className={btnSecondary}>Salva</button>
          </form>

          <details className="text-sm">
            <summary className={summaryClass}>Aspetto / brand</summary>
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

          <details className="text-sm">
            <summary className={summaryClass}>Funzionalità (disponibilità)</summary>
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

          <details className="text-sm">
            <summary className={summaryClass}>Incorpora (iframe)</summary>
            <div className="mt-3">
              <EmbedSnippet url={buildTenantUrl(origin, r.slug)} nome={r.nome} />
            </div>
          </details>

          <details className="text-sm">
            <summary className={summaryClass}>Inserimento menu iniziale</summary>
            <form action={addInitialMenuItem} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="restaurant_id" value={r.id} />
              <input name="categoria" placeholder="Categoria" className={inputClass} />
              <input name="nome" placeholder="Nome voce" className={inputClass} />
              <input name="prezzo" type="number" step="0.1" placeholder="Prezzo" className={`w-24 ${inputClass}`} />
              <button className={btnPrimary}>Aggiungi</button>
            </form>
          </details>

          <details className="text-sm">
            <summary className={summaryClass}>Dati legali (Cookie &amp; Privacy)</summary>
            <div className="mt-3">
              <LegalDataForm initial={r.dati_legali ?? {}} action={adminUpdateDatiLegali} restaurantId={r.id} />
            </div>
          </details>

          <details className="text-sm">
            <summary className={summaryClass}>Account negozio &amp; eliminazione</summary>
            <div className="mt-3 space-y-4">
              <p className="text-xs text-slate-500">
                Account di accesso:{" "}
                {ownerEmail ? (
                  <span className="font-medium text-slate-700">{ownerEmail}</span>
                ) : (
                  <span className="italic">nessun account collegato</span>
                )}
              </p>

              {r.owner_id ? (
                <form action={adminSetOwnerPassword} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <Field label="Nuova password (min 8)">
                    <input
                      name="password"
                      type="text"
                      minLength={8}
                      required
                      autoComplete="off"
                      placeholder="nuova password"
                      className={inputClass}
                    />
                  </Field>
                  <button className={btnSecondary}>Cambia password</button>
                </form>
              ) : (
                <form
                  action={adminCreateOrLinkOwner}
                  className="flex flex-wrap items-end gap-3 rounded-xl border border-cyan-100 bg-cyan-50/50 p-3"
                >
                  <input type="hidden" name="id" value={r.id} />
                  <Field label="Email titolare">
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="off"
                      placeholder="titolare@email.com"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Password (min 8)">
                    <input
                      name="password"
                      type="text"
                      minLength={8}
                      autoComplete="off"
                      placeholder="password"
                      className={inputClass}
                    />
                  </Field>
                  <button className={btnPrimary}>Crea / collega account</button>
                  <p className="w-full text-[11px] text-slate-400">
                    Se l&apos;email esiste già viene collegata (password opzionale, la cambia); altrimenti crea un
                    nuovo account (password obbligatoria).
                  </p>
                </form>
              )}

              <form
                action={adminDeleteRestaurant}
                className="flex flex-wrap items-end gap-3 rounded-xl border border-red-200 bg-red-50 p-3"
              >
                <input type="hidden" name="id" value={r.id} />
                <Field label={`Elimina TUTTO — digita "${r.slug}" per confermare`}>
                  <input name="confirm_slug" required autoComplete="off" placeholder={r.slug} className={inputClass} />
                </Field>
                <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                  Elimina negozio
                </button>
              </form>
              <p className="text-[11px] text-slate-400">
                Elimina il negozio e tutti i suoi dati (menu, ordini, ingredienti, domini) e l&apos;account di
                accesso. Irreversibile.
              </p>
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}

/* ── UI atoms ───────────────────────────────────────────────────────────── */

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "magenta" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={
          "mt-1 font-display text-2xl font-bold sm:text-3xl " +
          (accent === "magenta"
            ? "text-fuchsia-600"
            : "bg-gradient-to-r from-cyan-600 to-fuchsia-600 bg-clip-text text-transparent")
        }
      >
        {value}
      </p>
    </div>
  );
}

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100";

const checkboxClass = "accent-cyan-600";

const checkboxLabelClass = "flex items-center gap-2 text-sm font-medium text-slate-600";

const btnPrimary =
  "rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600";

const btnSecondary =
  "rounded-lg border border-cyan-200 bg-white px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600";

const summaryClass =
  "cursor-pointer rounded-sm text-sm font-medium text-slate-500 transition hover:text-cyan-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
      {label}
      {children}
    </label>
  );
}
