"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/config/plans";
import { hitRateLimit } from "@/lib/ratelimit";

const RESERVED = new Set([
  "admin",
  "api",
  "dashboard",
  "onboarding",
  "www",
  "app",
  "static",
  "_next",
  "login",
]);

export interface RegistraInput {
  nome: string;
  slug: string;
  email: string;
  password: string;
  piano: PlanId;
  multilingua: boolean;
}

export type RegistraResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

// A small starter menu so a new restaurant isn't a blank page.
const STARTER_MENU = [
  { categoria: "Antipasti", nome: "Bruschette al pomodoro", descrizione: "Pane, pomodoro fresco, basilico", prezzo: 5.5, ordine: 1 },
  { categoria: "Antipasti", nome: "Tagliere misto", descrizione: "Salumi e formaggi del territorio", prezzo: 12, ordine: 2 },
  { categoria: "Primi", nome: "Spaghetti al pomodoro", descrizione: "", prezzo: 8, ordine: 1 },
  { categoria: "Secondi", nome: "Scaloppine al limone", descrizione: "", prezzo: 12, ordine: 1 },
  { categoria: "Bevande", nome: "Acqua naturale 0,5L", descrizione: "", prezzo: 1.5, ordine: 1 },
  { categoria: "Bevande", nome: "Coca-Cola", descrizione: "", prezzo: 3, ordine: 2 },
  { categoria: "Dolci", nome: "Tiramisù della casa", descrizione: "", prezzo: 5, ordine: 1 },
];

/**
 * Self-service signup (SIMULATED activation — no Stripe yet). Creates the auth
 * user, the restaurant (attivo=true) linked to it, and a starter menu. When
 * Stripe Billing is wired later, activation moves to the payment webhook.
 */
export async function registraLocale(input: RegistraInput): Promise<RegistraResult> {
  const ip = (await headers()).get("x-forwarded-for") ?? "anon";
  if (!hitRateLimit(`signup:${ip}`, 3, 600_000)) {
    return { ok: false, error: "Troppi tentativi: riprova tra qualche minuto." };
  }
  const nome = String(input?.nome ?? "").trim().slice(0, 80);
  const slug = String(input?.slug ?? "").trim().toLowerCase();
  const email = String(input?.email ?? "").trim().toLowerCase();
  const password = String(input?.password ?? "");
  const piano = input?.piano;
  const multilingua = Boolean(input?.multilingua);

  if (!nome) return { ok: false, error: "Inserisci il nome del locale." };
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug))
    return { ok: false, error: "Indirizzo non valido: usa lettere minuscole, numeri e trattini (2–40 caratteri)." };
  if (RESERVED.has(slug))
    return { ok: false, error: "Questo indirizzo è riservato, scegline un altro." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "Email non valida." };
  if (password.length < 8)
    return { ok: false, error: "La password deve avere almeno 8 caratteri." };
  if (!PLANS[piano]) return { ok: false, error: "Piano non valido." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Servizio momentaneamente non disponibile, riprova più tardi." };
  }

  const { data: existing } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { ok: false, error: "Questo indirizzo è già in uso, scegline un altro." };

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created?.user) {
    if (/registered|exists|already/i.test(userErr?.message ?? ""))
      return { ok: false, error: "Questa email è già registrata: accedi dalla dashboard." };
    return { ok: false, error: "Impossibile creare l'account. Riprova." };
  }

  const { data: rest, error: restErr } = await admin
    .from("restaurants")
    .insert({
      slug,
      nome,
      piano,
      multilingua,
      lingue: multilingua ? ["it", "en"] : ["it"],
      pagamenti_attivi: false,
      attivo: true,
      owner_id: created.user.id,
    })
    .select("id")
    .single();
  if (restErr || !rest) {
    return { ok: false, error: "Impossibile creare il locale. Riprova." };
  }

  await admin.from("menu_items").insert(
    STARTER_MENU.map((m) => ({
      restaurant_id: rest.id,
      categoria: m.categoria,
      nome: m.nome,
      descrizione: m.descrizione || null,
      prezzo: m.prezzo,
      disponibile: true,
      ordine: m.ordine,
    })),
  );

  // Log the new owner in so "Vai alla dashboard" lands them straight inside,
  // already authenticated. Non-fatal: if it fails they log in with their creds.
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signInWithPassword({ email, password });
  } catch {
    /* ignore — credentials still work on the login page */
  }

  return { ok: true, slug };
}
