import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuItem } from "@/types/db";
import { isFeatureOn } from "@/lib/config/features";
import { menuItemNeedsChoice } from "@/lib/menu";
import { updateSale, createManualOrder } from "@/app/dashboard/actions";
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

  return (
    <SalaClient
      initialSale={restaurant.sale ?? []}
      pickerItems={pickerItems}
      asportoOn={isFeatureOn(restaurant, "asporto")}
      deliveryOn={isFeatureOn(restaurant, "delivery")}
      copertoModalita={restaurant.coperto_modalita}
      actions={{ updateSale, createManualOrder }}
    />
  );
}
