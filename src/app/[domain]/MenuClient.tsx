"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import type {
  ComposizioneGruppo,
  ItemOption,
  MenuItem,
  OrderComposizione,
  PublicIngredient,
  PublicRestaurant,
  TagliaComposizione,
} from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import { brandPalette, type Palette } from "@/lib/brand";
import { resolveLayout, FONT_VARS } from "@/lib/config/layout";
import { isServiceOpen, orariLabel, activeChiusura } from "@/lib/orari";
import { effectiveOptions, effectiveNota } from "@/lib/menu";
import { dishNutrition as computeDishNutrition, composedNutrition, kcalDaGrammi } from "@/lib/nutrition";
import { isMapsUrl } from "@/lib/urls";
import HelpButton from "./HelpButton";
import { ALLERGENI, ALLERGENI_BY_ID } from "@/lib/config/allergeni";
import { addLoad, capienzaFor, effectivePrep, waitMinutes, type RepartoLoad } from "@/lib/attesa";

const MAINTENANCE_MSG =
  "App momentaneamente in manutenzione — Si prega di rivolgersi allo staff per l'ordinazione";

const ALL_CAT = "__all__";

// Customer-facing order phase → chip label + colours (for "Segui il tuo ordine").
const FASE_META: Record<string, { label: string; bg: string; fg: string }> = {
  attesa_pagamento: { label: "Attesa pagamento", bg: "#fef3c7", fg: "#92400e" },
  ricevuto: { label: "Ricevuto", bg: "#e5e7eb", fg: "#374151" },
  in_preparazione: { label: "In preparazione", bg: "#e0f2fe", fg: "#075985" },
  pronto: { label: "Pronto 🔔", bg: "#dcfce7", fg: "#166534" },
  servito: { label: "Servito", bg: "#e5e7eb", fg: "#6b7280" },
  fallito: { label: "Pagamento fallito", bg: "#fee2e2", fg: "#991b1b" },
};
function FaseChip({ fase }: { fase?: string }) {
  const m = fase ? FASE_META[fase] : undefined;
  if (!m) return null;
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: m.bg, color: m.fg }}
    >
      {m.label}
    </span>
  );
}

/** A monochrome line icon (currentColor) for a category section header. */
function catIcon(name: string) {
  const n = name.toLowerCase();
  const svg = (children: React.ReactNode) => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
  if (/aperitiv|cocktail|spritz|drink|bar/.test(n))
    return svg(
      <>
        <path d="M5 4h14" />
        <path d="M5 4l7 8 7-8" />
        <path d="M12 12v6" />
        <path d="M8 21h8" />
      </>,
    );
  if (/vin|wine|cantina/.test(n))
    return svg(
      <>
        <path d="M8 21h8" />
        <path d="M12 15v6" />
        <path d="M7 3h10l-1 6a4 4 0 0 1-8 0z" />
      </>,
    );
  if (/birr|beer/.test(n))
    return svg(
      <>
        <path d="M5 8h11v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
        <path d="M16 10h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
        <path d="M8 8V6a2 2 0 0 1 4 0v2" />
      </>,
    );
  if (/caff|coffe|colazion|breakfast/.test(n))
    return svg(
      <>
        <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
        <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
        <path d="M8 3v2" />
        <path d="M12 3v2" />
      </>,
    );
  if (/panin|sandwich|burger|toast|hamburg|wrap/.test(n))
    return svg(
      <>
        <path d="M3 11a9 9 0 0 1 18 0" />
        <path d="M3 11h18" />
        <path d="M4 15h16" />
        <path d="M4 15a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3" />
      </>,
    );
  if (/pizz/.test(n))
    return svg(
      <>
        <path d="M3 8l9 13 9-13a32 32 0 0 0-18 0z" />
        <circle cx="10" cy="11" r="1" />
        <circle cx="13" cy="14" r="1" />
      </>,
    );
  if (/prim|past|risott|zupp|gnocch|lasagn/.test(n))
    return svg(
      <>
        <path d="M3 12h18a9 9 0 0 1-18 0z" />
        <path d="M8 8c0-1.5 1-1.5 1-3" />
        <path d="M12 7c0-1.5 1-1.5 1-3" />
      </>,
    );
  if (/dolc|dessert|tort|gelat|tiramis/.test(n))
    return svg(
      <>
        <path d="M7 10a5 5 0 0 1 10 0" />
        <path d="M7 10l5 11 5-11z" />
      </>,
    );
  if (/antipast|starter|stuzzic|finger|contorn|verdur|insalat/.test(n))
    return svg(
      <>
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
      </>,
    );
  if (/bevand|bibit|soft|succh|acqua/.test(n))
    return svg(
      <>
        <path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
        <path d="M10 8l1-5h5" />
      </>,
    );
  // Fallback: fork & knife (utensils)
  return svg(
    <>
      <path d="M5 3v6a2 2 0 0 0 4 0V3" />
      <path d="M7 9v12" />
      <path d="M17 3c-1.7 0-3 2.2-3 5s1.3 4 3 4" />
      <path d="M17 3v18" />
    </>,
  );
}

type Backend = "checking" | "ok" | "down";
type Chosen = { gruppo: string; scelta: string; prezzo: number };
interface CartLine {
  key: string;
  item_id: string;
  nome: string;
  qta: number;
  unitCents: number;
  opzioni: Chosen[];
  composizione: OrderComposizione[];
  taglia?: { id: string; nome: string; prezzo?: number };
  nota?: string;
}

function lineKey(
  itemId: string,
  chosen: Chosen[],
  compo: OrderComposizione[] = [],
  tagliaId?: string,
  nota?: string,
): string {
  const parts: string[] = [];
  if (tagliaId) parts.push(`t:${tagliaId}`);
  if (chosen.length)
    parts.push(chosen.map((c) => `${c.gruppo}:${c.scelta}`).sort().join(","));
  if (compo.length)
    parts.push(compo.map((c) => `${c.ingredient_id}x${c.qta}`).sort().join(","));
  if (nota?.trim()) parts.push(`n:${nota.trim()}`);
  return parts.length ? `${itemId}|${parts.join("|")}` : itemId;
}

