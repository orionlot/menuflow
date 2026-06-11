import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveLayout } from "@/lib/config/layout";
import BrandingForm from "@/components/BrandingForm";
import { updateBranding } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const { restaurant } = await requireOwner();

  // Distinct menu categories — used by the "hide photos per category" control.
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("menu_items")
    .select("categoria")
    .eq("restaurant_id", restaurant.id);
  const categories = Array.from(
    new Set(((rows as { categoria: string }[]) ?? []).map((r) => r.categoria)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Aspetto del menu</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Colori, logo, tema, layout e sottotitolo del tuo menu pubblico.
      </p>
      <BrandingForm
        restaurantId={restaurant.id}
        categories={categories}
        initial={{
          nome: restaurant.nome,
          sottotitolo: restaurant.sottotitolo,
          colore_primario: restaurant.colore_primario,
          colore_secondario: restaurant.colore_secondario,
          tema: restaurant.tema,
          layout: resolveLayout(restaurant.layout),
          logo_url: restaurant.logo_url,
          coperto: restaurant.coperto,
          coperto_modalita: restaurant.coperto_modalita,
          coperto_label: restaurant.coperto_label,
          accetta_mancia: restaurant.accetta_mancia,
          google_review_url: restaurant.google_review_url,
        }}
        action={updateBranding}
      />
    </div>
  );
}
