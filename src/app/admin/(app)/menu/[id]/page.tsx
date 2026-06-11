import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MenuItem, Restaurant } from "@/types/db";
import MenuManager from "@/app/dashboard/(app)/menu/MenuManager";
import {
  adminCreateItem,
  adminUpdateItem,
  adminDeleteItem,
  adminUpdateAggiunte,
  adminReorderItems,
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
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-black">
        ← Tutti i ristoranti
      </Link>
      <p className="mb-4 mt-1 text-sm text-neutral-500">
        Menu di <b>{restaurant.nome}</b> (gestione admin)
      </p>
      <MenuManager
        restaurant={{
          id: restaurant.id,
          multilingua: restaurant.multilingua,
          lingue: restaurant.lingue,
        }}
        initialItems={(data as MenuItem[]) ?? []}
        initialAggiunte={restaurant.aggiunte ?? []}
        actions={{
          createItem: adminCreateItem.bind(null, restaurant.id),
          updateItem: adminUpdateItem,
          deleteItem: adminDeleteItem,
          updateAggiunte: adminUpdateAggiunte.bind(null, restaurant.id),
          reorder: adminReorderItems,
        }}
      />
    </div>
  );
}
