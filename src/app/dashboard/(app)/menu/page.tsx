import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuItem, PublicIngredient } from "@/types/db";
import MenuManager from "./MenuManager";
import { isFeatureOn } from "@/lib/config/features";
import { getPopularItemIds } from "@/lib/tenant";
import {
  createItem,
  updateItem,
  deleteItem,
  updateAggiunte,
  updateNoteConfig,
  updateEtichette,
  updateReparti,
  updateCategoriaTempi,
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
        .select("id, nome, nome_i18n, categoria, prezzo, scorta, unita, peso, kcal, ordine")
        .eq("restaurant_id", restaurant.id)
        .order("ordine", { ascending: true })
    : { data: [] };
  const ingredientiList = ((ingRows as PublicIngredient[]) ?? []).map((i) => ({
    ...i,
    prezzo: Number(i.prezzo),
  }));

  const popularIds = await getPopularItemIds(restaurant.id);

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
      initialEtichette={restaurant.etichette ?? []}
      reparti={restaurant.reparti ?? []}
      scorteOn={isFeatureOn(restaurant, "scorte")}
      descrizioneOn={isFeatureOn(restaurant, "descrizione")}
      ingredientiOn={ingredientiOn}
      componibiliOn={componibiliOn}
      repartoOn={isFeatureOn(restaurant, "reparto")}
      prezzoAsportoOn={isFeatureOn(restaurant, "prezzo_asporto")}
      etichetteOn={isFeatureOn(restaurant, "etichette")}
      fasceOrarieOn={isFeatureOn(restaurant, "fasce_orarie")}
      tempoStimatoOn={isFeatureOn(restaurant, "tempo_stimato")}
      categoriaTempi={restaurant.categoria_tempi ?? {}}
      pesoOn={isFeatureOn(restaurant, "peso")}
      kcalOn={isFeatureOn(restaurant, "kcal")}
      ingredientiList={ingredientiList}
      popularIds={popularIds}
      actions={{
        createItem,
        updateItem,
        deleteItem,
        duplicateItem,
        importItems,
        updateAggiunte,
        updateNoteConfig,
        updateEtichette,
        updateReparti,
        updateCategoriaTempi,
        reorder: reorderItems,
      }}
    />
  );
}
