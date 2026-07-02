import { cookies } from "next/headers";
import { requireOwner } from "@/lib/auth";
import { isFeatureOn } from "@/lib/config/features";
import { parseRuolo, RUOLO_COOKIE } from "@/lib/ruoli";
import KitchenClient from "./KitchenClient";

export const dynamic = "force-dynamic";

// Full-screen Kitchen Display — sits OUTSIDE the (app) layout so it has no
// dashboard chrome and uses the whole viewport. Still guarded by requireOwner.
export default async function CucinaPage() {
  const { restaurant } = await requireOwner();
  const ruolo = parseRuolo((await cookies()).get(RUOLO_COOKIE)?.value) ?? "all";
  return (
    <KitchenClient
      restaurantName={restaurant.nome}
      restaurantId={restaurant.id}
      ruolo={ruolo}
      repartoOn={isFeatureOn(restaurant, "reparto")}
      reparti={restaurant.reparti ?? []}
      tempoStimatoOn={isFeatureOn(restaurant, "tempo_stimato")}
      autoStampaOn={isFeatureOn(restaurant, "stampa_automatica")}
      portateOn={isFeatureOn(restaurant, "gestione_portate")}
    />
  );
}
