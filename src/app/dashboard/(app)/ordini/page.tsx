import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Order, ServiceRequest, MenuItem } from "@/types/db";
import OrdiniClient, { type PickerItem } from "./OrdiniClient";
import { isFeatureOn } from "@/lib/config/features";
import { menuItemNeedsChoice } from "@/lib/menu";
import { annullaOrdine, markServiceRequestHandled, createManualOrder } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

function dayRange(day: string) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function OrdiniPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { restaurant } = await requireOwner();
  const sp = await searchParams;
  const day = sp.day ?? new Date().toISOString().slice(0, 10);
  const { start, end } = dayRange(day);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });
  const orders = (data as Order[]) ?? [];

  // Pending service requests (call-waiter / ask-bill), last 6h.
  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: reqRows } = await supabase
    .from("service_requests")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .is("gestita_at", null)
    .gte("created_at", since6h)
    .order("created_at", { ascending: false });
  const requests = (reqRows as ServiceRequest[]) ?? [];

  // Menu items for the manual-order picker. The picker adds bare {item_id, qta}
  // (no option/size selection), so we only offer items that can be priced
  // without a mandatory choice — otherwise createManualOrder would reject them.
  const componibiliOn = isFeatureOn(restaurant, "componibili");
  const aggiunte = restaurant.aggiunte ?? [];
  const compoCat = restaurant.composizione ?? [];
  const taglieCat = restaurant.composizione_taglie ?? [];
  const { data: itemRows } = await supabase
    .from("menu_items")
    .select("id, nome, prezzo, categoria, disponibile, opzioni, composizione, composizione_taglie")
    .eq("restaurant_id", restaurant.id)
    .eq("disponibile", true)
    .order("categoria", { ascending: true })
    .order("ordine", { ascending: true });

  const pickerItems: PickerItem[] = ((itemRows as MenuItem[]) ?? [])
    .filter((i) => !menuItemNeedsChoice(i, aggiunte, compoCat, taglieCat, componibiliOn))
    .map((i) => ({
      id: i.id,
      nome: i.nome,
      prezzo: Number(i.prezzo),
      categoria: i.categoria,
      disponibile: i.disponibile,
    }));

  return (
    <OrdiniClient
      initialOrders={orders}
      initialRequests={requests}
      pickerItems={pickerItems}
      day={day}
      restaurantId={restaurant.id}
      stampaOn={isFeatureOn(restaurant, "stampa")}
      riepilogoOn={isFeatureOn(restaurant, "riepilogo")}
      asportoOn={isFeatureOn(restaurant, "asporto")}
      deliveryOn={isFeatureOn(restaurant, "delivery")}
      ordineManualeOn={isFeatureOn(restaurant, "ordine_manuale")}
      richiestaServizioOn={isFeatureOn(restaurant, "richiesta_servizio")}
      autoStampaOn={isFeatureOn(restaurant, "stampa_automatica")}
      copertoModalita={restaurant.coperto_modalita}
      portateOn={isFeatureOn(restaurant, "gestione_portate")}
      actions={{ annullaOrdine, markServiceRequestHandled, createManualOrder }}
    />
  );
}