export default function MenuClient({
  tenant,
  items,
  popolari = [],
  ingredienti = [],
}: {
  tenant: PublicRestaurant;
  items: MenuItem[];
  popolari?: string[];
  ingredienti?: PublicIngredient[];
}) {
  const layout = resolveLayout(tenant.layout);
  const p = brandPalette(tenant.colore_primario, tenant.tema, tenant.colore_secondario);
  const dark = tenant.tema === "dark";
  const radius = layout.bordi === "squadrati" ? 6 : 18;
  const compact = layout.densita === "compatta";
  const photoTop = layout.foto_pos === "sopra";
  const minimalHeader = layout.intestazione === "minimal";
  const headBg = minimalHeader ? p.pageBg : p.headerBg;
  const headText = minimalHeader ? p.text : p.headerText;
  const headSub = minimalHeader ? p.textMuted : p.headerSub;
  const scorteOn = Boolean(tenant.funzioni_attive?.scorte);
  const allergyOn = Boolean(tenant.funzioni_attive?.profilo_allergie);
  const componibiliOn = Boolean(tenant.funzioni_attive?.componibili);
  const descrizioneOn = tenant.funzioni_attive?.descrizione !== false; // default on
  const ingredientiItemsOn = Boolean(tenant.funzioni_attive?.ingredienti);
  const pesoOn = Boolean(tenant.funzioni_attive?.peso);
  const kcalOn = Boolean(tenant.funzioni_attive?.kcal);
  const allergeniOrdineOn = Boolean(tenant.funzioni_attive?.allergeni_ordine);
  const salaOrdineOn = Boolean(tenant.funzioni_attive?.sala_ordine);
  const attesaOn =
    Boolean(tenant.funzioni_attive?.attesa_stimata) && Boolean(tenant.funzioni_attive?.tempo_stimato);
  const saleList = tenant.sale ?? [];
  const asportoOn = Boolean(tenant.funzioni_attive?.asporto);
  const etichetteOn = Boolean(tenant.funzioni_attive?.etichette);
  const vetrinaOn = Boolean(tenant.funzioni_attive?.vetrina);
  const fasceOrarieOn = Boolean(tenant.funzioni_attive?.fasce_orarie);
  const prezzoAsportoOn = Boolean(tenant.funzioni_attive?.prezzo_asporto);
  const deliveryOn = Boolean(tenant.funzioni_attive?.delivery);
  const trackingOn = tenant.funzioni_attive?.tracking_ordine !== false; // default on
  const servizioOn = tenant.funzioni_attive?.richiesta_servizio !== false; // default on
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ingredientiById = useMemo(
    () => new Map(ingredienti.map((i) => [i.id, i])),
    [ingredienti],
  );
  // A product carrying ANY per-item config is self-contained: it uses ONLY its
  // own groups + sizes (never inherits the category-level ones). Mirrors the
  // server's pricing resolution.
  const isPerItemComposable = (item: MenuItem): boolean =>
    componibiliOn &&
    ((item.composizione?.length ?? 0) > 0 || (item.composizione_taglie?.length ?? 0) > 0);
  const composizioneFor = (item: MenuItem): ComposizioneGruppo[] =>
    !componibiliOn
      ? []
      : isPerItemComposable(item)
        ? item.composizione ?? []
        : (tenant.composizione ?? []).filter((g) => g.categorie.includes(item.categoria));
  const taglieFor = (item: MenuItem): TagliaComposizione[] =>
    !componibiliOn
      ? []
      : isPerItemComposable(item)
        ? item.composizione_taglie ?? []
        : (tenant.composizione_taglie ?? []).filter((tg) => tg.categorie.includes(item.categoria));

  const [lang, setLang] = useState<string>(tenant.lingue?.[0] ?? "it");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [tavolo, setTavolo] = useState("");
  const [sala, setSala] = useState("");
  const [allergeniSel, setAllergeniSel] = useState<string[]>([]);
  const [queueLoads, setQueueLoads] = useState<Record<string, RepartoLoad>>({});
  const [asporto, setAsporto] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [indirizzo, setIndirizzo] = useState("");
  const [posizione, setPosizione] = useState("");
  const [posState, setPosState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [pagaInCassa, setPagaInCassa] = useState(false);
  const [note, setNote] = useState("");
  const [coperti, setCoperti] = useState(0);
  const [manciaCents, setManciaCents] = useState(0);
  const [backend, setBackend] = useState<Backend>("checking");
  const [sheet, setSheet] = useState(false);
  const [optItem, setOptItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { mode: string; orderId?: string }>(null);
  const [pending, setPending] = useState<null | { orderId: string; sim: boolean }>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [allergyOpen, setAllergyOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [annuncioDismissed, setAnnuncioDismissed] = useState(false);
  const [myOrders, setMyOrders] = useState<{ id: string; at: number }[]>([]);
  const [orderFasi, setOrderFasi] = useState<Record<string, string>>({});
  const [myAllergens, setMyAllergens] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [voted, setVoted] = useState<number | null>(null);

  // Prefill the table number: QR (?tavolo=) wins; otherwise reuse the number
  // remembered from the previous order (mf_tavolo cookie, same tenant, ≤4h) so a
  // second order from the same table doesn't have to re-enter it.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tavolo");
    if (t) {
      setTavolo(t);
      return;
    }
    try {
      const m = document.cookie.split("; ").find((c) => c.startsWith("mf_tavolo="));
      if (!m) return;
      const data = JSON.parse(decodeURIComponent(m.slice("mf_tavolo=".length)));
      if (
        data &&
        data.slug === tenant.slug &&
        typeof data.tavolo === "string" &&
        typeof data.at === "number" &&
        Date.now() - data.at < 4 * 60 * 60 * 1000
      ) {
        setTavolo(data.tavolo);
      }
    } catch {
      /* ignore malformed cookie */
    }
  }, [tenant.slug]);

  // Poll the live kitchen-queue wait estimate (only when the feature is on).
  useEffect(() => {
    if (!attesaOn) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/attesa?slug=${encodeURIComponent(tenant.slug)}`, { cache: "no-store" });
        const d = await r.json();
        if (alive && d.ok) setQueueLoads((d.loads as Record<string, RepartoLoad>) ?? {});
      } catch {
        /* keep last value */
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [attesaOn, tenant.slug]);

  useEffect(() => {
    let alive = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => alive && setBackend(r.ok ? "ok" : "down"))
      .catch(() => alive && setBackend("down"));
    return () => {
      alive = false;
    };
  }, []);

  // Poll the order status while a confirmation overlay is open.
  const trackedId = done?.orderId ?? null;
  useEffect(() => {
    if (!trackedId) return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/ordine/${trackedId}`, { cache: "no-store" });
        const d = await r.json();
        if (!alive || !d.ok) return;
        if (d.servito_at) setStatus("Servito");
        else if (d.pronto_at) setStatus("Pronto");
        else if (d.stato === "in_attesa_pagamento") setStatus("In attesa di pagamento");
        else if (d.stato === "fallito") setStatus("Pagamento fallito");
        else setStatus("In preparazione");
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [trackedId]);

  // Read the `mf_ordini` cookie (set when an order is placed) to surface a
  // "Segui il tuo ordine" link for this tenant's recent orders. Cookies only —
  // no localStorage/sessionStorage (project rule). Re-reads after each order.
  useEffect(() => {
    try {
      const m = document.cookie.split("; ").find((c) => c.startsWith("mf_ordini="));
      if (!m) {
        setMyOrders([]);
        return;
      }
      const parsed = JSON.parse(decodeURIComponent(m.slice("mf_ordini=".length)));
      if (!Array.isArray(parsed)) {
        setMyOrders([]);
        return;
      }
      const now = Date.now();
      const isUuid = (s: unknown) =>
        typeof s === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      setMyOrders(
        parsed
          .filter(
            (e) =>
              e &&
              e.slug === tenant.slug &&
              isUuid(e.id) &&
              typeof e.at === "number" &&
              now - e.at < 7_200_000,
          )
          .sort((a, b) => b.at - a.at)
          .map((e) => ({ id: e.id, at: e.at })),
      );
    } catch {
      setMyOrders([]);
    }
  }, [tenant.slug, done?.orderId, pending?.orderId]);

  // Poll the live phase of each tracked order so the banner shows a status chip
  // per row. Bounded (≤10 orders, capped polls); stops once all are terminal.
  const myOrderIds = myOrders.map((o) => o.id).join(",");
  useEffect(() => {
    if (!trackingOn || !myOrderIds) return;
    const ids = myOrderIds.split(",");
    let alive = true;
    let polls = 0;
    const tick = async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const r = await fetch(`/api/ordine/${id}`, { cache: "no-store" });
            const d = await r.json();
            return d?.ok ? ([id, String(d.fase)] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setOrderFasi(map);
      const allDone = ids.every((id) => map[id] === "servito" || map[id] === "fallito");
      if (allDone || ++polls > 40) clearInterval(timer);
    };
    const timer = setInterval(tick, 10000);
    tick();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [trackingOn, myOrderIds]);

  const t = (it: string, i18n: Record<string, string> | undefined) =>
    lang !== "it" && i18n?.[lang] ? i18n[lang] : it;
  // Resolve an ingredient's name in the active language (falls back to base).
  const ingName = (ing: PublicIngredient) => t(ing.nome, ing.nome_i18n);
  // Per-dish weight (g) / calories (kcal): the manual override on the item if set
  // (exact), otherwise computed from the recipe grams × ingredient density (an
  // estimate). See src/lib/nutrition.ts.
  const dishNutrition = (item: MenuItem) =>
    computeDishNutrition(item.ingredienti, (id) => ingredientiById.get(id), item.peso, item.kcal);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const i of items) if (!seen.includes(i.categoria)) seen.push(i.categoria);
    return seen;
  }, [items]);
  const [activeCat, setActiveCat] = useState<string>(categories[0] ?? "");

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = (i: MenuItem) =>
    t(i.nome, i.nome_i18n).toLowerCase().includes(q) ||
    t(i.descrizione ?? "", i.descrizione_i18n).toLowerCase().includes(q);
  const shown = searching ? items.filter(matches) : [];
  const visibleCats = searching
    ? []
    : activeCat === ALL_CAT
      ? categories
      : [activeCat || categories[0]];
  const lines = Object.values(cart).filter((l) => l.qta > 0);
  const count = lines.reduce((s, l) => s + l.qta, 0);
  // Estimated wait (minutes): the current kitchen queue PLUS this cart, folded
  // into the same per-reparto parallel-capacity model the server uses. The
  // kitchen handles `capienza` dishes per station at once, so adding a dish only
  // extends the wait once a station's wave is full (e.g. the 4th pizza when the
  // pizzeria runs 3 ovens).
  const attesaTot = (() => {
    if (!attesaOn) return 0;
    const merged: Record<string, RepartoLoad> = {};
    for (const [k, v] of Object.entries(queueLoads)) merged[k] = { ...v };
    for (const l of lines) {
      const it = itemById.get(l.item_id);
      if (!it) continue;
      const reparto = it.reparto || "";
      addLoad(
        merged,
        reparto,
        l.qta,
        effectivePrep(it.tempo_preparazione, it.categoria, tenant.categoria_tempi),
        capienzaFor(reparto, tenant.reparti, tenant.capienza_default),
      );
    }
    return waitMinutes(merged);
  })();
  // Asporto price: when "Da asporto" is chosen and the item has a takeaway price,
  // the effective unit swaps the base price (keeps display == server charge).
  const asportoActive = asporto && prezzoAsportoOn;
  const effUnit = (l: CartLine) => {
    if (!asportoActive) return l.unitCents;
    const it = itemById.get(l.item_id);
    if (!it || it.prezzo_asporto == null) return l.unitCents;
    return l.unitCents + Math.round((it.prezzo_asporto - it.prezzo) * 100);
  };
  const itemsCents = lines.reduce((s, l) => s + effUnit(l) * l.qta, 0);

  // Cover charge per the restaurant's configured mode.
  const cMode = tenant.coperto_modalita;
  const cLabel = tenant.coperto_label || "Coperto";
  const payAtCounter = asporto && pagaInCassa;
  // Asporto has no cover charge.
  const copertoCents = asporto
    ? 0
    : cMode === "persona"
      ? Math.round(tenant.coperto * 100) * coperti
      : cMode === "ordine"
        ? Math.round(tenant.coperto * 100)
        : cMode === "servizio"
          ? Math.round((itemsCents * tenant.coperto) / 100)
          : 0;
  const copertiMissing = !asporto && cMode === "persona" && coperti < 1;
  // The in-app tip only applies to an online payment (not pay-at-counter).
  const tipEligible = tenant.pagamenti_attivi && tenant.accetta_mancia && !payAtCounter;
  const totalCents = itemsCents + copertoCents + (tipEligible ? manciaCents : 0);

  const qtyForItem = (id: string) =>
    lines.filter((l) => l.item_id === id).reduce((s, l) => s + l.qta, 0);

  // Units of a menu item already in the cart (summed over all its option-variant
  // lines, which share the same stock pool). Optionally excludes one line key.
  const cartUnits = (c: Record<string, CartLine>, itemId: string, exceptKey?: string) => {
    let n = 0;
    for (const k in c) if (c[k].item_id === itemId && k !== exceptKey) n += c[k].qta;
    return n;
  };
  // Max total units a customer may order of an item: its remaining stock when the
  // "scorte" feature is on (capped at 99), otherwise just 99. Mirrors the
  // server-side guard in pricing-core so the UI can't build a cart that submit rejects.
  const stockCapFor = (item?: MenuItem) =>
    item && scorteOn && item.scorta != null ? Math.min(99, item.scorta) : 99;

  function addLine(
    item: MenuItem,
    chosen: Chosen[],
    composizione: OrderComposizione[] = [],
    taglia?: { id: string; nome: string; prezzo?: number },
    nota?: string,
  ) {
    const unitCents =
      Math.round(item.prezzo * 100) +
      Math.round((taglia?.prezzo ?? 0) * 100) +
      chosen.reduce((s, c) => s + Math.round(c.prezzo * 100), 0) +
      composizione.reduce((s, c) => s + Math.round(c.prezzo * 100) * c.qta, 0);
    const cleanNota = nota?.trim() || undefined;
    const key = lineKey(item.id, chosen, composizione, taglia?.id, cleanNota);
    setCart((c) => {
      const existing = c[key];
      // Don't let the item's total units exceed its stock (when tracked).
      if (cartUnits(c, item.id) >= stockCapFor(item)) return c;
      return {
        ...c,
        [key]: existing
          ? { ...existing, qta: existing.qta + 1 }
          : {
              key,
              item_id: item.id,
              nome: t(item.nome, item.nome_i18n),
              qta: 1,
              unitCents,
              opzioni: chosen,
              composizione,
              taglia,
              nota: cleanNota,
            },
      };
    });
  }
  function tapAdd(item: MenuItem) {
    if (
      effectiveOptions(item, tenant.aggiunte).length ||
      composizioneFor(item).length ||
      taglieFor(item).length ||
      effectiveNota(item, tenant.note_config)
    )
      setOptItem(item);
    else addLine(item, []);
  }
  const setQty = (key: string, q: number) =>
    setCart((c) => {
      const line = c[key];
      if (!line) return c;
      // Cap so this line + the item's other lines never exceed its stock.
      const max = Math.max(0, stockCapFor(itemById.get(line.item_id)) - cartUnits(c, line.item_id, key));
      return { ...c, [key]: { ...line, qta: Math.max(0, Math.min(max, q)) } };
    });

  // Capture the device's current position and turn it into a Google Maps link
  // the restaurateur can open. Works best on mobile (GPS); needs user consent.
  function sendPosition() {
    if (!("geolocation" in navigator)) {
      setPosState("error");
      return;
    }
    setPosState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosizione(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
        setPosState("ok");
      },
      () => setPosState("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  async function submit() {
    if (!asporto && !tavolo.trim()) {
      setError("Inserisci il numero del tavolo per procedere.");
      return;
    }
    if (delivery && !indirizzo.trim()) {
      setError("Inserisci l'indirizzo di consegna per procedere.");
      return;
    }
    if (copertiMissing) {
      setError("Indica il numero di coperti per procedere.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const health = await fetch("/api/health", { cache: "no-store" }).catch(() => null);
      if (!health || !health.ok) {
        setBackend("down");
        setSheet(false);
        return;
      }
      const res = await fetch("/api/ordine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: tenant.slug,
          tavolo,
          sala: salaOrdineOn && !asporto && sala ? sala : undefined,
          asporto,
          tipo: delivery ? "delivery" : asporto ? "asporto" : "tavolo",
          indirizzo: delivery ? indirizzo : undefined,
          posizione: delivery && isMapsUrl(posizione) ? posizione : undefined,
          paga_in_cassa: payAtCounter,
          note,
          coperti: !asporto && cMode === "persona" ? coperti : undefined,
          mancia: tipEligible ? manciaCents / 100 : undefined,
          allergeni: allergeniOrdineOn && allergeniSel.length ? allergeniSel : undefined,
          items: lines.map((l) => ({
            item_id: l.item_id,
            qta: l.qta,
            opzioni: l.opzioni.map((o) => ({ gruppo: o.gruppo, scelta: o.scelta })),
            composizione: l.composizione.map((c) => ({
              ingredient_id: c.ingredient_id,
              qta: c.qta,
            })),
            taglia_id: l.taglia?.id,
            nota: l.nota,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data?.maintenance) {
          setBackend("down");
          setSheet(false);
        } else setError(data?.error ?? "Errore durante l'invio dell'ordine.");
        return;
      }
      if (data.mode === "payment") {
        setSheet(false);
        setPending({ orderId: data.orderId, sim: Boolean(data.devSimulateAvailable) });
      } else {
        setSheet(false);
        setStatus("In preparazione");
        setDone({ mode: "placed", orderId: data.orderId });
        setCart({});
        setAllergeniSel([]);
        setSala("");
      }
    } catch {
      setBackend("down");
      setSheet(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function simulate(orderId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dev/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Simulazione non riuscita.");
        return;
      }
      setPending(null);
      setStatus("In preparazione");
      setDone({ mode: "paid", orderId });
      setCart({});
    } finally {
      setSubmitting(false);
    }
  }

  async function sendVoto(n: number) {
    if (!done?.orderId) return;
    setVoted(n);
    try {
      await fetch(`/api/ordine/${done.orderId}/voto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voto: n }),
      });
    } catch {
      /* ignore */
    }
  }

  const initial = tenant.nome.trim().charAt(0).toUpperCase();
  const tavoloMissing = !tavolo.trim();
  const orariOn = Boolean(tenant.funzioni_attive?.orari);
  // Manual override + scheduled closures always apply; weekly hours only when on.
  const chiusura = activeChiusura(tenant.chiusure);
  const forcedClosed = tenant.aperto_override === false;
  const closed = !isServiceOpen(tenant, { orariEnabled: orariOn });
  const ordersBlocked = backend === "down" || closed;
  const annuncioOn =
    Boolean(tenant.annuncio?.attivo && tenant.annuncio?.testo?.trim()) && !annuncioDismissed;
  const tuttoOn = activeCat === ALL_CAT;
  // Meal-band visibility: items flagged solo pranzo/cena show only in that band.
  const mealCena = (() => {
    const h = new Date().getHours();
    return h >= 17 || h < 5;
  })();
  const bandOk = (item: MenuItem) => {
    if (!fasceOrarieOn || (!item.solo_pranzo && !item.solo_cena)) return true;
    if (item.solo_pranzo && item.solo_cena) return true;
    return mealCena ? item.solo_cena : item.solo_pranzo;
  };

  // Featured products for the homepage "vetrina" carousel — available, in stock,
  // and within their current meal band (same visibility rules as a menu row).
  const vetrinaItems = vetrinaOn
    ? items.filter(
        (i) => i.in_vetrina && i.disponibile && !(scorteOn && i.scorta === 0) && bandOk(i),
      )
    : [];

  // The exact menu-card add control for an item — reused by the vetrina slides.
  const renderAddControl = (item: MenuItem) => {
    const sold = !item.disponibile || (scorteOn && item.scorta === 0);
    return (
      <ItemAddControl
        item={item}
        p={p}
        qty={qtyForItem(item.id)}
        hasOpts={effectiveOptions(item, tenant.aggiunte).length > 0}
        tappable={!sold && !ordersBlocked}
        maxQty={stockCapFor(item)}
        onTap={() => tapAdd(item)}
        onAddOne={() => addLine(item, [])}
        onSetQty={(q) => setQty(item.id, q)}
      />
    );
  };

  const renderItem = (item: MenuItem, idx: number) => {
    if (!bandOk(item)) return null;
    const sold = !item.disponibile || (scorteOn && item.scorta === 0);
    const qty = qtyForItem(item.id);
    const hasOpts = effectiveOptions(item, tenant.aggiunte).length > 0;
    const myHits =
      allergyOn && myAllergens.length
        ? (item.allergeni ?? []).filter((a) => myAllergens.includes(a))
        : [];
    const allergyHit = myHits.length > 0;
    const showPhoto =
      !layout.foto_categorie_nascoste.includes(item.categoria) &&
      (!dark || !!item.foto_url);
    const photoRadius = Math.max(radius - 4, 4);
    const desc = t(item.descrizione ?? "", item.descrizione_i18n);
    const ingNames = ingredientiItemsOn
      ? (item.ingredienti ?? [])
          .map((v) => ingredientiById.get(v.id))
          .filter((g): g is PublicIngredient => Boolean(g))
          .map((g) => ingName(g))
          .join(", ")
      : "";
    const nutri = pesoOn || kcalOn ? dishNutrition(item) : null;
    const nutriLabel = nutri
      ? [
          pesoOn && nutri.peso != null ? `${nutri.pesoStima ? "~" : ""}${nutri.peso} g` : null,
          kcalOn && nutri.kcal != null ? `${nutri.kcalStima ? "~" : ""}${nutri.kcal} kcal` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";
    const recommended = Boolean(
      tenant.funzioni_attive?.piatto_consigliato && item.consigliato,
    );
    const popular = popolari.includes(item.id);
    const lowStock =
      scorteOn && item.scorta != null && item.scorta > 0 && item.scorta <= 5;
    const tappable = !sold && !ordersBlocked;

    const addControl = (
      <ItemAddControl
        item={item}
        p={p}
        qty={qty}
        hasOpts={hasOpts}
        tappable={tappable}
        maxQty={stockCapFor(item)}
        onTap={() => tapAdd(item)}
        onAddOne={() => addLine(item, [])}
        onSetQty={(q) => setQty(item.id, q)}
      />
    );

    return (
      <li
        key={item.id}
        className="mf-up overflow-hidden transition"
        style={{
          animationDelay: `${Math.min(idx * 45, 300)}ms`,
          opacity: sold ? 0.5 : 1,
          background: allergyHit
            ? dark
              ? "rgba(220,38,38,0.12)"
              : "#fdf2f1"
            : p.surface,
          border: `1px solid ${
            allergyHit ? (dark ? "rgba(248,113,113,0.35)" : "#f1cfcb") : p.surfaceBorder
          }`,
          borderRadius: radius,
          boxShadow: dark ? "none" : "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div
          onClick={tappable ? () => tapAdd(item) : undefined}
          className="transition active:opacity-90"
          style={{ cursor: tappable ? "pointer" : "default" }}
        >
          {photoTop &&
            showPhoto &&
            (item.foto_url ? (
              <Image
                src={item.foto_url}
                alt={t(item.nome, item.nome_i18n)}
                width={480}
                height={240}
                sizes="(max-width: 768px) 100vw, 480px"
                className="h-44 w-full object-cover"
              />
            ) : (
              <div
                className="flex h-40 w-full items-center justify-center font-display text-4xl"
                style={{ background: p.tint, color: p.brand }}
              >
                {item.nome.charAt(0)}
              </div>
            ))}
          <div className={`flex gap-3.5 ${compact ? "p-3" : "p-3.5"}`}>
            {!photoTop &&
              showPhoto &&
              (item.foto_url ? (
                <Image
                  src={item.foto_url}
                  alt={t(item.nome, item.nome_i18n)}
                  width={140}
                  height={140}
                  sizes="112px"
                  className="shrink-0 self-start object-cover"
                  style={{ width: 112, height: 112, borderRadius: photoRadius }}
                />
              ) : (
                <div
                  className="flex shrink-0 self-start items-center justify-center font-display text-3xl"
                  style={{
                    width: 112,
                    height: 112,
                    background: p.tint,
                    color: p.brand,
                    borderRadius: photoRadius,
                  }}
                >
                  {item.nome.charAt(0)}
                </div>
              ))}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 font-display text-[1.1rem] font-semibold leading-tight">
                  {t(item.nome, item.nome_i18n)}
                </h3>
                {recommended && (
                  <span
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]"
                    style={{ border: `1px solid ${p.accent}`, color: p.accent }}
                    title="Consigliato"
                  >
                    ★
                  </span>
                )}
                {sold && (
                  <span
                    className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: p.surfaceBorder, color: p.textMuted }}
                  >
                    Esaurito
                  </span>
                )}
              </div>

              {(popular || lowStock) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {popular && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: "#fff7ed", color: "#c2410c" }}
                    >
                      🔥 Più ordinato
                    </span>
                  )}
                  {lowStock && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: "#fef3c7", color: "#92400e" }}
                    >
                      Ultime {item.scorta}
                    </span>
                  )}
                </div>
              )}

              {descrizioneOn && desc && (
                <p className="mt-1.5 text-sm leading-snug" style={{ color: p.textMuted }}>
                  {desc}
                </p>
              )}

              {ingNames && (
                <p className="mt-1.5 text-sm leading-snug" style={{ color: p.textMuted }}>
                  {ingNames}
                </p>
              )}

              {nutriLabel && (
                <p className="mt-1.5 inline-flex w-fit max-w-full self-start items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                  style={{ background: p.tint, color: p.text }}>
                  {nutriLabel}
                </p>
              )}

              {etichetteOn && item.etichette?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.etichette.map((e) => (
                    <span
                      key={e}
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: p.tint, color: p.brand }}
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}

              <div className="my-2.5" style={{ borderTop: `1px dashed ${p.surfaceBorder}` }} />

              {item.allergeni?.length > 0 && (
                <div
                  className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[11px]"
                  style={{ color: p.textMuted }}
                >
                  {item.allergeni.map((a) => {
                    const hit = myHits.includes(a);
                    return (
                      <span
                        key={a}
                        className="rounded px-1.5 py-0.5 font-semibold"
                        style={
                          hit
                            ? {
                                border: "1px solid #fca5a5",
                                color: "#b91c1c",
                                background: "#fee2e2",
                              }
                            : { border: `1px solid ${p.accent}`, color: p.accent }
                        }
                      >
                        {ALLERGENI_BY_ID.get(a)?.short ?? a}
                      </span>
                    );
                  })}
                  <span>
                    contiene{" "}
                    {item.allergeni
                      .map((a) => (ALLERGENI_BY_ID.get(a)?.label ?? a).toLowerCase())
                      .join(", ")}
                  </span>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
                <div className="font-display text-lg font-bold" style={{ color: p.price }}>
                  {formatEUR(Math.round(item.prezzo * 100))}
                  {hasOpts && (
                    <span className="ml-1 text-xs font-normal" style={{ color: p.textMuted }}>
                      + opzioni
                    </span>
                  )}
                </div>
                {addControl && (
                  <div onClick={(e) => e.stopPropagation()}>{addControl}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div
      style={
        {
          background: p.pageBg,
          color: p.text,
          minHeight: "100vh",
          "--font-display": FONT_VARS[layout.font].display,
          "--font-body": FONT_VARS[layout.font].body,
        } as CSSProperties
      }
      className="font-sans"
    >
      <div className="mx-auto w-full max-w-[480px] pb-32">
        {/* Header */}
        <header
          className={
            minimalHeader
              ? "px-5 pb-3 pt-4"
              : dark
                ? "px-5 pb-4 pt-5"
                : "rounded-b-[24px] px-5 pb-5 pt-6"
          }
          style={{
            background: headBg,
            color: headText,
            borderBottom:
              minimalHeader || dark ? `1px solid ${p.surfaceBorder}` : undefined,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {tenant.logo_url ? (
                <Image
                  src={tenant.logo_url}
                  alt={tenant.nome}
                  width={48}
                  height={48}
                  sizes="48px"
                  className={`h-11 w-11 shrink-0 object-cover ${dark ? "rounded-xl" : "rounded-full"}`}
                  style={dark ? { border: `2px solid ${p.brand}` } : undefined}
                />
              ) : (
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center font-display text-xl font-bold ${dark ? "rounded-xl" : "rounded-full"}`}
                  style={
                    dark
                      ? { border: `2px solid ${p.brand}`, color: p.brand }
                      : { background: "#fff", color: p.brand }
                  }
                >
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <h1
                  className="truncate font-display font-bold leading-tight"
                  style={{ fontSize: dark ? "1.35rem" : "1.5rem", fontWeight: dark ? 500 : 700 }}
                >
                  {tenant.nome}
                </h1>
                {tenant.sottotitolo && (
                  <p
                    className={dark ? "text-[11px] uppercase tracking-[0.22em]" : "text-sm"}
                    style={{ color: headSub }}
                  >
                    {tenant.sottotitolo}
                  </p>
                )}
              </div>
            </div>
            {tenant.multilingua && tenant.lingue.length > 1 && (
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold outline-none"
                style={{
                  background: dark ? p.chipBg : "rgba(255,255,255,0.2)",
                  color: headText,
                  border: dark ? `1px solid ${p.surfaceBorder}` : "none",
                }}
              >
                {tenant.lingue.map((l) => (
                  <option key={l} value={l} style={{ color: "#111" }}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        {/* Vetrina — brand-coloured showcase carousel of featured products */}
        {vetrinaOn && vetrinaItems.length > 0 && (
          <VetrinaCarousel
            slides={vetrinaItems}
            p={p}
            dark={dark}
            t={t}
            blocked={ordersBlocked}
            radius={radius}
            onPick={tapAdd}
            renderAdd={renderAddControl}
          />
        )}

        {/* Announcement banner (brand-coloured, dismissible in-memory) */}
        {annuncioOn && (
          <div className="px-5 pt-3">
            <div
              className="flex items-start gap-2 rounded-2xl px-4 py-3 text-sm"
              style={{ background: p.tint, border: `1px solid ${p.brand}`, color: p.text }}
            >
              <span aria-hidden style={{ color: p.brand }}>
                📣
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-line font-medium">
                {tenant.annuncio.testo}
              </span>
              <button
                onClick={() => setAnnuncioDismissed(true)}
                aria-label="Chiudi annuncio"
                className="-mt-1 shrink-0 rounded-md px-1 text-lg leading-none"
                style={{ color: p.textMuted }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Estimated time to be served (kitchen queue + this cart), if enabled */}
        {attesaOn && attesaTot > 0 && (
          <div className="px-5 pt-3">
            <div
              className="rounded-2xl px-4 py-2.5 text-sm"
              style={{ background: p.tint, border: `1px solid ${p.surfaceBorder}`, color: p.text }}
            >
              <span className="font-semibold">🕐 Tempo stimato per il servizio ~{attesaTot} min</span>
              <span className="mt-0.5 block text-xs leading-snug" style={{ color: p.textMuted }}>
                Stima indicativa, calcolata sulla coda in cucina e sul tuo ordine. I tempi effettivi
                possono variare in base all&apos;affluenza e ad altri fattori.
              </span>
            </div>
          </div>
        )}

        {/* "Segui il tuo ordine" — recent orders placed from this device (cookie) */}
        {trackingOn && myOrders.length > 0 && (
          <div className="px-5 pt-3">
            {myOrders.length === 1 ? (
              <a
                href={`/ordine/${myOrders[0].id}`}
                className="flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm"
                style={{ background: p.brand, color: p.onBrand }}
              >
                <span aria-hidden>🔔</span>
                <span>Segui il tuo ordine</span>
                <FaseChip fase={orderFasi[myOrders[0].id]} />
                <span className="ml-auto" aria-hidden>
                  →
                </span>
              </a>
            ) : (
              <div
                className="overflow-hidden rounded-2xl shadow-sm"
                style={{ background: p.tint, border: `1px solid ${p.brand}` }}
              >
                <p className="px-4 pt-3 text-sm font-semibold" style={{ color: p.text }}>
                  🔔 Segui i tuoi ordini ({myOrders.length})
                </p>
                <ul className="px-2 pb-2 pt-1">
                  {myOrders.map((mo, i) => (
                    <li key={mo.id}>
                      <a
                        href={`/ordine/${mo.id}`}
                        className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium transition hover:opacity-80"
                        style={{ color: p.text }}
                      >
                        <span>
                          Ordine #{myOrders.length - i} ·{" "}
                          {new Date(mo.at).toLocaleTimeString("it-IT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          <FaseChip fase={orderFasi[mo.id]} />
                          <span aria-hidden style={{ color: p.brand }}>
                            →
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Category accordion + allergen legend accordion */}
        {categories.length > 0 && (
          <div className="sticky top-0 z-20" style={{ background: p.pageBg }}>
            <div className="px-5 py-3">
              <button
                onClick={() => setCatOpen((o) => !o)}
                aria-expanded={catOpen}
                className="flex w-full items-center justify-between rounded-full px-4 py-2 text-sm font-semibold transition"
                style={{
                  background: catOpen ? p.chipActiveBg : p.chipBg,
                  color: catOpen ? p.chipActiveText : p.chipText,
                  border: catOpen ? "none" : `1px solid ${p.surfaceBorder}`,
                }}
              >
                <span className="truncate">Categorie · {tuttoOn ? "Tutto" : activeCat || categories[0]}</span>
                <span
                  aria-hidden
                  className="ml-2 text-base leading-none"
                  style={{ transform: catOpen ? "rotate(45deg)" : "none", transition: "transform .15s" }}
                >
                  +
                </span>
              </button>
              {catOpen && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setActiveCat(ALL_CAT);
                      setCatOpen(false);
                    }}
                    className="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition"
                    style={{
                      background: tuttoOn ? p.chipActiveBg : p.chipBg,
                      color: tuttoOn ? p.chipActiveText : p.chipText,
                      border: tuttoOn ? "none" : `1px solid ${p.surfaceBorder}`,
                    }}
                  >
                    Tutto
                  </button>
                  {categories.map((c) => {
                    const on = !tuttoOn && c === (activeCat || categories[0]);
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          setActiveCat(c);
                          setCatOpen(false);
                        }}
                        className="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition"
                        style={{
                          background: on ? p.chipActiveBg : p.chipBg,
                          color: on ? p.chipActiveText : p.chipText,
                          border: on ? "none" : `1px solid ${p.surfaceBorder}`,
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {allergyOn && (
              <div className="px-5 pb-2">
                <div
                  className="overflow-hidden rounded-2xl"
                  style={{ background: p.tint, border: `1px solid ${p.surfaceBorder}` }}
                >
                  <button
                    onClick={() => setAllergyOpen((o) => !o)}
                    aria-expanded={allergyOpen}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ border: `1px solid ${p.accent}`, color: p.accent }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block font-display text-sm font-bold"
                        style={{ color: p.text }}
                      >
                        Allergeni e preferenze alimentari
                      </span>
                      <span className="block text-xs" style={{ color: p.textMuted }}>
                        {myAllergens.length
                          ? `${myAllergens.length} selezionate`
                          : "Filtra i piatti in base alle tue esigenze"}
                      </span>
                    </span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        color: p.textMuted,
                        transition: "transform .2s",
                        transform: allergyOpen ? "rotate(180deg)" : "none",
                      }}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {allergyOpen && (
                    <div
                      className="mf-fade border-t px-4 pb-4 pt-3"
                      style={{ borderColor: p.surfaceBorder }}
                    >
                      <p className="text-xs" style={{ color: p.textMuted }}>
                        Seleziona i tuoi allergeni: i piatti che li contengono verranno evidenziati.
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {ALLERGENI.map((a) => {
                          const on = myAllergens.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              aria-pressed={on}
                              onClick={() =>
                                setMyAllergens((s) =>
                                  s.includes(a.id)
                                    ? s.filter((x) => x !== a.id)
                                    : [...s, a.id],
                                )
                              }
                              className="rounded-full px-3 py-1.5 text-sm transition"
                              style={{
                                background: on ? "#fee2e2" : p.surface,
                                color: on ? "#b91c1c" : p.text,
                                border: `1px solid ${on ? "#fca5a5" : p.surfaceBorder}`,
                              }}
                            >
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                      {myAllergens.length > 0 && (
                        <button
                          onClick={() => setMyAllergens([])}
                          className="mt-3 text-xs font-semibold"
                          style={{ color: p.accent }}
                        >
                          Azzera selezione
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {items.length > 5 && (
          <div className="px-5 pt-2">
            <div className="relative">
              <span
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: p.textMuted }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca nel menu…"
                className="w-full rounded-full py-2.5 pl-11 pr-4 text-sm outline-none"
                style={{
                  background: p.surface,
                  color: p.text,
                  border: `1px solid ${p.surfaceBorder}`,
                }}
              />
            </div>
          </div>
        )}

        {backend === "down" && (
          <div className="px-5 pt-2">
            <div
              className="rounded-xl px-4 py-3 text-center text-sm font-semibold"
              style={{
                background: "rgba(245, 158, 11, 0.14)",
                color: dark ? "#fbbf24" : "#92400e",
                border: "1px solid rgba(245,158,11,0.4)",
              }}
            >
              {MAINTENANCE_MSG}
            </div>
          </div>
        )}

        {closed && backend !== "down" && (
          <div className="px-5 pt-2">
            <div
              className="rounded-xl px-4 py-3 text-center text-sm font-semibold"
              style={{
                background: "rgba(245, 158, 11, 0.14)",
                color: dark ? "#fbbf24" : "#92400e",
                border: "1px solid rgba(245,158,11,0.4)",
              }}
            >
              {chiusura
                ? `Chiuso${chiusura.motivo ? ` · ${chiusura.motivo}` : ""}`
                : forcedClosed
                  ? "Siamo chiusi"
                  : `Siamo chiusi${orariOn && orariLabel(tenant.orari) ? ` · Aperto ${orariLabel(tenant.orari)}` : ""}`}
            </div>
          </div>
        )}

        {/* Items */}
        <main className="px-5 pt-3">
          {searching ? (
            shown.length ? (
              <ul className="space-y-3">{shown.map((it, i) => renderItem(it, i))}</ul>
            ) : (
              <p className="py-10 text-center text-sm" style={{ color: p.textMuted }}>
                Nessun piatto trovato.
              </p>
            )
          ) : (
            visibleCats.map((cat) => {
              const its = items.filter((i) => i.categoria === cat);
              if (!its.length) return null;
              return (
                <section key={cat} className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center"
                      style={{ color: p.accent }}
                      aria-hidden
                    >
                      {catIcon(cat)}
                    </span>
                    <h2
                      className="font-display text-xl font-bold"
                      style={{ color: p.text }}
                    >
                      {cat}
                    </h2>
                    <span className="ml-auto text-xs" style={{ color: p.textMuted }}>
                      {its.length} {its.length === 1 ? "prodotto" : "prodotti"}
                    </span>
                  </div>
                  <ul className="space-y-3">{its.map((it, i) => renderItem(it, i))}</ul>
                </section>
              );
            })
          )}
        </main>
      </div>

      {/* Vedi ordine bar */}
      {!ordersBlocked && count > 0 && !sheet && !done && !pending && !optItem && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
          <button
            onClick={() => setSheet(true)}
            className="mf-up pointer-events-auto flex w-full max-w-[480px] items-center gap-3 rounded-2xl px-3 py-3 shadow-2xl"
            style={{ background: p.accent, color: p.onAccent }}
          >
            <span
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.22)" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold"
                style={{ background: dark ? "#0e1013" : "#211b15", color: "#fff" }}
              >
                {count}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
              <span className="font-display text-base font-bold">Vedi ordine</span>
              <span className="text-xs opacity-85">
                {count} {count === 1 ? "prodotto" : "prodotti"} · {formatEUR(totalCents)}
              </span>
            </span>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* Serve aiuto — chiama cameriere / chiedi il conto */}
      {servizioOn && backend !== "down" && !sheet && !done && !pending && !optItem && (
        <div className="fixed bottom-4 left-4 z-30">
          <HelpButton
            slug={tenant.slug}
            tavolo={tavolo}
            p={{
              surface: p.surface,
              text: p.text,
              brand: p.accent,
              onBrand: p.onAccent,
              surfaceBorder: p.surfaceBorder,
              textMuted: p.textMuted,
            }}
          />
        </div>
      )}

      {/* Options modal */}
      {optItem && (
        <OptionsModal
          item={optItem}
          groups={effectiveOptions(optItem, tenant.aggiunte)}
          composizione={composizioneFor(optItem)}
          taglie={taglieFor(optItem)}
          nota={effectiveNota(optItem, tenant.note_config)}
          ingredientiById={ingredientiById}
          ingName={ingName}
          pesoOn={pesoOn}
          kcalOn={kcalOn}
          p={p}
          onClose={() => setOptItem(null)}
          onConfirm={(chosen, composizione, taglia, nota) => {
            addLine(optItem, chosen, composizione, taglia, nota);
            setOptItem(null);
          }}
        />
      )}

      {/* Allergy profile sheet */}
      {/* Cart sheet */}
      {sheet && (
        <div
          className="mf-fade fixed inset-0 z-40 flex items-end justify-center bg-black/50"
          onClick={() => setSheet(false)}
        >
          <div
            className="mf-sheet flex max-h-[90vh] w-full max-w-[480px] flex-col rounded-t-3xl sm:rounded-3xl"
            style={{ background: p.surface, color: p.text }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between rounded-t-3xl px-5 py-4"
              style={{ background: p.headerBg, color: p.headerText }}
            >
              <h2 className="font-display text-xl font-bold">Il tuo ordine</h2>
              <button onClick={() => setSheet(false)} className="text-2xl leading-none opacity-80" aria-label="Chiudi">
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-3">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-start gap-3">
                    <div className="flex items-center gap-2 rounded-full px-1.5 py-1" style={{ background: p.tint }}>
                      <Round bg={p.brand} fg={p.onBrand} onClick={() => setQty(l.key, l.qta - 1)}>−</Round>
                      <span className="w-4 text-center text-sm font-bold">{l.qta}</span>
                      <Round
                        bg={p.brand}
                        fg={p.onBrand}
                        onClick={() => setQty(l.key, l.qta + 1)}
                        disabled={cartUnits(cart, l.item_id) >= stockCapFor(itemById.get(l.item_id))}
                      >
                        +
                      </Round>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">
                        {l.nome}
                        {l.taglia && (
                          <span className="font-normal" style={{ color: p.textMuted }}>
                            {" "}· {l.taglia.nome}
                          </span>
                        )}
                      </span>
                      {l.opzioni.length > 0 && (
                        <span className="block text-xs" style={{ color: p.textMuted }}>
                          {l.opzioni.map((o) => o.scelta).join(", ")}
                        </span>
                      )}
                      {l.composizione.length > 0 && (
                        <span className="block text-xs" style={{ color: p.textMuted }}>
                          {l.composizione.map((c) => `${c.qta}× ${c.nome}`).join(", ")}
                        </span>
                      )}
                      {l.nota && (
                        <span className="block text-xs italic" style={{ color: p.textMuted }}>
                          📝 {l.nota}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold">{formatEUR(effUnit(l) * l.qta)}</span>
                  </li>
                ))}
              </ul>

              {/* Tavolo (mandatory) + note */}
              <div
                className="mt-4 rounded-xl border border-dashed p-3"
                style={{ borderColor: tavoloMissing ? "#ef4444" : p.brand }}
              >
                {(asportoOn || deliveryOn) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {[
                      { dest: "tavolo" as const, label: "Al tavolo", show: true },
                      { dest: "asporto" as const, label: "🛍 Da asporto", show: asportoOn },
                      { dest: "delivery" as const, label: "🛵 Delivery", show: deliveryOn },
                    ]
                      .filter((o) => o.show)
                      .map((opt) => {
                        const cur = delivery ? "delivery" : asporto ? "asporto" : "tavolo";
                        const on = cur === opt.dest;
                        return (
                          <button
                            key={opt.dest}
                            type="button"
                            onClick={() => {
                              setAsporto(opt.dest !== "tavolo");
                              setDelivery(opt.dest === "delivery");
                              setTavolo("");
                              if (opt.dest === "tavolo") setPagaInCassa(false);
                              if (opt.dest !== "delivery") {
                                setIndirizzo("");
                                setPosizione("");
                                setPosState("idle");
                              }
                            }}
                            aria-pressed={on}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition"
                            style={{
                              background: on ? p.tint : "transparent",
                              border: `1px solid ${on ? p.brand : p.surfaceBorder}`,
                              color: on ? p.brand : p.text,
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                  </div>
                )}
                {salaOrdineOn && !asporto && saleList.length > 0 && (
                  <div className="mb-2">
                    <label className="text-xs" style={{ color: p.textMuted }}>
                      Sala
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {saleList.map((s) => {
                        const on = sala === s.nome;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setSala(on ? "" : s.nome)}
                            className="rounded-full px-3 py-1 text-sm font-medium transition"
                            style={{
                              background: on ? p.brand : "transparent",
                              color: on ? p.onBrand : p.text,
                              border: `1px solid ${on ? p.brand : p.surfaceBorder}`,
                            }}
                          >
                            {s.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label className="text-xs" style={{ color: p.textMuted }}>
                  {asporto ? "Nome per il ritiro" : "Numero tavolo"}{" "}
                  <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={tavolo}
                  onChange={(e) => setTavolo(e.target.value)}
                  placeholder={asporto ? "es. Mario — obbligatorio" : "es. 7 — obbligatorio"}
                  className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
                  style={{ color: p.text }}
                />
                {delivery && (
                  <>
                    <input
                      value={indirizzo}
                      onChange={(e) => setIndirizzo(e.target.value)}
                      placeholder="Indirizzo di consegna — obbligatorio"
                      className="mt-2 w-full bg-transparent text-sm outline-none"
                      style={{ color: p.text }}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={sendPosition}
                        disabled={posState === "loading"}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-60"
                        style={{
                          background: posState === "ok" ? p.tint : "transparent",
                          border: `1px solid ${posState === "ok" ? p.brand : p.surfaceBorder}`,
                          color: posState === "ok" ? p.brand : p.text,
                        }}
                      >
                        📍{" "}
                        {posState === "loading"
                          ? "Acquisizione…"
                          : posState === "ok"
                            ? "Posizione acquisita ✓"
                            : "Invia posizione attuale"}
                      </button>
                      {posState === "ok" && (
                        <button
                          type="button"
                          onClick={() => {
                            setPosizione("");
                            setPosState("idle");
                          }}
                          className="text-xs underline"
                          style={{ color: p.textMuted }}
                        >
                          rimuovi
                        </button>
                      )}
                    </div>
                    {posState === "error" && (
                      <p className="mt-1 text-xs" style={{ color: "#ef4444" }}>
                        Posizione non disponibile. Puoi incollare un link Google Maps qui sotto.
                      </p>
                    )}
                    <input
                      value={posizione}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPosizione(v);
                        setPosState(v ? (isMapsUrl(v) ? "ok" : "idle") : "idle");
                      }}
                      placeholder="Link posizione Google Maps (facoltativo)"
                      className="mt-2 w-full bg-transparent text-sm outline-none"
                      style={{ color: p.text }}
                    />
                    {posizione && !isMapsUrl(posizione) && (
                      <p className="mt-1 text-xs" style={{ color: p.textMuted }}>
                        Inserisci un link Google Maps valido (oppure usa il pulsante qui sopra).
                      </p>
                    )}
                  </>
                )}
                {allergeniOrdineOn && (
                  <div className="mt-3">
                    <span className="text-xs" style={{ color: p.textMuted }}>
                      🛡 Allergie del tavolo (facoltativo)
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ALLERGENI.map((a) => {
                        const on = allergeniSel.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setAllergeniSel((prev) =>
                                on ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                              )
                            }
                            className="rounded-full px-2.5 py-1 text-xs font-medium transition"
                            style={{
                              background: on ? p.brand : "transparent",
                              color: on ? p.onBrand : p.text,
                              border: `1px solid ${on ? p.brand : p.surfaceBorder}`,
                            }}
                          >
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {asporto && tenant.pagamenti_attivi && (
                  <div className="mt-3">
                    <span className="text-xs" style={{ color: p.textMuted }}>
                      Pagamento
                    </span>
                    <div className="mt-1 flex gap-2">
                      {[
                        { val: false, label: "Paga ora" },
                        { val: true, label: delivery ? "Paga alla consegna" : "Paga in cassa" },
                      ].map((opt) => {
                        const on = pagaInCassa === opt.val;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setPagaInCassa(opt.val)}
                            aria-pressed={on}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition"
                            style={{
                              background: on ? p.tint : "transparent",
                              border: `1px solid ${on ? p.brand : p.surfaceBorder}`,
                              color: on ? p.brand : p.text,
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (allergie, preferenze…)"
                  className="mt-2 w-full bg-transparent text-sm outline-none"
                  style={{ color: p.text }}
                />
              </div>

              {/* Coperto — per persona (obbligatorio): stepper. Not for asporto. */}
              {!asporto && cMode === "persona" && (
                <div
                  className="mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-sm"
                  style={{
                    border: `1px dashed ${copertiMissing ? "#ef4444" : p.surfaceBorder}`,
                  }}
                >
                  <span>
                    {cLabel}{" "}
                    <span style={{ color: p.textMuted }}>
                      ({formatEUR(Math.round(tenant.coperto * 100))} a persona) ·
                      quante persone? <span style={{ color: "#ef4444" }}>*</span>
                    </span>
                  </span>
                  <div className="flex items-center gap-2 rounded-full px-1.5 py-1" style={{ background: p.tint }}>
                    <Round bg={p.brand} fg={p.onBrand} onClick={() => setCoperti(Math.max(0, coperti - 1))}>−</Round>
                    <span className="w-4 text-center font-bold">{coperti}</span>
                    <Round bg={p.brand} fg={p.onBrand} onClick={() => setCoperti(Math.min(50, coperti + 1))}>+</Round>
                  </div>
                </div>
              )}
              {/* Coperto — fisso a ordine / servizio %: riga informativa */}
              {!asporto && (cMode === "ordine" || cMode === "servizio") && copertoCents >= 0 && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>
                    {cLabel}{" "}
                    <span style={{ color: p.textMuted }}>
                      {cMode === "servizio"
                        ? `(${tenant.coperto}% sul totale)`
                        : "(a ordine)"}
                    </span>
                  </span>
                  <span className="font-semibold">{formatEUR(copertoCents)}</span>
                </div>
              )}

              {/* Mancia */}
              {tipEligible && (
                <div className="mt-3">
                  <div className="mb-1 text-sm">Mancia</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { l: "Nessuna", c: 0 },
                      { l: "5%", c: Math.round(itemsCents * 0.05) },
                      { l: "10%", c: Math.round(itemsCents * 0.1) },
                      { l: "15%", c: Math.round(itemsCents * 0.15) },
                    ].map((opt) => {
                      const on = manciaCents === opt.c;
                      return (
                        <button
                          key={opt.l}
                          onClick={() => setManciaCents(opt.c)}
                          className="rounded-full px-3 py-1 text-sm font-medium"
                          style={{
                            background: on ? p.brand : p.tint,
                            color: on ? p.onBrand : p.text,
                          }}
                        >
                          {opt.l}
                          {opt.c > 0 ? ` · ${formatEUR(opt.c)}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}
            </div>

            <div className="border-t px-5 py-4" style={{ borderColor: p.surfaceBorder }}>
              {(copertoCents > 0 || (tipEligible && manciaCents > 0)) && (
                <div className="mb-2 space-y-0.5 text-sm" style={{ color: p.textMuted }}>
                  <div className="flex justify-between"><span>Subtotale</span><span>{formatEUR(itemsCents)}</span></div>
                  {copertoCents > 0 && (
                    <div className="flex justify-between">
                      <span>
                        {cLabel}
                        {cMode === "persona" ? ` ×${coperti}` : cMode === "servizio" ? ` ${tenant.coperto}%` : ""}
                      </span>
                      <span>{formatEUR(copertoCents)}</span>
                    </div>
                  )}
                  {tipEligible && manciaCents > 0 && (
                    <div className="flex justify-between"><span>Mancia</span><span>{formatEUR(manciaCents)}</span></div>
                  )}
                </div>
              )}
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-lg font-semibold">Totale</span>
                <span className="font-display text-2xl font-bold">{formatEUR(totalCents)}</span>
              </div>
              <button
                onClick={submit}
                disabled={submitting || count === 0 || tavoloMissing || copertiMissing}
                className="w-full rounded-xl py-3.5 text-center font-semibold disabled:opacity-50"
                style={{ background: p.accent, color: p.onAccent }}
              >
                {submitting
                  ? "Invio…"
                  : tavoloMissing
                    ? asporto
                      ? "Inserisci il nome"
                      : "Inserisci il tavolo"
                    : copertiMissing
                      ? "Indica i coperti"
                      : tenant.pagamenti_attivi
                        ? "Vai al pagamento"
                        : "✓ Invia ordine"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment pending */}
      {pending && !done && (
        <Overlay p={p}>
          <div className="text-4xl">💳</div>
          <h3 className="mt-2 font-display text-xl font-bold">Pagamento</h3>
          <p className="mt-2 text-sm" style={{ color: p.textMuted }}>
            Ordine creato in attesa di pagamento. Sarà valido solo dopo la conferma.
          </p>
          {pending.sim ? (
            <button
              onClick={() => simulate(pending.orderId)}
              disabled={submitting}
              className="mt-4 w-full rounded-xl py-3.5 font-semibold disabled:opacity-60"
              style={{ background: p.brand, color: p.onBrand }}
            >
              {submitting ? "…" : "Simula pagamento riuscito (dev)"}
            </button>
          ) : (
            <p className="mt-3 text-sm" style={{ color: p.textMuted }}>
              Completa il pagamento nella schermata Stripe.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </Overlay>
      )}

      {/* Confirmation + live status */}
      {done && (
        <Overlay p={p}>
          <div className="text-5xl">{status === "Pronto" ? "🔔" : "✅"}</div>
          <h3 className="mt-2 font-display text-xl font-bold">
            {done.mode === "paid" ? "Pagamento ricevuto!" : "Ordine inviato!"}
          </h3>
          <p className="mt-2 text-sm" style={{ color: p.textMuted }}>
            Tavolo {tavolo || "—"} · lo staff è stato avvisato.
          </p>
          {status && (
            <div
              className="mt-4 rounded-xl px-4 py-3 font-semibold"
              style={{
                background: status === "Pronto" ? "rgba(34,197,94,0.15)" : p.tint,
                color: status === "Pronto" ? "#16a34a" : p.text,
              }}
            >
              Stato: {status === "Pronto" ? "🔔 Pronto!" : status === "In preparazione" ? "👩‍🍳 In preparazione" : status}
            </div>
          )}
          {tenant.funzioni_attive?.feedback && (
            <div className="mt-4">
              <div className="text-sm" style={{ color: p.textMuted }}>
                {voted ? "Grazie per il tuo voto!" : "Com’è andata?"}
              </div>
              <div className="mt-1 flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    disabled={voted != null}
                    onClick={() => sendVoto(n)}
                    className="text-2xl"
                    style={{ color: voted != null && n <= voted ? "#f59e0b" : p.textMuted }}
                    aria-label={`${n} stelle`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          )}
          {trackingOn && done.orderId && (
            <a
              href={`/ordine/${done.orderId}`}
              className="mt-4 block w-full rounded-xl py-3 text-center font-semibold"
              style={{ background: p.brand, color: p.onBrand }}
            >
              🔔 Segui il tuo ordine
            </a>
          )}
          <button
            onClick={() => {
              setDone(null);
              setStatus(null);
              setVoted(null);
            }}
            className="mt-3 w-full rounded-xl py-3.5 font-semibold"
            style={
              trackingOn && done.orderId
                ? { border: `1px solid ${p.surfaceBorder}`, color: p.text }
                : { background: p.brand, color: p.onBrand }
            }
          >
            Nuovo ordine
          </button>
        </Overlay>
      )}
    </div>
  );
}

/**
 * Homepage showcase carousel. Brand-coloured slides (small image + title +
 * price + an optional per-product announcement) that auto-advance and snap on
 * swipe; tapping a slide adds the product (or opens its options) just like the
 * menu. Pauses while the customer is interacting. Gated by the `vetrina` flag
 * and only rendered when there is at least one featured, available product.
 */
function VetrinaCarousel({
  slides,
  p,
  dark,
  t,
  blocked,
  radius,
  onPick,
  renderAdd,
}: {
  slides: MenuItem[];
  p: Palette;
  dark: boolean;
  t: (it: string, i18n: Record<string, string> | undefined) => string;
  blocked: boolean;
  radius: number;
  onPick: (item: MenuItem) => void;
  renderAdd: (item: MenuItem) => React.ReactNode;
}) {
  // Match the menu cards' photo rounding so a slide reads as the same component.
  const photoR = Math.max(radius - 4, 4);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [active, setActive] = useState(0);

  // Index of the slide nearest the current scroll position, measured from the
  // real child offsets — so the inter-slide gap never skews the math.
  const nearestIndex = (el: HTMLDivElement) => {
    const kids = el.children;
    if (kids.length === 0) return 0;
    const base = (kids[0] as HTMLElement).offsetLeft;
    const x = el.scrollLeft;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < kids.length; i++) {
      const d = Math.abs((kids[i] as HTMLElement).offsetLeft - base - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  // Auto-advance ~every 4.5s, looping; skipped while the user is interacting and
  // disabled entirely for visitors who prefer reduced motion.
  useEffect(() => {
    if (slides.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = trackRef.current;
      if (!el || pausedRef.current) return;
      const next = (nearestIndex(el) + 1) % slides.length;
      const kid = el.children[next] as HTMLElement | undefined;
      const base = (el.children[0] as HTMLElement | undefined)?.offsetLeft ?? 0;
      el.scrollTo({ left: kid ? kid.offsetLeft - base : 0, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(id);
  }, [slides.length]);

  const onScroll = () => {
    const el = trackRef.current;
    if (el) setActive(nearestIndex(el));
  };
  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };
  // Arrow navigation: scroll to the prev/next slide (wraps around).
  const go = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const next = (nearestIndex(el) + dir + slides.length) % slides.length;
    const base = (el.children[0] as HTMLElement | undefined)?.offsetLeft ?? 0;
    const kid = el.children[next] as HTMLElement | undefined;
    el.scrollTo({ left: kid ? kid.offsetLeft - base : 0, behavior: "smooth" });
  };

  return (
    <section className="px-5 pt-3" aria-label="In vetrina">
      <div className="mb-2 flex items-center gap-1.5">
        <span aria-hidden style={{ color: p.brand }}>
          ✨
        </span>
        <h2
          className="font-display text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: p.textMuted }}
        >
          In vetrina
        </h2>
      </div>
      <div className="flex items-center gap-1.5">
        {slides.length > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Prodotto precedente"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none shadow-sm transition active:scale-90"
            style={{ background: p.surface, color: p.text, border: `1px solid ${p.surfaceBorder}` }}
          >
            ‹
          </button>
        )}
        <div
          ref={trackRef}
          onScroll={onScroll}
          onPointerDown={pause}
          onPointerUp={resume}
          onPointerCancel={resume}
          onMouseEnter={pause}
          onMouseLeave={resume}
          className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((item) => {
            const nome = t(item.nome, item.nome_i18n);
            const annuncio = item.vetrina_annuncio?.trim();
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!blocked) onPick(item);
                }}
                className="flex w-full shrink-0 snap-center items-stretch gap-2.5 p-2.5 transition active:opacity-90"
                style={{
                  background: p.surface,
                  border: `1px solid ${p.surfaceBorder}`,
                  borderRadius: radius,
                  boxShadow: dark ? "none" : "0 1px 3px rgba(0,0,0,0.05)",
                  cursor: blocked ? "default" : "pointer",
                }}
              >
                {item.foto_url ? (
                  <Image
                    src={item.foto_url}
                    alt={nome}
                    width={128}
                    height={128}
                    sizes="64px"
                    className="shrink-0 self-center object-cover"
                    style={{ width: 64, height: 64, borderRadius: photoR }}
                  />
                ) : (
                  <div
                    className="flex shrink-0 self-center items-center justify-center font-display text-2xl font-bold"
                    style={{ width: 64, height: 64, background: p.tint, color: p.brand, borderRadius: photoR }}
                  >
                    {nome.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <h3 className="truncate font-display text-[0.95rem] font-semibold leading-tight" style={{ color: p.text }}>
                    {nome}
                  </h3>
                  {annuncio && (
                    <span className="truncate text-[11px] font-semibold" style={{ color: p.brand }}>
                      {annuncio}
                    </span>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-display text-base font-bold" style={{ color: p.price }}>
                      {formatEUR(Math.round(item.prezzo * 100))}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>{renderAdd(item)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {slides.length > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Prodotto successivo"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none shadow-sm transition active:scale-90"
            style={{ background: p.surface, color: p.text, border: `1px solid ${p.surfaceBorder}` }}
          >
            ›
          </button>
        )}
      </div>
      {slides.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {slides.map((s, i) => {
            // Clamp so a shrinking slide list (item sold out via realtime) can't
            // leave `active` pointing past the end with no dot lit.
            const on = i === Math.min(active, slides.length - 1);
            return (
              <span
                key={s.id}
                aria-hidden
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: on ? 18 : 6, background: on ? p.brand : p.surfaceBorder }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * The product add control used by every menu card: a "+ Aggiungi" pill (with a
 * quantity badge) when nothing is in the cart yet or the item has options, and a
 * "− qty +" stepper for an option-less item already in the cart. Shared so the
 * vetrina carousel shows the exact same button as the menu rows. Returns null
 * when the item can't be added (sold out / ordering unavailable).
 */
function ItemAddControl({
  item,
  p,
  qty,
  hasOpts,
  tappable,
  maxQty,
  onTap,
  onAddOne,
  onSetQty,
}: {
  item: MenuItem;
  p: Palette;
  qty: number;
  hasOpts: boolean;
  tappable: boolean;
  maxQty: number;
  onTap: () => void;
  onAddOne: () => void;
  onSetQty: (q: number) => void;
}) {
  if (!tappable) return null;
  if (qty > 0 && !hasOpts) {
    return (
      <div className="flex items-center gap-1 rounded-full p-1" style={{ border: `1px solid ${p.accent}` }}>
        <Round bg="transparent" fg={p.accent} label={`Togli un ${item.nome}`} onClick={() => onSetQty(qty - 1)}>
          −
        </Round>
        <span className="w-5 text-center text-sm font-bold tabular-nums">{qty}</span>
        <Round bg={p.accent} fg={p.onAccent} label={`Aggiungi un ${item.nome}`} onClick={onAddOne} disabled={qty >= maxQty}>
          +
        </Round>
      </div>
    );
  }
  return (
    <button
      onClick={onTap}
      aria-label={`Aggiungi ${item.nome}`}
      className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-95"
      style={{ background: p.accent, color: p.onAccent }}
    >
      <span className="text-base leading-none">+</span> Aggiungi
      {qty > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
          style={{ background: p.text, color: p.pageBg }}
        >
          {qty}
        </span>
      )}
    </button>
  );
}

function Round({
  children,
  bg,
  fg,
  onClick,
  label,
  disabled = false,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold leading-none transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
      style={{ background: bg, color: fg }}
    >
      {children}
    </button>
  );
}

type Pal = ReturnType<typeof brandPalette>;

function OptionsModal({
  item,
  groups,
  composizione,
  taglie,
  nota,
  ingredientiById,
  ingName,
  pesoOn,
  kcalOn,
  p,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  groups: ItemOption[];
  composizione: ComposizioneGruppo[];
  taglie: TagliaComposizione[];
  nota: { label: string; obbligatoria: boolean } | null;
  ingredientiById: Map<string, PublicIngredient>;
  ingName: (ing: PublicIngredient) => string;
  pesoOn: boolean;
  kcalOn: boolean;
  p: Pal;
  onClose: () => void;
  onConfirm: (
    chosen: Chosen[],
    composizione: OrderComposizione[],
    taglia?: { id: string; nome: string; prezzo?: number },
    nota?: string,
  ) => void;
}) {
  const [notaText, setNotaText] = useState("");
  // default: preselect first choice of required single groups
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups)
      init[g.id] = g.tipo === "single" && g.obbligatorio ? [g.scelte[0]?.nome] : [];
    return init;
  });
  // composition quantities per ingredient id
  const [compo, setCompo] = useState<Record<string, number>>({});
  const setQ = (id: string, n: number) => setCompo((c) => ({ ...c, [id]: Math.max(0, n) }));

  // chosen size (if the category has sizes). Changing size resets the picks so
  // the customer composes within the new limits.
  const [tagliaId, setTagliaId] = useState<string>(() => taglie[0]?.id ?? "");
  const taglia = taglie.find((tg) => tg.id === tagliaId);
  function chooseTaglia(id: string) {
    setTagliaId(id);
    setCompo({});
  }
  const effMax = (g: ComposizioneGruppo) => taglia?.max[g.id] ?? g.max;
  const effMin = (g: ComposizioneGruppo) => Math.min(g.min, effMax(g));

  function toggle(g: ItemOption, choice: string) {
    setSel((s) => {
      const cur = s[g.id] ?? [];
      if (g.tipo === "single") return { ...s, [g.id]: [choice] };
      return {
        ...s,
        [g.id]: cur.includes(choice) ? cur.filter((c) => c !== choice) : [...cur, choice],
      };
    });
  }

  const chosen: Chosen[] = groups.flatMap((g) =>
    (sel[g.id] ?? [])
      .map((name) => {
        const c = g.scelte.find((s) => s.nome === name);
        return c ? { gruppo: g.nome, scelta: c.nome, prezzo: c.prezzo } : null;
      })
      .filter((x): x is Chosen => x !== null),
  );

  const groupTotal = (g: ComposizioneGruppo) =>
    g.ingredienti.reduce((s, x) => s + (compo[x.ingredient_id] ?? 0), 0);
  // Translated name is for the in-cart PREVIEW only: the order submit sends just
  // {ingredient_id, qta}, and api/ordine re-derives the persisted snapshot from the
  // base (Italian) ingredient name — so the kitchen comanda stays Italian.
  const composed: OrderComposizione[] = composizione.flatMap((g) =>
    g.ingredienti
      .map((s) => {
        const ing = ingredientiById.get(s.ingredient_id);
        const qta = compo[s.ingredient_id] ?? 0;
        return ing && qta > 0
          ? { ingredient_id: s.ingredient_id, nome: ingName(ing), qta, prezzo: s.prezzo ?? ing.prezzo }
          : null;
      })
      .filter((x): x is OrderComposizione => x !== null),
  );

  // Live weight/calories of the current composition (the dynamic "peso poke" figure).
  const liveNutri =
    pesoOn || kcalOn ? composedNutrition(composed, (id) => ingredientiById.get(id)) : null;

  const compoMissing = composizione.some((g) => groupTotal(g) < effMin(g));
  const notaMissing = Boolean(nota?.obbligatoria) && !notaText.trim();
  const missing =
    groups.some((g) => g.obbligatorio && (sel[g.id]?.length ?? 0) === 0) ||
    compoMissing ||
    notaMissing;
  const unitCents =
    Math.round(item.prezzo * 100) +
    Math.round((taglia?.prezzo ?? 0) * 100) +
    chosen.reduce((s, c) => s + Math.round(c.prezzo * 100), 0) +
    composed.reduce((s, c) => s + Math.round(c.prezzo * 100) * c.qta, 0);

  return (
    <div className="mf-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="mf-sheet flex max-h-[85vh] w-full max-w-[480px] flex-col rounded-t-3xl sm:rounded-3xl"
        style={{ background: p.surface, color: p.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between rounded-t-3xl px-5 py-4" style={{ background: p.headerBg, color: p.headerText }}>
          <h2 className="font-display text-lg font-bold">{item.nome}</h2>
          <button onClick={onClose} className="text-2xl leading-none opacity-80" aria-label="Chiudi">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {taglie.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold">Formato</span>
                <span className="text-xs" style={{ color: p.textMuted }}>
                  scelta obbligatoria
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {taglie.map((tg) => {
                  const on = tg.id === tagliaId;
                  return (
                    <button
                      key={tg.id}
                      onClick={() => chooseTaglia(tg.id)}
                      aria-pressed={on}
                      className="rounded-lg px-3 py-2 text-sm font-medium"
                      style={{
                        background: on ? p.tint : "transparent",
                        border: `1px solid ${on ? p.brand : p.surfaceBorder}`,
                        color: on ? p.brand : p.text,
                      }}
                    >
                      {tg.nome}
                      {tg.prezzo > 0 && (
                        <span className="font-normal" style={{ color: on ? p.brand : p.textMuted }}>
                          {" "}
                          · +{formatEUR(Math.round(tg.prezzo * 100))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.id} className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold">{g.nome}</span>
                <span className="text-xs" style={{ color: p.textMuted }}>
                  {g.tipo === "single" ? "scelta singola" : "scelta multipla"}
                  {g.obbligatorio ? " · obbligatorio" : ""}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.scelte.map((c) => {
                  const on = (sel[g.id] ?? []).includes(c.nome);
                  return (
                    <button
                      key={c.nome}
                      onClick={() => toggle(g, c.nome)}
                      aria-pressed={on}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left"
                      style={{
                        background: on ? p.tint : "transparent",
                        border: `1px solid ${on ? p.brand : p.surfaceBorder}`,
                      }}
                    >
                      <span>{c.nome}</span>
                      <span className="text-sm" style={{ color: p.textMuted }}>
                        {c.prezzo > 0 ? `+ ${formatEUR(Math.round(c.prezzo * 100))}` : "incluso"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Composizione: stepper per ingrediente, limitati dallo stock */}
          {composizione.map((g) => {
            const total = groupTotal(g);
            return (
              <div key={g.id} className="mb-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold">{g.nome}</span>
                  <span className="text-xs" style={{ color: total < effMin(g) ? "#dc2626" : p.textMuted }}>
                    {effMin(g) > 0 ? `min ${effMin(g)} · ` : ""}max {effMax(g)} · {total}/{effMax(g)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {g.ingredienti.map((s) => {
                    const ing = ingredientiById.get(s.ingredient_id);
                    if (!ing) return null;
                    const qty = compo[s.ingredient_id] ?? 0;
                    const soldOut = ing.scorta != null && ing.scorta <= 0;
                    const perMax = Math.min(ing.scorta ?? Infinity, effMax(g) - total + qty);
                    const prezzo = s.prezzo ?? ing.prezzo;
                    return (
                      <div
                        key={s.ingredient_id}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                        style={{
                          background: qty > 0 ? p.tint : "transparent",
                          border: `1px solid ${qty > 0 ? p.brand : p.surfaceBorder}`,
                          opacity: soldOut ? 0.5 : 1,
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">
                            {ingName(ing)}
                            {ing.unita ? (
                              <span className="font-normal" style={{ color: p.textMuted }}>
                                {" "}· {ing.unita}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs" style={{ color: p.textMuted }}>
                            {prezzo > 0 ? `+ ${formatEUR(Math.round(prezzo * 100))}` : "incluso"}
                            {pesoOn && ing.peso != null ? ` · ${ing.peso} g` : ""}
                            {kcalOn && kcalDaGrammi(ing.peso, ing.kcal_per_100g) != null
                              ? ` · ${Math.round(kcalDaGrammi(ing.peso, ing.kcal_per_100g)!)} kcal`
                              : ""}
                            {!soldOut && ing.scorta != null ? ` · ne restano ${ing.scorta}` : ""}
                          </span>
                        </span>
                        {soldOut ? (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: p.surfaceBorder, color: p.textMuted }}
                          >
                            Esaurito
                          </span>
                        ) : (
                          <div
                            className="flex shrink-0 items-center gap-2 rounded-full px-1.5 py-1"
                            style={{ border: `1px solid ${p.surfaceBorder}` }}
                          >
                            <Round
                              bg="transparent"
                              fg={p.brand}
                              label={`Togli ${ingName(ing)}`}
                              onClick={() => setQ(s.ingredient_id, qty - 1)}
                            >
                              −
                            </Round>
                            <span className="w-4 text-center text-sm font-bold tabular-nums">{qty}</span>
                            <Round
                              bg={qty >= perMax ? p.surfaceBorder : p.brand}
                              fg={qty >= perMax ? p.textMuted : p.onBrand}
                              label={`Aggiungi ${ingName(ing)}`}
                              onClick={() => qty < perMax && setQ(s.ingredient_id, qty + 1)}
                            >
                              +
                            </Round>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {nota && (
            <div className="mb-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold">{nota.label}</span>
                <span className="text-xs" style={{ color: p.textMuted }}>
                  {nota.obbligatoria ? "obbligatoria" : "facoltativa"}
                </span>
              </div>
              <textarea
                value={notaText}
                onChange={(e) => setNotaText(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={nota.label}
                className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "transparent", color: p.text, border: `1px solid ${p.surfaceBorder}` }}
              />
            </div>
          )}
        </div>
        <div className="border-t px-5 py-4" style={{ borderColor: p.surfaceBorder }}>
          {liveNutri && ((pesoOn && liveNutri.peso != null) || (kcalOn && liveNutri.kcal != null)) && (
            <p className="mb-2 text-center text-xs" style={{ color: p.textMuted }}>
              {[
                pesoOn && liveNutri.peso != null ? `~${liveNutri.peso} g` : null,
                kcalOn && liveNutri.kcal != null ? `~${liveNutri.kcal} kcal` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <button
            onClick={() =>
              onConfirm(
                chosen,
                composed,
                taglia ? { id: taglia.id, nome: taglia.nome, prezzo: taglia.prezzo } : undefined,
                notaText,
              )
            }
            disabled={missing}
            className="w-full rounded-xl py-3.5 font-semibold disabled:opacity-50"
            style={{ background: p.brand, color: p.onBrand }}
          >
            {missing ? "Completa le scelte richieste" : `Aggiungi · ${formatEUR(unitCents)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Overlay({ children, p }: { children: React.ReactNode; p: Pal }) {
  return (
    <div className="mf-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="mf-sheet w-full max-w-[400px] rounded-3xl p-6 text-center"
        style={{ background: p.surface, color: p.text, border: `1px solid ${p.surfaceBorder}` }}
      >
        {children}
      </div>
    </div>
  );
}
