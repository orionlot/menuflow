import { requireOwner } from "@/lib/auth";
import { FEATURES, isEntitled, isFeatureOn } from "@/lib/config/features";
import { updateFunzionalita } from "@/app/dashboard/actions";
import FeaturesOwner from "./FeaturesOwner";

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
    <div>
      <h1 className="mb-1 text-xl font-bold">Funzionalità</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Attiva o disattiva le funzioni del tuo menu. Alcune dipendono dal tuo piano.
      </p>
      <FeaturesOwner features={features} action={updateFunzionalita} />
    </div>
  );
}
