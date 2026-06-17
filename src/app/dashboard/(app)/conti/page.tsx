import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureOn } from "@/lib/config/features";
import type { Order } from "@/types/db";
import { estinguiConto, toggleScontrino } from "@/app/dashboard/actions";
import ContiClient from "./ContiClient";

export const dynamic = "force-dynamic";

export default async function ContiPage() {
  const { restaurant } = await requireOwner();
  if (!isFeatureOn(restaurant, "conti")) notFound();

  const supabase = await createSupabaseServerClient();
  // Open conto set: confirmed dine-in sales not yet settled. `asporto=false`
  // excludes both asporto and delivery (delivery sets asporto=true internally).
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .is("conto_chiuso_at", null)
    .is("annullato_at", null)
    .eq("asporto", false)
    .not("tavolo", "is", null)
    .in("stato", ["ricevuto", "pagato"])
    .order("created_at", { ascending: true });
  const orders = (data as Order[]) ?? [];

  return (
    <ContiClient
      initialOrders={orders}
      restaurantId={restaurant.id}
      actions={{ estinguiConto, toggleScontrino }}
    />
  );
}
