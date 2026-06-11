import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuItem } from "@/types/db";
import MenuManager from "./MenuManager";
import { isFeatureOn } from "@/lib/config/features";
import {
  createItem,
  updateItem,
  deleteItem,
  updateAggiunte,
  reorderItems,
} from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const { restaurant } = await requireOwner();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .order("categoria", { ascending: true })
    .order("ordine", { ascending: true });

  return (
    <MenuManager
      restaurant={{
        id: restaurant.id,
        multilingua: restaurant.multilingua,
        lingue: restaurant.lingue,
      }}
      initialItems={(data as MenuItem[]) ?? []}
      initialAggiunte={restaurant.aggiunte ?? []}
      scorteOn={isFeatureOn(restaurant, "scorte")}
      actions={{
        createItem,
        updateItem,
        deleteItem,
        updateAggiunte,
        reorder: reorderItems,
      }}
    />
  );
}
