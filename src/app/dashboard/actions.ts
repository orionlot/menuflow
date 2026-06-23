"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe/connect";
import { sanitizeBranding } from "@/lib/branding";
import { sanitizeFunzionalita, isFeatureOn } from "@/lib/config/features";
import { sanitizeUnita } from "@/lib/config/units";
import { priceCartServerSide } from "@/lib/pricing";
import { computeCopertoCents } from "@/lib/pricing-core";
import { notifyNewOrder } from "@/lib/telegram";
import { decrementMenuItemStock } from "@/lib/menu-stock";
import { decrementIngredientStock, composableCategories } from "@/lib/ingredients";
import { sanitizeOrari, sanitizeChiusure } from "@/lib/orari";
import { notifyTest } from "@/lib/telegram";
import {
  sanitizeItemPatch,
  sanitizeAggiunte,
  sanitizeComposizione,
  sanitizeTaglie,
  sanitizeNoteConfig,
  sanitizeEtichette,
  sanitizeReparti,
  sanitizeSale,
  sanitizeI18n,
  sanitizeCategoriaTempi,
  sanitizeCategorieOrdine,
  type ItemPatch,
} from "@/lib/menu";
import { parseCsv, rowsToItemPatches } from "@/lib/csv";
import { sanitizeDatiLegali, datiLegaliFromForm } from "@/lib/legal";
import { MAX_CONTO_ORDERS } from "@/lib/conto";
import { appOrigin } from "@/lib/origin";
import { getOrCreateBillingCustomer, createSubscriptionCheckout, createBillingPortal } from "@/lib/stripe/billing";
import type { PlanId } from "@/lib/config/plans";
import type {
  BrandingPatch,
  CategoryAddon,
  ComposizioneGruppo,
  Order,
  PrenotazioneStato,
  PublicIngredient,
  Restaurant,
  TagliaComposizione,
} from "@/types/db";

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

