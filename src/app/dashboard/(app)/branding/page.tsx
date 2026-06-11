import { requireOwner } from "@/lib/auth";
import BrandingForm from "@/components/BrandingForm";
import { updateBranding } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const { restaurant } = await requireOwner();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Aspetto del menu</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Colore, logo, tema e sottotitolo del tuo menu pubblico.
      </p>
      <BrandingForm
        restaurantId={restaurant.id}
        initial={{
          nome: restaurant.nome,
          sottotitolo: restaurant.sottotitolo,
          colore_primario: restaurant.colore_primario,
          tema: restaurant.tema,
          logo_url: restaurant.logo_url,
          coperto: restaurant.coperto,
          coperto_modalita: restaurant.coperto_modalita,
          coperto_label: restaurant.coperto_label,
          accetta_mancia: restaurant.accetta_mancia,
        }}
        action={updateBranding}
      />
    </div>
  );
}
