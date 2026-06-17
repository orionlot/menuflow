import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuItem } from "@/types/db";

export const dynamic = "force-dynamic";

/** Full, loss-less menu export (JSON): every fillable per-item field plus the
 *  restaurant-level menu config it references (extra/varianti per categoria,
 *  reparti, etichette, note, tempi). Round-trips through importMenuJson. */
export async function GET() {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return NextResponse.json({ ok: false, error: "Non autorizzato." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("menu_items")
    .select(
      "categoria, nome, nome_i18n, descrizione, descrizione_i18n, prezzo, prezzo_asporto, disponibile, foto_url, ordine, allergeni, opzioni, consigliato, scorta, ingredienti, composizione, composizione_taglie, nota, tempo_preparazione, peso, kcal, reparto, etichette, solo_pranzo, solo_cena",
    )
    .eq("restaurant_id", restaurant.id)
    .order("categoria", { ascending: true })
    .order("ordine", { ascending: true })
    .order("created_at", { ascending: true });

  const payload = {
    schema: "menuflow-menu-v1",
    esportato_il: new Date().toISOString(),
    ristorante: { slug: restaurant.slug, nome: restaurant.nome },
    config: {
      aggiunte: restaurant.aggiunte ?? [],
      composizione: restaurant.composizione ?? [],
      composizione_taglie: restaurant.composizione_taglie ?? [],
      reparti: restaurant.reparti ?? [],
      etichette: restaurant.etichette ?? [],
      note_config: restaurant.note_config ?? [],
      categoria_tempi: restaurant.categoria_tempi ?? {},
      capienza_default: restaurant.capienza_default ?? null,
    },
    items: (data as MenuItem[]) ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="menu-${restaurant.slug}-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
