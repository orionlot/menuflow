"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { brandPalette } from "@/lib/brand";
import { resolveLayout, FONT_VARS } from "@/lib/config/layout";
import { isOpenNow, orariLabel } from "@/lib/orari";
import { effectiveOptions } from "@/lib/menu";
import HelpButton from "./HelpButton";
import { ALLERGENI, ALLERGENI_BY_ID } from "@/lib/config/allergeni";

const MAINTENANCE_MSG =
  "App momentaneamente in manutenzione — Si prega di rivolgersi allo staff per l'ordinazione";

const ALL_CAT = "__all__";

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
  taglia?: { id: string; nome: string };
}

function lineKey(
  itemId: string,
  chosen: Chosen[],
  compo: OrderComposizione[] = [],
  tagliaId?: string,
): string {
  const parts: string[] = [];
  if (tagliaId) parts.push(`t:${tagliaId}`);
  if (chosen.length)
    parts.push(chosen.map((c) => `${c.gruppo}:${c.scelta}`).sort().join(","));
  if (compo.length)
    parts.push(compo.map((c) => `${c.ingredient_id}x${c.qta}`).sort().join(","));
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
  const ingredientiById = useMemo(
    () => new Map(ingredienti.map((i) => [i.id, i])),
    [ingredienti],
  );
  const composizioneFor = (categoria: string): ComposizioneGruppo[] =>
    componibiliOn
      ? (tenant.composizione ?? []).filter((g) => g.categorie.includes(categoria))
      : [];
  const taglieFor = (categoria: string): TagliaComposizione[] =>
    componibiliOn
      ? (tenant.composizione_taglie ?? []).filter((tg) => tg.categorie.includes(categoria))
      : [];

  const [lang, setLang] = useState<string>(tenant.lingue?.[0] ?? "it");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [tavolo, setTavolo] = useState("");
  const [asporto, setAsporto] = useState(false);
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
  const [myAllergens, setMyAllergens] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [voted, setVoted] = useState<number | null>(null);

  // Prefill table number from QR (?tavolo=) without forcing the page dynamic.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tavolo");
    if (t) setTavolo(t);
  }, []);

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

  const t = (it: string, i18n: Record<string, string> | undefined) =>
    lang !== "it" && i18n?.[lang] ? i18n[lang] : it;

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
  const itemsCents = lines.reduce((s, l) => s + l.unitCents * l.qta, 0);

  // Cover charge per the restaurant's configured mode.
  const cMode = tenant.coperto_modalita;
  const cLabel = tenant.coperto_label || "Coperto";
  const copertoCents =
    cMode === "persona"
      ? Math.round(tenant.coperto * 100) * coperti
      : cMode === "ordine"
        ? Math.round(tenant.coperto * 100)
        : cMode === "servizio"
          ? Math.round((itemsCents * tenant.coperto) / 100)
          : 0;
  const copertiMissing = cMode === "persona" && coperti < 1;
  const tipEligible = tenant.pagamenti_attivi && tenant.accetta_mancia;
  const totalCents = itemsCents + copertoCents + (tipEligible ? manciaCents : 0);

  const qtyForItem = (id: string) =>
    lines.filter((l) => l.item_id === id).reduce((s, l) => s + l.qta, 0);

  function addLine(
    item: MenuItem,
    chosen: Chosen[],
    composizione: OrderComposizione[] = [],
    taglia?: { id: string; nome: string },
  ) {
    const unitCents =
      Math.round(item.prezzo * 100) +
      chosen.reduce((s, c) => s + Math.round(c.prezzo * 100), 0) +
      composizione.reduce((s, c) => s + Math.round(c.prezzo * 100) * c.qta, 0);
    const key = lineKey(item.id, chosen, composizione, taglia?.id);
    setCart((c) => {
      const existing = c[key];
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
            },
      };
    });
  }
  function tapAdd(item: MenuItem) {
    if (
      effectiveOptions(item, tenant.aggiunte).length ||
      composizioneFor(item.categoria).length ||
      taglieFor(item.categoria).length
    )
      setOptItem(item);
    else addLine(item, []);
  }
  const setQty = (key: string, q: number) =>
    setCart((c) => ({ ...c, [key]: { ...c[key], qta: Math.max(0, Math.min(99, q)) } }));

  async function submit() {
    if (!asporto && !tavolo.trim()) {
      setError("Inserisci il numero del tavolo per procedere.");
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
          tavolo: asporto ? "Asporto" : tavolo,
          note,
          coperti: cMode === "persona" ? coperti : undefined,
          mancia: tipEligible ? manciaCents / 100 : undefined,
          items: lines.map((l) => ({
            item_id: l.item_id,
            qta: l.qta,
            opzioni: l.opzioni.map((o) => ({ gruppo: o.gruppo, scelta: o.scelta })),
            composizione: l.composizione.map((c) => ({
              ingredient_id: c.ingredient_id,
              qta: c.qta,
            })),
            taglia_id: l.taglia?.id,
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
  const tavoloMissing = !asporto && !tavolo.trim();
  const closed = Boolean(tenant.funzioni_attive?.orari) && !isOpenNow(tenant.orari);
  const ordersBlocked = backend === "down" || closed;
  const tuttoOn = activeCat === ALL_CAT;

  const renderItem = (item: MenuItem, idx: number) => {
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
          .map((id) => ingredientiById.get(id)?.nome)
          .filter(Boolean)
          .join(", ")
      : "";
    const recommended = Boolean(
      tenant.funzioni_attive?.piatto_consigliato && item.consigliato,
    );
    const popular = popolari.includes(item.id);
    const lowStock =
      scorteOn && item.scorta != null && item.scorta > 0 && item.scorta <= 5;
    const tappable = !sold && !ordersBlocked;

    const addControl = !tappable ? null : qty > 0 && !hasOpts ? (
      <div
        className="flex items-center gap-1 rounded-full p-1"
        style={{ border: `1px solid ${p.accent}` }}
      >
        <Round
          bg="transparent"
          fg={p.accent}
          label={`Togli un ${item.nome}`}
          onClick={() => setQty(item.id, qty - 1)}
        >
          −
        </Round>
        <span className="w-5 text-center text-sm font-bold tabular-nums">{qty}</span>
        <Round
          bg={p.accent}
          fg={p.onAccent}
          label={`Aggiungi un ${item.nome}`}
          onClick={() => addLine(item, [])}
        >
          +
        </Round>
      </div>
    ) : (
      <button
        onClick={() => tapAdd(item)}
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

        {/* Category rail + allergen legend accordion */}
        {categories.length > 0 && (
          <div className="sticky top-0 z-20" style={{ background: p.pageBg }}>
            <div className="flex flex-wrap gap-2 px-5 py-3">
              <button
                onClick={() => setActiveCat(ALL_CAT)}
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
                    onClick={() => setActiveCat(c)}
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
              Siamo chiusi
              {orariLabel(tenant.orari) ? ` · Aperto ${orariLabel(tenant.orari)}` : ""}
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
      {backend !== "down" && !sheet && !done && !pending && !optItem && (
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
          composizione={composizioneFor(optItem.categoria)}
          taglie={taglieFor(optItem.categoria)}
          ingredientiById={ingredientiById}
          p={p}
          onClose={() => setOptItem(null)}
          onConfirm={(chosen, composizione, taglia) => {
            addLine(optItem, chosen, composizione, taglia);
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
                      <Round bg={p.brand} fg={p.onBrand} onClick={() => setQty(l.key, l.qta + 1)}>+</Round>
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
                    </div>
                    <span className="font-semibold">{formatEUR(l.unitCents * l.qta)}</span>
                  </li>
                ))}
              </ul>

              {/* Tavolo (mandatory) + note */}
              <div
                className="mt-4 rounded-xl border border-dashed p-3"
                style={{ borderColor: tavoloMissing ? "#ef4444" : p.brand }}
              >
                <div className="mb-2 flex gap-2">
                  {[
                    { val: false, label: "Al tavolo" },
                    { val: true, label: "🛍 Da asporto" },
                  ].map((opt) => {
                    const on = asporto === opt.val;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setAsporto(opt.val)}
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
                {!asporto && (
                  <>
                    <label className="text-xs" style={{ color: p.textMuted }}>
                      Numero tavolo <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      value={tavolo}
                      onChange={(e) => setTavolo(e.target.value)}
                      placeholder="es. 7 — obbligatorio"
                      className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
                      style={{ color: p.text }}
                    />
                  </>
                )}
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (allergie, preferenze…)"
                  className="mt-2 w-full bg-transparent text-sm outline-none"
                  style={{ color: p.text }}
                />
              </div>

              {/* Coperto — per persona (obbligatorio): stepper */}
              {cMode === "persona" && (
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
              {(cMode === "ordine" || cMode === "servizio") && copertoCents >= 0 && (
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
                    ? "Inserisci il tavolo"
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
          {tenant.funzioni_attive?.recensioni && tenant.google_review_url && (
            <a
              href={tenant.google_review_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block w-full rounded-xl py-3 text-center font-semibold"
              style={{ background: p.tint, color: p.text }}
            >
              ⭐ Ti è piaciuto? Lascia una recensione
            </a>
          )}
          <button
            onClick={() => {
              setDone(null);
              setStatus(null);
              setVoted(null);
            }}
            className="mt-4 w-full rounded-xl py-3.5 font-semibold"
            style={{ background: p.brand, color: p.onBrand }}
          >
            Nuovo ordine
          </button>
        </Overlay>
      )}
    </div>
  );
}

function Round({
  children,
  bg,
  fg,
  onClick,
  label,
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold leading-none transition active:scale-90"
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
  ingredientiById,
  p,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  groups: ItemOption[];
  composizione: ComposizioneGruppo[];
  taglie: TagliaComposizione[];
  ingredientiById: Map<string, PublicIngredient>;
  p: Pal;
  onClose: () => void;
  onConfirm: (
    chosen: Chosen[],
    composizione: OrderComposizione[],
    taglia?: { id: string; nome: string },
  ) => void;
}) {
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
  const composed: OrderComposizione[] = composizione.flatMap((g) =>
    g.ingredienti
      .map((s) => {
        const ing = ingredientiById.get(s.ingredient_id);
        const qta = compo[s.ingredient_id] ?? 0;
        return ing && qta > 0
          ? { ingredient_id: s.ingredient_id, nome: ing.nome, qta, prezzo: s.prezzo ?? ing.prezzo }
          : null;
      })
      .filter((x): x is OrderComposizione => x !== null),
  );

  const compoMissing = composizione.some((g) => groupTotal(g) < effMin(g));
  const missing =
    groups.some((g) => g.obbligatorio && (sel[g.id]?.length ?? 0) === 0) || compoMissing;
  const unitCents =
    Math.round(item.prezzo * 100) +
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
                            {ing.nome}
                            {ing.unita ? (
                              <span className="font-normal" style={{ color: p.textMuted }}>
                                {" "}· {ing.unita}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs" style={{ color: p.textMuted }}>
                            {prezzo > 0 ? `+ ${formatEUR(Math.round(prezzo * 100))}` : "incluso"}
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
                              label={`Togli ${ing.nome}`}
                              onClick={() => setQ(s.ingredient_id, qty - 1)}
                            >
                              −
                            </Round>
                            <span className="w-4 text-center text-sm font-bold tabular-nums">{qty}</span>
                            <Round
                              bg={qty >= perMax ? p.surfaceBorder : p.brand}
                              fg={qty >= perMax ? p.textMuted : p.onBrand}
                              label={`Aggiungi ${ing.nome}`}
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
        </div>
        <div className="border-t px-5 py-4" style={{ borderColor: p.surfaceBorder }}>
          <button
            onClick={() =>
              onConfirm(chosen, composed, taglia ? { id: taglia.id, nome: taglia.nome } : undefined)
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