/** Duplicate a menu item ("… (copia)"). RLS scopes it to the owner's items. */
export async function duplicateItem(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase
    .from("menu_items")
    .select("*")
    .eq("id", itemId)
    .single();
  if (!item) throw new Error("Voce non trovata.");
  const { error } = await supabase.from("menu_items").insert({
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
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

/** Bulk-import menu items from a CSV string (owner). RLS scopes the inserts. */
/**
 * Full menu import from a JSON export (importMenuJson). Restores every fillable
 * per-item field (via sanitizeItemPatch) AND merges the referenced restaurant
 * config (extra/varianti per categoria, reparti, etichette, note, tempi) so
 * item references (reparto/etichette ids) resolve. Items are APPENDED (re-import
 * adds copies — clear the menu first to replace). RLS via ownerRestaurantId.
 */
export async function importMenuJson(
  text: string,
): Promise<{ added: number; skipped: number; configApplied: boolean }> {
  const restaurantId = await ownerRestaurantId();
  let data: unknown;
  try {
    data = JSON.parse(String(text ?? ""));
  } catch {
    throw new Error("File JSON non valido.");
  }
  if (!data || typeof data !== "object") throw new Error("File JSON non valido.");
  const root = data as { config?: unknown; items?: unknown };
  const admin = createAdminClient();

  // 1) Merge config first so item refs (reparti/etichette ids) resolve.
  let configApplied = false;
  const cfg = (root.config ?? {}) as Record<string, unknown>;
  if (cfg && typeof cfg === "object") {
    const { data: rRow } = await admin
      .from("restaurants")
      .select(
        "aggiunte, composizione, composizione_taglie, reparti, etichette, note_config, categoria_tempi, capienza_default",
      )
      .eq("id", restaurantId)
      .maybeSingle();
    const cur = (rRow ?? {}) as Partial<Restaurant>;
    const patch: Record<string, unknown> = {};
    if (Array.isArray(cfg.reparti))
      patch.reparti = sanitizeReparti([...(cur.reparti ?? []), ...cfg.reparti]);
    if (Array.isArray(cfg.etichette))
      patch.etichette = sanitizeEtichette([...(cur.etichette ?? []), ...cfg.etichette]);
    if (Array.isArray(cfg.aggiunte))
      patch.aggiunte = sanitizeAggiunte([...(cur.aggiunte ?? []), ...cfg.aggiunte]);
    if (Array.isArray(cfg.composizione))
      patch.composizione = sanitizeComposizione([...(cur.composizione ?? []), ...cfg.composizione], {
        requireCategorie: true,
      });
    if (Array.isArray(cfg.composizione_taglie))
      patch.composizione_taglie = sanitizeTaglie(
        [...(cur.composizione_taglie ?? []), ...cfg.composizione_taglie],
        { requireCategorie: true },
      );
    if (Array.isArray(cfg.note_config))
      patch.note_config = sanitizeNoteConfig([...(cur.note_config ?? []), ...cfg.note_config]);
    if (cfg.categoria_tempi && typeof cfg.categoria_tempi === "object")
      patch.categoria_tempi = sanitizeCategoriaTempi({ ...(cur.categoria_tempi ?? {}), ...cfg.categoria_tempi });
    if ("capienza_default" in cfg) {
      const n = Math.floor(Number(cfg.capienza_default) || 0);
      patch.capienza_default = n > 0 ? Math.min(50, n) : null;
    }
    if (Object.keys(patch).length) {
      const { error } = await admin.from("restaurants").update(patch).eq("id", restaurantId);
      if (error) throw new Error(error.message);
      configApplied = true;
    }
  }

  // 2) Insert items with the full per-item field set (sanitized).
  const rawItems = Array.isArray(root.items) ? root.items : [];
  let skipped = 0;
  const rows: Record<string, unknown>[] = [];
  for (const it of rawItems.slice(0, 1000)) {
    if (!it || typeof it !== "object") {
      skipped++;
      continue;
    }
    const p = sanitizeItemPatch(it as ItemPatch);
    if (!p.nome || !p.nome.trim()) {
      skipped++;
      continue;
    }
    rows.push({
      restaurant_id: restaurantId,
      ...p,
      categoria: p.categoria || "Senza categoria",
      prezzo: p.prezzo ?? 0,
    });
  }
  if (rows.length) {
    const { error } = await admin.from("menu_items").insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
  return { added: rows.length, skipped, configApplied };
}

export async function importItems(
  csvText: string,
): Promise<{ added: number; skipped: number }> {
  const restaurantId = await ownerRestaurantId();
  const { patches, skipped } = rowsToItemPatches(parseCsv(String(csvText ?? "")));
  if (!patches.length) return { added: 0, skipped };
  const supabase = await createSupabaseServerClient();
  const rows = patches.slice(0, 500).map((p) => ({
    restaurant_id: restaurantId,
    categoria: p.categoria ?? "Senza categoria",
    nome: p.nome ?? "Voce",
    descrizione: p.descrizione ?? null,
    prezzo: p.prezzo ?? 0,
    disponibile: p.disponibile ?? true,
    allergeni: p.allergeni ?? [],
  }));
  const { error } = await supabase.from("menu_items").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
  return { added: rows.length, skipped };
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

/** Per-category composition config (owner). Owners only SELECT → service role. */
export async function updateComposizione(composizione: ComposizioneGruppo[]) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ composizione: sanitizeComposizione(composizione) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

/** Size variants per composable category (owner). */
export async function updateTaglie(taglie: TagliaComposizione[]) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ composizione_taglie: sanitizeTaglie(taglie) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

/** Create or update one ingredient (owner-scoped). Returns the saved row. */
export async function upsertIngredient(input: {
  id?: string;
  nome?: string;
  nome_i18n?: Record<string, string>;
  categoria?: string;
  prezzo?: number;
  scorta?: number | null;
  unita?: string | null;
  peso?: number | null;
  kcal_per_100g?: number | null;
  ordine?: number;
}): Promise<PublicIngredient> {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const clampNutri = (v: number | null | undefined) =>
    v == null ? null : Math.max(0, Math.min(100000, Math.round(Number(v) || 0)));
  const patch = {
    nome: String(input.nome ?? "").trim().slice(0, 60) || "Ingrediente",
    nome_i18n: sanitizeI18n(input.nome_i18n),
    categoria: String(input.categoria ?? "").trim().slice(0, 40),
    prezzo: Math.max(0, Math.round((Number(input.prezzo) || 0) * 100) / 100),
    scorta:
      input.scorta == null ? null : Math.max(0, Math.floor(Number(input.scorta) || 0)),
    unita: sanitizeUnita(input.unita),
    peso: clampNutri(input.peso),
    kcal_per_100g: clampNutri(input.kcal_per_100g),
    ordine: Math.floor(Number(input.ordine) || 0),
  };
  const cols = "id, nome, nome_i18n, categoria, prezzo, scorta, unita, peso, kcal_per_100g, ordine";
  if (input.id) {
    const { data, error } = await admin
      .from("ingredients")
      .update(patch)
      .eq("id", input.id)
      .eq("restaurant_id", restaurantId)
      .select(cols)
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/menu");
    revalidatePath("/[domain]", "page");
    const r = data as PublicIngredient;
    return { ...r, prezzo: Number(r.prezzo) };
  }
  const { data, error } = await admin
    .from("ingredients")
    .insert({ ...patch, restaurant_id: restaurantId })
    .select(cols)
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
  const r = data as PublicIngredient;
  return { ...r, prezzo: Number(r.prezzo) };
}

export async function deleteIngredient(id: string) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ingredients")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
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

export async function updateOrari(orari: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ orari: sanitizeOrari(orari) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
  revalidatePath("/[domain]", "page");
}

/** Manual open/close override: "auto" (use orari + chiusure), "aperto" (force
 *  open), "chiuso" (force closed). Overrides the fixed daily hours. */
export async function updateAperturaStato(stato: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const aperto_override = stato === "aperto" ? true : stato === "chiuso" ? false : null;
  const { error } = await admin
    .from("restaurants")
    .update({ aperto_override })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
  revalidatePath("/dashboard");
  revalidatePath("/[domain]", "page");
}

/** Scheduled closures (holidays / extraordinary closed days). */
export async function updateChiusure(chiusure: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ chiusure: sanitizeChiusure(chiusure) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
  revalidatePath("/[domain]", "page");
}

/** Reusable dish-label catalog (Etichette tab). */
export async function updateEtichette(etichette: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ etichette: sanitizeEtichette(etichette) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

/** Restaurateur-configured kitchen departments (Reparti tab + Kitchen Display). */
/** Default kitchen concurrency (dishes prepared at once) for the customer wait
 *  estimate, for items without a reparto. RLS via ownerRestaurantId. */
export async function setCapienzaDefault(value: number | null) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const n = Math.floor(Number(value) || 0);
  const { error } = await admin
    .from("restaurants")
    .update({ capienza_default: n > 0 ? Math.min(50, n) : null })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

/** Back-office (dashboard) light/dark theme. RLS via ownerRestaurantId. */
export async function setDashboardTema(tema: "light" | "dark") {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ dashboard_tema: tema === "dark" ? "dark" : "light" })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

/** Per-category average prep time (minutes). Fallback for the KDS estimate
 *  when a dish has no tempo_preparazione of its own. RLS via ownerRestaurantId. */
export async function updateCategoriaTempi(value: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ categoria_tempi: sanitizeCategoriaTempi(value) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard/cucina");
}

export async function updateCategorieOrdine(value: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ categorie_ordine: sanitizeCategorieOrdine(value) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
}

/** Restaurateur edits their own legal/privacy data (fills the policy pages). */
export async function updateDatiLegali(formData: FormData) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ dati_legali: sanitizeDatiLegali(datiLegaliFromForm(formData)) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
  revalidatePath("/[domain]/cookie-policy", "page");
  revalidatePath("/[domain]/privacy-policy", "page");
}

export async function updateReparti(reparti: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ reparti: sanitizeReparti(reparti) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/dashboard/cucina");
}

/** Floor-plan rooms + tables (Sala builder). */
export async function updateSale(sale: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ sale: sanitizeSale(sale) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/sala");
}

/** Category-scoped customer-note config. */
export async function updateNoteConfig(noteConfig: unknown) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ note_config: sanitizeNoteConfig(noteConfig) })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/menu");
  revalidatePath("/[domain]", "page");
}

/** Restaurateur connects their own Stripe Connect account (Plus/Pro only) so
 *  table payments land on their account. They paste their acct_… id. */
export async function connectStripe(accountId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato.");
  const { data: r } = await supabase
    .from("restaurants")
    .select("id, piano")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!r) throw new Error("Nessun ristorante associato.");
  if (r.piano !== "plus" && r.piano !== "pro")
    throw new Error("I pagamenti al tavolo sono disponibili dal piano Plus.");
  const id = String(accountId ?? "").trim();
  if (!/^acct_[A-Za-z0-9]+$/.test(id))
    throw new Error("ID Stripe non valido: deve iniziare con acct_.");

  // When Stripe is LIVE, verify the account exists and can actually accept
  // charges before routing table payments to it (a typo / someone else's id
  // would otherwise silently divert every payment). In test/stub mode (Stripe
  // not configured) we keep the bypass so the flow is testable without a real
  // Connect account — Stripe will be wired up later.
  if (isStripeConfigured()) {
    let chargesEnabled = false;
    try {
      const acct = await getStripe().accounts.retrieve(id);
      chargesEnabled = Boolean(acct.charges_enabled);
    } catch {
      throw new Error("Account Stripe non trovato o non accessibile con questa chiave.");
    }
    if (!chargesEnabled)
      throw new Error(
        "L'account Stripe non è ancora abilitato ai pagamenti: completa l'onboarding su Stripe e riprova.",
      );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ stripe_connect_id: id, pagamenti_attivi: true })
    .eq("id", r.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
  revalidatePath("/[domain]", "page");
}

