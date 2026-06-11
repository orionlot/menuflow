import { requireOwner } from "@/lib/auth";
import { FEATURES, isEntitled, isFeatureOn } from "@/lib/config/features";
import {
  updateFunzionalita,
  updateBranding,
  updateOrari,
  connectStripe,
  disconnectStripe,
} from "@/app/dashboard/actions";
import FeaturesOwner from "./FeaturesOwner";
import ServiceSettings from "./ServiceSettings";
import OrariSettings from "./OrariSettings";
import PagamentiSettings from "./PagamentiSettings";

export const dynamic = "force-dynamic";

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
          Tutte le opzioni del tuo locale in un posto: servizio (coperto e mancia) e funzioni del menu.
        </p>
      </div>

      <section>
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
          <OrariSettings initial={restaurant.orari} action={updateOrari} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Pagamenti</h2>
        <PagamentiSettings
          piano={restaurant.piano}
          stripeConnectId={restaurant.stripe_connect_id}
          pagamentiAttivi={restaurant.pagamenti_attivi}
          pagamentiTest={restaurant.pagamenti_test}
          connect={connectStripe}
          disconnect={disconnectStripe}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Funzioni del menu</h2>
        <FeaturesOwner features={features} action={updateFunzionalita} />
      </section>
    </div>
  );
}
