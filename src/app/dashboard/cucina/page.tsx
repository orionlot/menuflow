import { requireOwner } from "@/lib/auth";
import { isFeatureOn } from "@/lib/config/features";
import KitchenClient from "./KitchenClient";

export const dynamic = "force-dynamic";

// Full-screen Kitchen Display — sits OUTSIDE the (app) layout so it has no
// dashboard chrome and uses the whole viewport. Still guarded by requireOwner.
export default async function CucinaPage() {
  const { restaurant } = await requireOwner();
  return (
    <KitchenClient
      restaurantName={restaurant.nome}
      restaurantId={restaurant.id}
      repartoOn={isFeatureOn(restaurant, "reparto")}
      reparti={restaurant.reparti ?? []}
      tempoStimatoOn={isFeatureOn(restaurant, "tempo_stimato")}
    />
  );
}