export async function disconnectStripe() {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ stripe_connect_id: null, pagamenti_attivi: false })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
  revalidatePath("/[domain]", "page");
}

/** Start (or resume) the plan subscription for an inactive tenant. */
export async function createBillingCheckoutSession(): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured()) return { error: "Pagamenti non configurati." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };
  const { data: r } = await supabase
    .from("restaurants")
    .select("id, piano, multilingua, attivo, stripe_customer_id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!r) return { error: "Nessun ristorante associato." };
  if (r.attivo) return { error: "Abbonamento già attivo." };
  try {
    const admin = createAdminClient();
    const origin = await appOrigin();
    const customerId = await getOrCreateBillingCustomer(
      admin,
      { id: r.id as string, stripe_customer_id: r.stripe_customer_id as string | null },
      user.email ?? "",
    );
    const url = await createSubscriptionCheckout({
      customerId,
      restaurantId: r.id as string,
      piano: r.piano as PlanId,
      multilingua: Boolean(r.multilingua),
      successUrl: `${origin}/dashboard?abbonato=1`,
      cancelUrl: `${origin}/dashboard?abbonamento=incompleto`,
    });
    return url ? { url } : { error: "Impossibile avviare il pagamento. Riprova." };
  } catch {
    return { error: "Impossibile avviare il pagamento. Riprova." };
  }
}

