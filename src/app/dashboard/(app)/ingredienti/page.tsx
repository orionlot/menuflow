import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublicIngredient } from "@/types/db";
import { isFeatureOn } from "@/lib/config/features";
import {
  updateComposizione,
  updateTaglie,
  upsertIngredient,
  deleteIngredient,
} from "@/app/dashboard/actions";
import InventoryManager from "./InventoryManager";

export const dynamic = "force-dynamic";

export default async function IngredientiPage() {
  const { restaurant } = await requireOwner();

  if (!isFeatureOn(restaurant, "componibili")) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h1 className="text-xl font-bold">Ingredienti &amp; inventario</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Questa sezione fa parte dell&apos;add-on <b>Componibili</b>. Attivalo dalle{" "}
          <Link href="/dashboard/funzionalita" className="text-brand underline">
            Funzionalità
          </Link>
          .
        </p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  // Menu categories drive the composition/size category pickers.
  const { data: items } = await supabase
    .from("menu_items")
    .select("categoria")
    .eq("restaurant_id", restaurant.id);
  const categories = [...new Set((items ?? []).map((i) => i.categoria as string))].sort((a, b) =>
    a.localeCompare(b),
  );

  const { data: ingRows } = await supabase
    .from("ingredients")
    .select("id, nome, categoria, prezzo, scorta, unita, ordine")
    .eq("restaurant_id", restaurant.id)
    .order("ordine", { ascending: true });
  const ingredienti = ((ingRows as PublicIngredient[]) ?? []).map((i) => ({
    ...i,
    prezzo: Number(i.prezzo),
  }));

  return (
    <InventoryManager
      initialIngredienti={ingredienti}
      initialComposizione={restaurant.composizione ?? []}
      initialTaglie={restaurant.composizione_taglie ?? []}
      categories={categories}
      actions={{ upsertIngredient, deleteIngredient, updateComposizione, updateTaglie }}
    />
  );
}
