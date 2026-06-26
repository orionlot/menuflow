import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuItem } from "@/types/db";
import { isFeatureOn } from "@/lib/config/features";
import { menuItemNeedsChoice } from "@/lib/menu";
import {
  updateSale,
  createManualOrder,
  tavoliOccupati,
  contoTavolo,
  estinguiConto,
} from "@/app/dashboard/actions";
import SalaClient, { type PickerItem } from "./SalaClient";

export const dynamic = "force-dynamic";

export default async function SalaPage() {
  const { restaurant } = await requireOwner();

  if (!isFeatureOn(restaurant, "sala")) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h1 className="text-xl font-bold">Sala</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Disegna la mappa della sala e avvia ordini toccando un tavolo. Attiva la funzione{" "}
          <b>Mappa sala / tavoli</b> dalle{" "}
          <Link href="/dashboard/funzionalita" className="text-brand underline">
            Impostazioni
          </Link>
          .
        </p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
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

  // Occupied tables for the live floor-plan (conti-aware): a table is occupied
  // while it has an open order. With Conti on it frees on "estingui conto"
  // (conto_chiuso_at); with Conti off, when the order is served (servito_at).
  const contiOn = isFeatureOn(restaurant, "conti");
  let occQ = supabase
    .from("orders")
    .select("tavolo, sala")
    .eq("restaurant_id", restaurant.id)
    .is("annullato_at", null)
    .eq("asporto", false)
    .not("tavolo", "is", null)
    .in("stato", ["ricevuto", "pagato"]);
  occQ = contiOn ? occQ.is("conto_chiuso_at", null) : occQ.is("servito_at", null);
  const { data: occ } = await occQ;
  const initialOccupied = (occ ?? []) as { tavolo: string; sala: string | null }[];

  return (
    <SalaClient
      initialSale={restaurant.sale ?? []}
      pickerItems={pickerItems}
      asportoOn={isFeatureOn(restaurant, "asporto")}
      deliveryOn={isFeatureOn(restaurant, "delivery")}
      copertoModalita={restaurant.coperto_modalita}
      restaurantId={restaurant.id}
      initialOccupied={initialOccupied}
      contiOn={contiOn}
      actions={{ updateSale, createManualOrder, tavoliOccupati, contoTavolo, estinguiConto }}
    />
  );
}