/** Open the Stripe Customer Portal to manage the subscription. */
export async function createBillingPortalSession(): Promise<{ url: string } | { error: string }> {
  if (!isStripeConfigured()) return { error: "Pagamenti non configurati." };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato." };
  const { data: r } = await supabase
    .from("restaurants").select("stripe_customer_id").eq("owner_id", user.id).maybeSingle();
  if (!r?.stripe_customer_id) return { error: "Nessun abbonamento da gestire." };
  try {
    const origin = await appOrigin();
    const url = await createBillingPortal(r.stripe_customer_id as string, `${origin}/dashboard`);
    return { url };
  } catch {
    return { error: "Portale non disponibile. Riprova." };
  }
}

/** Restaurateur sets their own Telegram chat ids (autonomous). */
export async function updateTelegram(chatOrdini: string, chatPagamenti: string) {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({
      telegram_chat_ordini: String(chatOrdini ?? "").trim() || null,
      telegram_chat_pagamenti: String(chatPagamenti ?? "").trim() || null,
    })
    .eq("id", restaurantId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/funzionalita");
}

/** Sends a test notification to the Orders bot. Returns whether it stubbed
 *  (token or chat missing) so the UI can explain. */
export async function testTelegram(): Promise<{ stub: boolean }> {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurants")
    .select("nome, telegram_chat_ordini, telegram_topic_ordini")
    .eq("id", restaurantId)
    .single();
  if (!data) throw new Error("Locale non trovato.");
  await notifyTest(data as Parameters<typeof notifyTest>[0]);
  return { stub: !data.telegram_chat_ordini || !process.env.TELEGRAM_BOT_ORDINI_TOKEN };
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

/** Confirm / decline / cancel a reservation. RLS scopes it to the owner's rows. */
export async function setReservationStatus(id: string, stato: PrenotazioneStato) {
  const allowed: PrenotazioneStato[] = ["in_attesa", "confermata", "rifiutata", "annullata"];
  if (!allowed.includes(stato)) throw new Error("Stato non valido.");
  const restaurantId = await ownerRestaurantId();
  const supabase = await createSupabaseServerClient();
  // Explicit restaurant scope (defence in depth alongside RLS) + a row-affected
  // check so a bad/cross-tenant id fails loudly instead of silently no-op'ing.
  const { data, error } = await supabase
    .from("prenotazioni")
    .update({ stato })
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Prenotazione non trovata.");
  revalidatePath("/dashboard/prenotazioni");
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

/** The four kitchen lifecycle stages, derived from the prep/ready/served stamps. */
export type KitchenStage = "da_preparare" | "in_preparazione" | "pronti" | "serviti";

/**
 * Kitchen: move an order to a lifecycle stage (button taps + drag&drop both use
 * this). Stamps are set forward and cleared going back; existing prep/ready
 * stamps are preserved so the timer/metrics anchors stay meaningful. RLS scopes
 * the update to the caller's own orders.
 */
const KITCHEN_STAGES: KitchenStage[] = ["da_preparare", "in_preparazione", "pronti", "serviti"];
const PRIORITA_VALUES = ["alta", "media", "bassa"] as const;

export async function setOrderStage(orderId: string, stage: KitchenStage) {
  // Server actions are public endpoints: never trust the (type-erased) argument.
  if (!KITCHEN_STAGES.includes(stage)) throw new Error("Stato cucina non valido.");
  const supabase = await createSupabaseServerClient();
  // p_line null ⇒ apply the stage to every line of the order (the "move all"
  // shortcut used by the kanban drag and the order-wide footer buttons).
  const { error } = await supabase.rpc("set_kds_stage", {
    p_order_id: orderId,
    p_line: null,
    p_stage: stage,
  });
  if (error) throw new Error(error.message);
}

/**
 * Kitchen: advance a SINGLE dish (line) of an order. The DB function recomputes
 * the order-level rollup atomically, so two stations advancing different dishes
 * of the same order never clobber each other (row lock). RLS-scoped.
 */
export async function setItemStage(orderId: string, lineIndex: number, stage: KitchenStage) {
  if (!KITCHEN_STAGES.includes(stage)) throw new Error("Stato cucina non valido.");
  if (!Number.isInteger(lineIndex) || lineIndex < 0) throw new Error("Riga non valida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_kds_stage", {
    p_order_id: orderId,
    p_line: lineIndex,
    p_stage: stage,
  });
  if (error) throw new Error(error.message);
}

/**
 * Course coordination ("servi a seguire"): hold a dish so the kitchen doesn't
 * start it, or release it ("Manda ora"). Sets the `a_seguire` flag on the line
 * atomically. RLS-scoped via the DB function.
 */
export async function setItemHold(orderId: string, lineIndex: number, held: boolean) {
  if (!Number.isInteger(lineIndex) || lineIndex < 0) throw new Error("Riga non valida.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_item_hold", {
    p_order_id: orderId,
    p_line: lineIndex,
    p_held: held,
  });
  if (error) throw new Error(error.message);
}

/** Kitchen: set (or clear) an order's priority flag. RLS-scoped. The value is
 *  validated against the allow-list — an out-of-contract string is coerced to
 *  null rather than persisted (it would otherwise crash the board render). */
export async function setOrderPriorita(orderId: string, priorita: "alta" | "media" | "bassa" | null) {
  const value = PRIORITA_VALUES.includes(priorita as (typeof PRIORITA_VALUES)[number]) ? priorita : null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ priorita: value })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/** Cancel an order (or restore it). Cancelled orders leave the kitchen feed and
 *  the day's sales/incasso but stay in the order history. RLS-scoped. */
export async function annullaOrdine(orderId: string, annulla = true) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ annullato_at: annulla ? new Date().toISOString() : null })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ordini");
}

