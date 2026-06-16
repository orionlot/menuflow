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
  updateNoteConfig,
  reorderItems,
  duplicateItem,
  importItems,
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

  // The ingredient list feeds both the per-product ingredient checkboxes and the
  // per-item composition builder, so load it when either feature is on.
  const ingredientiOn = isFeatureOn(restaurant, "ingredienti");
  const componibiliOn = isFeatureOn(restaurant, "componibili");
  const { data: ingRows } = ingredientiOn || componibiliOn
    ? await supabase
        .from("ingredients")
        .select("id, nome, categoria, prezzo, scorta, unita, ordine")
        .eq("restaurant_id", restaurant.id)
        .order("ordine", { ascending: true })
    : { data: [] };
  const ingredientiList = ((ingRows as PublicIngredient[]) ?? []).map((i) => ({
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
      initialNoteConfig={restaurant.note_config ?? []}
      scorteOn={isFeatureOn(restaurant, "scorte")}
      descrizioneOn={isFeatureOn(restaurant, "descrizione")}
      ingredientiOn={ingredientiOn}
      componibiliOn={componibiliOn}
      ingredientiList={ingredientiList}
      actions={{
        createItem,
        updateItem,
        deleteItem,
        duplicateItem,
        importItems,
        updateAggiunte,
        updateNoteConfig,
        reorder: reorderItems,
      }}
    />
  );
}
