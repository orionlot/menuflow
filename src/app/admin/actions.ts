"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeBranding } from "@/lib/branding";
import { sanitizeDatiLegali } from "@/lib/legal";
import { sanitizeFunzionalita } from "@/lib/config/features";
import {
  sanitizeItemPatch,
  sanitizeAggiunte,
  sanitizeReparti,
  sanitizeCategoriaTempi,
  type ItemPatch,
} from "@/lib/menu";
import type { BrandingPatch, CategoryAddon, PlanId, Reparto } from "@/types/db";

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

export async function adminUpdateReparti(restaurantId: string, reparti: Reparto[]) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ reparti: sanitizeReparti(reparti) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/[domain]", "page");
}

export async function adminUpdateCategoriaTempi(restaurantId: string, value: Record<string, number>) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ categoria_tempi: sanitizeCategoriaTempi(value) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/[domain]", "page");
}

export async function adminSetCapienzaDefault(restaurantId: string, value: number | null) {
  await requireAdmin();
  const admin = createAdminClient();
  const n = Math.floor(Number(value) || 0);
  const { error } = await admin
    .from("restaurants")
    .update({ capienza_default: n > 0 ? Math.min(50, n) : null })
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
      pagamenti_test: bool(formData.get("pagamenti_test")),
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

/**
 * Admin: set a new login password for a shop's owner account. The owner is
 * resolved from restaurants.owner_id and updated via the service-role auth admin
 * API. Guarded by requireAdmin (the page guard alone wouldn't stop a direct call).
 */
const LEGAL_FIELDS = [
  "titolare",
  "piva",
  "indirizzo",
  "sede_legale",
  "email",
  "pec",
  "telefono",
  "dominio",
  "aggiornato_il",
] as const;

/** Admin edits any shop's legal/privacy data (fills its policy pages). */
export async function adminUpdateDatiLegali(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("ID mancante.");
  const o: Record<string, string> = {};
  for (const k of LEGAL_FIELDS) o[k] = String(formData.get(k) ?? "");
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ dati_legali: sanitizeDatiLegali(o) })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminSetOwnerPassword(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id) throw new Error("ID mancante.");
  if (password.length < 8) throw new Error("La password deve avere almeno 8 caratteri.");

  const admin = createAdminClient();
  const { data: r } = await admin
    .from("restaurants")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();
  const ownerId = (r as { owner_id: string | null } | null)?.owner_id ?? null;
  if (!ownerId) throw new Error("Questo negozio non ha un account di accesso collegato.");

  const { error } = await admin.auth.admin.updateUserById(ownerId, { password });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/**
 * Admin: attach an owner login account to a shop that has none (or re-assign it).
 * If a user with the given email already exists it is linked (and its password
 * updated when one is provided); otherwise a new confirmed user is created with
 * the given password and linked. Sets restaurants.owner_id. requireAdmin-guarded.
 */
export async function adminCreateOrLinkOwner(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!id) throw new Error("ID mancante.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Email non valida.");

  const admin = createAdminClient();
  // Find an existing auth user with this email (the admin API has no get-by-email).
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = (list?.users ?? []).find((u) => u.email?.toLowerCase() === email) ?? null;

  if (user) {
    // Existing account → optionally reset its password to the provided one.
    if (password) {
      if (password.length < 8) throw new Error("La password deve avere almeno 8 caratteri.");
      const { error } = await admin.auth.admin.updateUserById(user.id, { password });
      if (error) throw new Error(error.message);
    }
  } else {
    // No such account → create it (a password is required to create).
    if (password.length < 8) throw new Error("Per creare l'account serve una password di almeno 8 caratteri.");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data?.user) throw new Error(error?.message ?? "Impossibile creare l'account.");
    user = data.user;
  }

  const { error: linkErr } = await admin.from("restaurants").update({ owner_id: user.id }).eq("id", id);
  if (linkErr) throw new Error(linkErr.message);
  revalidatePath("/admin");
}

/**
 * Admin: permanently delete a shop and ALL its data — menu, orders, ingredients,
 * custom domains (via ON DELETE CASCADE) — plus its owner login account, unless
 * that account also owns another shop. Requires typing the slug to confirm, so a
 * misclick can't wipe a tenant. Guarded by requireAdmin; service-role only.
 */
export async function adminDeleteRestaurant(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const confirmSlug = String(formData.get("confirm_slug") ?? "").trim();
  if (!id) throw new Error("ID mancante.");

  const admin = createAdminClient();
  const { data: r } = await admin
    .from("restaurants")
    .select("slug, owner_id")
    .eq("id", id)
    .maybeSingle();
  const row = r as { slug: string; owner_id: string | null } | null;
  if (!row) throw new Error("Negozio non trovato.");
  if (confirmSlug !== row.slug)
    throw new Error(`Conferma non valida: digita esattamente lo slug "${row.slug}" per eliminare.`);

  // Delete the restaurant → cascades menu_items / orders / ingredients /
  // custom_domains (all those FKs are ON DELETE CASCADE).
  const { error } = await admin.from("restaurants").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // Remove the owner login too — but only if no OTHER shop still uses that account.
  if (row.owner_id) {
    const { count } = await admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", row.owner_id);
    if (!count) {
      const { error: uErr } = await admin.auth.admin.deleteUser(row.owner_id);
      if (uErr) console.error(`[adminDeleteRestaurant] owner ${row.owner_id} delete failed:`, uErr.message);
    }
  }
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

export async function adminDuplicateItem(itemId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("menu_items")
    .select("*")
    .eq("id", itemId)
    .single();
  if (!item) throw new Error("Voce non trovata.");
  const { error } = await admin.from("menu_items").insert({
    restaurant_id: item.restaurant_id,
    categoria: item.categoria,
    nome: `${item.nome} (copia)`,
    nome_i18n: item.nome_i18n ?? {},
    descrizione: item.descrizione ?? null,
    descrizione_i18n: item.descrizione_i18n ?? {},
    prezzo: item.prezzo,
    foto_url: item.foto_url ?? null,
    disponibile: item.disponibile,
    ordine: (item.ordine ?? 0) + 1,
    allergeni: item.allergeni ?? [],
    opzioni: item.opzioni ?? [],
    consigliato: false,
    scorta: item.scorta ?? null,
    ingredienti: item.ingredienti ?? [],
    composizione: item.composizione ?? [],
    composizione_taglie: item.composizione_taglie ?? [],
    nota: item.nota ?? {},
    tempo_preparazione: item.tempo_preparazione ?? null,
    reparto: item.reparto ?? "",
    prezzo_asporto: item.prezzo_asporto ?? null,
    etichette: item.etichette ?? [],
    solo_pranzo: item.solo_pranzo ?? false,
    solo_cena: item.solo_cena ?? false,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function adminSignOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