/**
 * Atomically claim the auto-print of an order's comanda. The first surface to
 * call this (KDS, Ordini, or any extra tab/device) wins the conditional update
 * and gets `true`; every later caller sees the stamp already set and gets
 * `false`, so the comanda auto-prints exactly once even when several surfaces
 * are open at the same printer. RLS scopes the update to the owner's restaurant.
 * Returns `false` (never throws) on any error so a transient failure can't wedge
 * the caller's print loop.
 */
export async function claimComandaStampa(orderId: string): Promise<boolean> {
  if (typeof orderId !== "string" || !orderId) return false;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ comanda_stampata_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("comanda_stampata_at", null)
    .select("id");
  if (error) return false;
  return (data?.length ?? 0) === 1;
}

/**
 * Settle a table's bill ("Estingui conto"): stamp `conto_chiuso_at` on the
 * given orders so they leave the open-conti board. This is a management action,
 * NOT a cancellation — `stato`/`annullato_at` are untouched, so the orders stay
 * counted in incasso/statistiche; and NOT a kitchen action — `servito_at` is
 * left alone (an order can be paid for while still cooking).
 *
 * The caller passes the explicit ids the conto card displayed; the guards
 * re-assert "still an open dine-in sale" so a stale id (already settled,
 * cancelled, or now an asporto/delivery) is silently skipped, and a brand-new
 * order that arrived after the card rendered (and isn't in `ids`) is never
 * closed by surprise. RLS scopes the update to the owner's restaurant.
 */
