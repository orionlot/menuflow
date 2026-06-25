import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFeatureOn } from "@/lib/config/features";
import type { Prenotazione } from "@/types/db";
import { setReservationStatus } from "@/app/dashboard/actions";
import PrenotazioniClient from "./PrenotazioniClient";

export const dynamic = "force-dynamic";

export default async function PrenotazioniPage() {
  const { restaurant } = await requireOwner();
  if (!isFeatureOn(restaurant, "prenotazioni")) notFound();

  // Today onward (Europe/Rome) — past days aren't actionable and would clutter the list.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("prenotazioni")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .gte("data", today)
    .order("data", { ascending: true })
    .order("ora", { ascending: true });

  return (
    <PrenotazioniClient
      initial={(data as Prenotazione[]) ?? []}
      setStatus={setReservationStatus}
      today={today}
    />
  );
}
