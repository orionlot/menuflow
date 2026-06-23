import { requireOwner } from "@/lib/auth";
import { FEATURES, isEntitled, isFeatureOn } from "@/lib/config/features";
import {
  updateFunzionalita,
  updateBranding,
  updateOrari,
  updateAperturaStato,
  updateChiusure,
  createStripeConnectOnboardingLink,
  disconnectStripe,
  updateTelegram,
  testTelegram,
  updateDatiLegali,
} from "@/app/dashboard/actions";
import LegalDataForm from "@/components/LegalDataForm";
import { isTelegramConfigured } from "@/lib/env";
import FeaturesOwner from "./FeaturesOwner";
import ServiceSettings from "./ServiceSettings";
import OrariSettings from "./OrariSettings";
import DisponibilitaSettings from "./DisponibilitaSettings";
import PagamentiSettings from "./PagamentiSettings";
import TelegramSettings from "./TelegramSettings";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "#servizio", label: "Servizio" },
  { href: "#pagamenti", label: "Pagamenti" },
  { href: "#notifiche", label: "Notifiche" },
  { href: "#funzioni", label: "Funzioni menu" },
  { href: "#legale", label: "Dati legali" },
];

export default async function FunzionalitaPage() {
  const { restaurant } = await requireOwner();
  const features = FEATURES.map((f) => ({
    id: f.id,
    nome: f.nome,
    descrizione: f.descrizione,
    pianoMinimo: f.pianoMinimo,
    entitled: isEntitled(restaurant, f.id),
    on: isFeatureOn(restaurant, f.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-bold">Funzionalità</h1>
        <p className="text-sm text-neutral-500">
          Tutte le opzioni del tuo locale in un posto: servizio, pagamenti,
          notifiche e funzioni del menu.
        </p>
      </div>

      {/* Anchor tabs — jump to a section. The clicked pill keeps focus,
          giving a brand-tinted "current section" cue without client JS. */}
      <nav
        aria-label="Sezioni funzionalità"
        className="flex flex-wrap gap-1.5 rounded-xl border border-neutral-200 bg-white p-1.5"
      >
        {TABS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 focus:bg-[var(--brand-soft)] focus:text-brand focus:outline-none"
          >
            {t.label}
          </a>
        ))}
      </nav>

      <section id="servizio" className="scroll-mt-28">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Servizio</h2>
        <ServiceSettings
          initial={{
            coperto: restaurant.coperto,
            coperto_modalita: restaurant.coperto_modalita,
            coperto_label: restaurant.coperto_label,
            accetta_mancia: restaurant.accetta_mancia,
            pagamenti_attivi: restaurant.pagamenti_attivi,
          }}
          action={updateBranding}
        />
        <div className="mt-3">
          <DisponibilitaSettings
            initialOverride={restaurant.aperto_override}
            initialChiusure={restaurant.chiusure ?? []}
            setStato={updateAperturaStato}
            setChiusure={updateChiusure}
          />
        </div>
        <div className="mt-3">
          <OrariSettings initial={restaurant.orari} action={updateOrari} />
        </div>
      </section>

      <section id="pagamenti" className="scroll-mt-28">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Pagamenti</h2>
        <PagamentiSettings
          piano={restaurant.piano}
          stripeConnectId={restaurant.stripe_connect_id}
          pagamentiAttivi={restaurant.pagamenti_attivi}
          pagamentiTest={restaurant.pagamenti_test}
          onboard={createStripeConnectOnboardingLink}
          disconnect={disconnectStripe}
        />
      </section>

      <section id="notifiche" className="scroll-mt-28">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Notifiche Telegram</h2>
        <TelegramSettings
          chatOrdini={restaurant.telegram_chat_ordini}
          chatPagamenti={restaurant.telegram_chat_pagamenti}
          tokenConfigured={isTelegramConfigured()}
          update={updateTelegram}
          test={testTelegram}
        />
      </section>

      <section id="funzioni" className="scroll-mt-28">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Funzioni del menu</h2>
        <FeaturesOwner features={features} action={updateFunzionalita} />
      </section>

      <section id="legale" className="scroll-mt-28">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Dati legali (Cookie & Privacy Policy)</h2>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <LegalDataForm initial={restaurant.dati_legali ?? {}} action={updateDatiLegali} />
        </div>
      </section>
    </div>
  );
}
