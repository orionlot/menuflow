import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MenuItem, Restaurant } from "@/types/db";
import MenuManager from "@/app/dashboard/(app)/menu/MenuManager";
import { isFeatureOn } from "@/lib/config/features";
import {
  adminCreateItem,
  adminUpdateItem,
  adminDeleteItem,
  adminUpdateAggiunte,
  adminUpdateReparti,
  adminUpdateCategoriaTempi,
  adminSetCapienzaDefault,
  adminReorderItems,
  adminDuplicateItem,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: rData } = await admin
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const restaurant = rData as Restaurant | null;
  if (!restaurant) {
    return <p className="text-neutral-500">Ristorante non trovato.</p>;
  }
  const { data } = await admin
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", id)
    .order("categoria", { ascending: true })
    .order("ordine", { ascending: true });

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-cyan-700 hover:text-cyan-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
      >
        ← Tutti i ristoranti
      </Link>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Menu di <b className="text-slate-900">{restaurant.nome}</b> (gestione admin)
      </p>
      <MenuManager
        restaurant={{
          id: restaurant.id,
          multilingua: restaurant.multilingua,
          lingue: restaurant.lingue,
        }}
        initialItems={(data as MenuItem[]) ?? []}
        initialAggiunte={restaurant.aggiunte ?? []}
        reparti={restaurant.reparti ?? []}
        scorteOn={isFeatureOn(restaurant, "scorte")}
        repartoOn={isFeatureOn(restaurant, "reparto")}
        tempoStimatoOn={isFeatureOn(restaurant, "tempo_stimato")}
        categoriaTempi={restaurant.categoria_tempi ?? {}}
        capienzaDefault={restaurant.capienza_default}
        actions={{
          createItem: adminCreateItem.bind(null, restaurant.id),
          updateItem: adminUpdateItem,
          deleteItem: adminDeleteItem,
          duplicateItem: adminDuplicateItem,
          updateAggiunte: adminUpdateAggiunte.bind(null, restaurant.id),
          updateReparti: adminUpdateReparti.bind(null, restaurant.id),
          updateCategoriaTempi: adminUpdateCategoriaTempi.bind(null, restaurant.id),
          updateCapienzaDefault: adminSetCapienzaDefault.bind(null, restaurant.id),
          reorder: adminReorderItems,
        }}
      />
    </div>
  );
}