export async function estinguiConto(orderIds: string[]) {
  const ids = (orderIds ?? []).filter((id) => typeof id === "string").slice(0, MAX_CONTO_ORDERS);
  if (!ids.length) return;
  // Server actions are independently invocable, so assert auth + entitlement here
  // too (the page guard alone wouldn't stop a direct call) — mirrors createManualOrder.
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { data: rRow } = await admin.from("restaurants").select("*").eq("id", restaurantId).maybeSingle();
  const restaurant = rRow as Restaurant | null;
  if (!restaurant || !isFeatureOn(restaurant, "conti")) throw new Error("Funzione non disponibile.");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ conto_chiuso_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId) // defense-in-depth alongside the RLS update policy
    .in("id", ids)
    .is("conto_chiuso_at", null)
    .is("annullato_at", null)
    .eq("asporto", false)
    .not("tavolo", "is", null)
    .in("stato", ["ricevuto", "pagato"]);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/conti");
}

/** Mark a service request (call-waiter / ask-bill) as handled. RLS-scoped. */
export async function markServiceRequestHandled(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("service_requests")
    .update({ gestita_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ordini");
}

/**
 * Create an order manually from the dashboard (a waiter taking the order). The
 * total is recomputed server-side from DB prices (never trusted) exactly like
 * the public endpoint; the order is created as `ricevuto` (paid at the counter,
 * no online payment) and the Orders bot is notified.
 */
export async function createManualOrder(input: {
  tavolo?: string;
  tipo?: string;
  sala?: string;
  indirizzo?: string;
  coperti?: number;
  note?: string;
  items?: { item_id: string; qta: number; a_seguire?: boolean; opzioni?: { gruppo: string; scelta: string }[] }[];
}): Promise<{ orderId: string }> {
  const restaurantId = await ownerRestaurantId();
  const admin = createAdminClient();
  const { data: rRow } = await admin.from("restaurants").select("*").eq("id", restaurantId).maybeSingle();
  const restaurant = rRow as Restaurant | null;
  if (!restaurant) throw new Error("Ristorante non trovato.");

  // Asporto/delivery are only valid when their feature is on (mirror /api/ordine);
  // otherwise it falls back to a table order so the coperto rules still apply.
  const asportoOn = isFeatureOn(restaurant, "asporto");
  const deliveryOn = isFeatureOn(restaurant, "delivery");
  const tipo =
    deliveryOn && input.tipo === "delivery"
      ? "delivery"
      : asportoOn && input.tipo === "asporto"
        ? "asporto"
        : "tavolo";
  const asporto = tipo !== "tavolo";
  const tavolo = String(input.tavolo ?? "").trim().slice(0, 40);
  if (!tavolo) throw new Error(asporto ? "Inserisci il nome." : "Inserisci il tavolo.");

  const componibiliOn = isFeatureOn(restaurant, "componibili");
  const scorteOn = isFeatureOn(restaurant, "scorte");
  const ingredientiOn = isFeatureOn(restaurant, "ingredienti");
  const { lines, itemsTotaleCents } = await priceCartServerSide(
    admin,
    restaurant.id,
    input.items ?? [],
    restaurant.aggiunte ?? [],
    { enforceScorte: scorteOn },
    componibiliOn ? (restaurant.composizione ?? []) : [],
    componibiliOn ? (restaurant.composizione_taglie ?? []) : [],
    componibiliOn,
  );
  if (!lines.length) throw new Error("Aggiungi almeno un prodotto.");

  // Course coordination ("a seguire"): tag the held lines so the kitchen holds
  // them until the waiter releases them with "Manda ora" (feature-gated).
  const portateOn = isFeatureOn(restaurant, "gestione_portate");
  const heldIds = new Set(
    portateOn ? (input.items ?? []).filter((it) => it.a_seguire).map((it) => it.item_id) : [],
  );
  const finalLines = heldIds.size
    ? lines.map((l) => (heldIds.has(l.item_id) ? { ...l, a_seguire: true } : l))
    : lines;

  // Coperto applies to table orders per the restaurant's configured mode. Like
  // the public flow, a per-person cover charge requires a valid covers count.
  let coperti: number | null = null;
  if (!asporto && restaurant.coperto_modalita === "persona") {
    const c = Number(input.coperti);
    if (!Number.isInteger(c) || c < 1 || c > 50) throw new Error("Indica il numero di coperti.");
    coperti = c;
  }
  const copertoCents = asporto
    ? 0
    : computeCopertoCents(restaurant.coperto_modalita, restaurant.coperto, coperti ?? 0, itemsTotaleCents);
  const totaleCents = itemsTotaleCents + copertoCents;

  const { data: orderRow, error } = await admin
    .from("orders")
    .insert({
      restaurant_id: restaurant.id,
      tavolo,
      asporto,
      tipo,
      sala: String(input.sala ?? "").trim().slice(0, 60) || null,
      indirizzo: tipo === "delivery" ? String(input.indirizzo ?? "").trim().slice(0, 200) || null : null,
      items: finalLines,
      totale: totaleCents / 100,
      coperti,
      coperto_tot: copertoCents / 100,
      note: String(input.note ?? "").trim().slice(0, 280) || null,
      stato: "ricevuto",
      visto_at: new Date().toISOString(), // created by staff → already "seen"
    })
    .select("*")
    .single();
  const order = orderRow as Order | null;
  if (error || !order) throw new Error(error?.message ?? "Errore nella creazione dell'ordine.");

  // Decrement stock just like the public Case-A order so manual orders don't
  // oversell (per-product scorte + ingredient stock for composable/simple items).
  if (scorteOn) await decrementMenuItemStock(admin, lines);
  if (componibiliOn || ingredientiOn) {
    await decrementIngredientStock(
      admin,
      lines,
      { composizione: componibiliOn, ingredienti: ingredientiOn },
      composableCategories(restaurant.composizione, componibiliOn),
    );
  }

  await notifyNewOrder(restaurant, order);
  revalidatePath("/dashboard/ordini");
  revalidatePath("/[domain]", "page");
  return { orderId: order.id };
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
