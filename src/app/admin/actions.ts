"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeBranding } from "@/lib/branding";
import { sanitizeFunzionalita } from "@/lib/config/features";
import { sanitizeItemPatch, sanitizeAggiunte, type ItemPatch } from "@/lib/menu";
import type { BrandingPatch, CategoryAddon, PlanId } from "@/types/db";

const PLAN_IDS: PlanId[] = ["base", "plus", "pro"];

// ── Admin menu management (any restaurant, service role) ──
export async function adminCreateItem(restaurantId: string, patch: ItemPatch) {
  await requireAdmin();
  const admin = createAdminClient();
  const clean = sanitizeItemPatch(patch);
  const { error } = await admin.from("menu_items").insert({
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
  revalidatePath("/admin");
  revalidatePath("/[domain]", "page");
}

export async function adminUpdateItem(itemId: string, patch: ItemPatch) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("menu_items")
    .update(sanitizeItemPatch(patch))
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/[domain]", "page");
}

export async function adminDeleteItem(itemId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("menu_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/[domain]", "page");
}

export async function adminReorderItems(
  updates: { id: string; ordine: number }[],
) {
  await requireAdmin();
  const admin = createAdminClient();
  const clean = (updates ?? [])
    .filter((u) => typeof u.id === "string" && Number.isFinite(u.ordine))
    .slice(0, 500);
  await Promise.all(
    clean.map((u) =>
      admin.from("menu_items").update({ ordine: u.ordine }).eq("id", u.id),
    ),
  );
  revalidatePath("/admin");
  revalidatePath("/[domain]", "page");
}

export async function adminUpdateAggiunte(
  restaurantId: string,
  aggiunte: CategoryAddon[],
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ aggiunte: sanitizeAggiunte(aggiunte) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/[domain]", "page");
}

function bool(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1";
}

export async function createRestaurant(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const piano = String(formData.get("piano") ?? "base") as PlanId;

  if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
    throw new Error("Slug non valido (usa minuscole, numeri e trattini).");
  }
  if (!nome) throw new Error("Nome obbligatorio.");

  const admin = createAdminClient();
  const { error } = await admin.from("restaurants").insert({
    slug,
    nome,
    piano: PLAN_IDS.includes(piano) ? piano : "base",
    multilingua: bool(formData.get("multilingua")),
    pagamenti_attivi: bool(formData.get("pagamenti_attivi")),
    lingue: bool(formData.get("multilingua")) ? ["it", "en"] : ["it"],
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function updateRestaurant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("ID mancante.");
  const piano = String(formData.get("piano") ?? "base") as PlanId;
  const multilingua = bool(formData.get("multilingua"));

  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({
      nome: String(formData.get("nome") ?? "").trim() || undefined,
      piano: PLAN_IDS.includes(piano) ? piano : "base",
      multilingua,
      lingue: multilingua ? ["it", "en"] : ["it"],
      pagamenti_attivi: bool(formData.get("pagamenti_attivi")),
      attivo: bool(formData.get("attivo")),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function setAttivo(id: string, attivo: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ attivo })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function addInitialMenuItem(formData: FormData) {
  await requireAdmin();
  const restaurantId = String(formData.get("restaurant_id") ?? "");
  const categoria = String(formData.get("categoria") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const prezzo = parseFloat(String(formData.get("prezzo") ?? ""));
  if (!restaurantId || !categoria || !nome || Number.isNaN(prezzo)) {
    throw new Error("Compila categoria, nome e prezzo.");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("menu_items").insert({
    restaurant_id: restaurantId,
    categoria,
    nome,
    prezzo: Math.max(0, prezzo),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/** Admin can edit any restaurant's branding (logo/color/theme/subtitle). */
export async function updateRestaurantBranding(
  restaurantId: string,
  patch: BrandingPatch,
) {
  await requireAdmin();
  const clean = sanitizeBranding(patch);
  if (Object.keys(clean).length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update(clean)
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/** Admin grants/revokes feature availability per tenant (overrides the plan). */
export async function updateRestaurantFunzionalita(
  restaurantId: string,
  funzionalitaAdmin: Record<string, boolean>,
) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ funzionalita_admin: sanitizeFunzionalita(funzionalitaAdmin) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminSignOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
