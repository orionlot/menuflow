import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import OrderTracker, { type TrackedOrder } from "./OrderTracker";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ domain: string; id: string }> };

function faseOf(o: {
  stato: string;
  preparazione_at: string | null;
  pronto_at: string | null;
  servito_at: string | null;
}): TrackedOrder["fase"] {
  if (o.stato === "in_attesa_pagamento") return "attesa_pagamento";
  if (o.stato === "fallito") return "fallito";
  if (o.servito_at) return "servito";
  if (o.pronto_at) return "pronto";
  if (o.preparazione_at) return "in_preparazione";
  return "ricevuto";
}

function itemFaseOf(it: {
  preparazione_at?: string | null;
  pronto_at?: string | null;
  servito_at?: string | null;
  a_seguire?: boolean;
}): TrackedOrder["items"][number]["fase"] {
  if (it.servito_at) return "servito";
  if (it.pronto_at) return "pronto";
  if (it.preparazione_at) return "in_preparazione";
  if (it.a_seguire) return "a_seguire";
  return "in_attesa";
}

export default async function OrdineTrackingPage({ params }: Params) {
  const { domain, id } = await params;
  const tenant = await resolveTenant(domain);
  if (!tenant) notFound();
  if (tenant.funzioni_attive?.tracking_ordine === false) notFound(); // feature off
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  // Scope the lookup to this tenant so a foreign order id can't be tracked here.
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      "id, stato, preparazione_at, pronto_at, servito_at, created_at, tempo_stimato, asporto, tavolo, totale, items",
    )
    .eq("id", id)
    .eq("restaurant_id", tenant.id)
    .maybeSingle();

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-800">{tenant.nome}</h1>
        <p className="mt-3 text-neutral-600">Ordine non trovato.</p>
        <Link href="/" className="mt-5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Torna al menu
        </Link>
      </main>
    );
  }

  const o = data as {
    id: string;
    stato: string;
    preparazione_at: string | null;
    pronto_at: string | null;
    servito_at: string | null;
    created_at: string;
    tempo_stimato: number | null;
    asporto: boolean;
    tavolo: string | null;
    totale: number;
    items: { nome: string; qta: number; preparazione_at?: string | null; pronto_at?: string | null; servito_at?: string | null; a_seguire?: boolean }[];
  };

  const initial: TrackedOrder = {
    id: o.id,
    fase: faseOf(o),
    stato: o.stato,
    preparazione_at: o.preparazione_at,
    pronto_at: o.pronto_at,
    servito_at: o.servito_at,
    created_at: o.created_at,
    tempo_stimato: o.tempo_stimato,
    asporto: o.asporto,
    tavolo: o.tavolo,
    totale: Number(o.totale),
    items: Array.isArray(o.items)
      ? o.items.map((it) => ({ nome: it.nome, qta: it.qta, fase: itemFaseOf(it) }))
      : [],
  };

  return (
    <OrderTracker
      initial={initial}
      nome={tenant.nome}
      colorePrimario={tenant.colore_primario}
      coloreSecondario={tenant.colore_secondario}
      tema={tenant.tema}
      reviewUrl={tenant.funzioni_attive?.recensioni ? tenant.google_review_url : null}
      countdownOn={tenant.funzioni_attive?.tracking_countdown ?? false}
      perDishOn={tenant.funzioni_attive?.tracking_piatti ?? true}
    />
  );
}
