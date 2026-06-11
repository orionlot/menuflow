"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeBranding } from "@/lib/branding";
import { sanitizeFunzionalita } from "@/lib/config/features";
import { sanitizeItemPatch, sanitizeAggiunte, type ItemPatch } from "@/lib/menu";
import type { BrandingPatch, CategoryAddon } from "@/types/db";

export type { ItemPatch };

async function ownerRestaurantId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato.");
  const { data } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Nessun ristorante associato.");
  return data.id as string;
}

// RLS guarantees the owner can only touch items in their own restaurant.
export async function updateItem(itemId: string, patch: ItemPatch) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("menu_items")
    .update(sanitizeItemPatch(patch))
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page"); // instant sold-out/price on public menu
}

export async function createItem(patch: ItemPatch) {
  const restaurantId = await ownerRestaurantId();
  const supabase = await createSupabaseServerClient();
  const clean = sanitizeItemPatch(patch);
  const { error } = await supabase.from("menu_items").insert({
    restaurant_id: restaurantId,
    nome: clean.nome ?? "Nuova voce",
    categoria: clean.categoria ?? "Senza categoria",
    descrizione: clean.descrizione ?? null,
    prezzo: clean.prezzo ?? 0,
    disponibile: clean.disponibile ?? true,
    foto_url: clean.foto_url ?? null,
    ordine: clean.ordine ?? 0,
    nome_i18n: clean.nome_i18n ?? {},
    descrizione_i18n: clean.descrizione_i18n ?? {},
    allergeni: clean.allergeni ?? [],
    opzioni: clean.opzioni ?? [],
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page"); // instant sold-out/price on public menu
}

/** Category add-on groups (owner). Owners only SELECT restaurants → service role. */
export async function updateAggiunte(aggiunte: CategoryAddon[]) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ aggiunte: sanitizeAggiunte(aggiunte) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

/** Restaurateur toggles their own feature switches (entitlement is enforced in UI
 *  and re-checked server-side wherever a feature actually acts). */
export async function updateFunzionalita(funzionalita: Record<string, boolean>) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ funzionalita: sanitizeFunzionalita(funzionalita) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
  revalidatePath("/[domain]", "page");
}

export async function deleteItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page"); // instant sold-out/price on public menu
}

/** Persist a manual drag-and-drop reorder (RLS scopes to the owner's items). */
export async function reorderItems(updates: { id: string; ordine: number }[]) {
  const supabase = await createSupabaseServerClient();
  const clean = (updates ?? [])
    .filter((u) => typeof u.id === "string" && Number.isFinite(u.ordine))
    .slice(0, 500);
  await Promise.all(
    clean.map((u) =>
      supabase.from("menu_items").update({ ordine: u.ordine }).eq("id", u.id),
    ),
  );
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

export async function toggleScontrino(orderId: string, value: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ scontrino_registrato: value })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/reconciliation");
}

/** Notifiche: mark the owner's unread orders as seen. Without `ids`, marks all
 *  currently-unread orders. RLS + the explicit restaurant filter scope it. */
export async function markOrdersRead(ids?: string[]) {
  const restaurantId = await ownerRestaurantId();
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("orders")
    .update({ visto_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId)
    .is("visto_at", null);
  if (ids && ids.length) q = q.in("id", ids.slice(0, 500));
  const { error } = await q;
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ordini");
}

/** Kitchen: cook marks an order ready (rings the bell for waiters). */
export async function markOrderReady(orderId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ pronto_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/** Kitchen: a waiter picked it up — leaves the kitchen screen. */
export async function markOrderServed(orderId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ servito_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/** Kitchen: undo "ready" (back to to-prepare). */
export async function undoOrderReady(orderId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ pronto_at: null })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/**
 * Branding update by the restaurateur. Owners only have SELECT on restaurants
 * (plan/payment flags stay admin-controlled), so we verify ownership via the
 * RLS client, then write the whitelisted branding columns with the service role.
 */
export async function updateBranding(patch: BrandingPatch) {
  const restaurantId = await ownerRestaurantId(); // throws unless caller owns it
  const clean = sanitizeBranding(patch);
  if (Object.keys(clean).length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update(clean)
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/branding");
  revalidatePath("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/dashboard/login");
}
