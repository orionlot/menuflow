import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuItem, PublicIngredient } from "@/types/db";
import MenuManager from "./MenuManager";
import { isFeatureOn } from "@/lib/config/features";
import {
  createItem,
  updateItem,
  deleteItem,
  updateAggiunte,
  reorderItems,
  duplicateItem,
  importItems,
  updateComposizione,
  updateTaglie,
  upsertIngredient,
  deleteIngredient,
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

  const componibiliOn = isFeatureOn(restaurant, "componibili");
  const { data: ingRows } = componibiliOn
    ? await supabase
        .from("ingredients")
        .select("id, nome, prezzo, scorta, unita, ordine")
        .eq("restaurant_id", restaurant.id)
        .order("ordine", { ascending: true })
    : { data: [] };
  const ingredienti = ((ingRows as PublicIngredient[]) ?? []).map((i) => ({
    ...i,
    prezzo: Number(i.prezzo),
  }));

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
      componibiliOn={componibiliOn}
      initialIngredienti={ingredienti}
      initialComposizione={restaurant.composizione ?? []}
      initialTaglie={restaurant.composizione_taglie ?? []}
      actions={{
        createItem,
        updateItem,
        deleteItem,
        duplicateItem,
        importItems,
        updateAggiunte,
        reorder: reorderItems,
        updateComposizione,
        updateTaglie,
        upsertIngredient,
        deleteIngredient,
      }}
    />
  );
}
