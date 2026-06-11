"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import type { ItemOption, MenuItem, PublicRestaurant } from "@/types/db";
import { formatEUR } from "@/lib/config/plans";
import { brandPalette } from "@/lib/brand";
import { resolveLayout, FONT_VARS } from "@/lib/config/layout";
import { isOpenNow, orariLabel } from "@/lib/orari";
import { effectiveOptions } from "@/lib/menu";
import { ALLERGENI, ALLERGENI_BY_ID } from "@/lib/config/allergeni";

const MAINTENANCE_MSG =
  "App momentaneamente in manutenzione — Si prega di rivolgersi allo staff per l'ordinazione";

type Backend = "checking" | "ok" | "down";
type Chosen = { gruppo: string; scelta: string; prezzo: number };
interface CartLine {
  key: string;
  item_id: string;
  nome: string;
  qta: number;
  unitCents: number;
  opzioni: Chosen[];
}

function lineKey(itemId: string, chosen: Chosen[]): string {
  if (!chosen.length) return itemId;
  return (
    itemId +
    "|" +
    chosen.map((c) => `${c.gruppo}:${c.scelta}`).sort().join(",")
  );
}

export default function MenuClient({
  tenant,
  items,
}: {
  tenant: PublicRestaurant;
  items: MenuItem[];
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

  const [lang, setLang] = useState<string>(tenant.lingue?.[0] ?? "it");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [tavolo, setTavolo] = useState("");
  const [note, setNote] = useState("");
  const [coperti, setCoperti] = useState(0);
  const [allOpen, setAllOpen] = useState(false);
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

  const shown = items.filter((i) => i.categoria === (activeCat || categories[0]));
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

  // Allergens present in the active category (for the legend accordion).
  const allergeniInCategory = Array.from(
    new Set(shown.flatMap((i) => i.allergeni ?? [])),
  );

  const qtyForItem = (id: string) =>
    lines.filter((l) => l.item_id === id).reduce((s, l) => s + l.qta, 0);

  function addLine(item: MenuItem, chosen: Chosen[]) {
    const unitCents =
      Math.round(item.prezzo * 100) +
      chosen.reduce((s, c) => s + Math.round(c.prezzo * 100), 0);
    const key = lineKey(item.id, chosen);
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
            },
      };
    });
  }
  function tapAdd(item: MenuItem) {
    if (effectiveOptions(item, tenant.aggiunte).length) setOptItem(item);
    else addLine(item, []);
  }
  const setQty = (key: string, q: number) =>
    setCart((c) => ({ ...c, [key]: { ...c[key], qta: Math.max(0, Math.min(99, q)) } }));

  async function submit() {
    if (!tavolo.trim()) {
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
          tavolo,
          note,
          coperti: cMode === "persona" ? coperti : undefined,
          mancia: tipEligible ? manciaCents / 100 : undefined,
          items: lines.map((l) => ({
            item_id: l.item_id,
            qta: l.qta,
            opzioni: l.opzioni.map((o) => ({ gruppo: o.gruppo, scelta: o.scelta })),
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

  const initial = tenant.nome.trim().charAt(0).toUpperCase();
  const tavoloMissing = !tavolo.trim();
  const closed = Boolean(tenant.funzioni_attive?.orari) && !isOpenNow(tenant.orari);
  const ordersBlocked = backend === "down" || closed;

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
              ? "px-5 pb-4 pt-6"
              : dark
                ? "px-5 pb-6 pt-7"
                : "rounded-b-[30px] px-5 pb-6 pt-8"
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
                  width={56}
                  height={56}
                  className={`h-14 w-14 shrink-0 object-cover ${dark ? "rounded-xl" : "rounded-full"}`}
                  style={dark ? { border: `2px solid ${p.brand}` } : undefined}
                />
              ) : (
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center font-display text-2xl font-bold ${dark ? "rounded-xl" : "rounded-full"}`}
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
                  style={{ fontSize: dark ? "1.6rem" : "1.7rem", fontWeight: dark ? 500 : 700 }}
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
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
              {categories.map((c) => {
                const on = c === (activeCat || categories[0]);
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
                <button
                  onClick={() => setAllergyOpen(true)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: myAllergens.length ? "#fee2e2" : p.tint,
                    color: myAllergens.length ? "#b91c1c" : p.textMuted,
                    border: `1px solid ${myAllergens.length ? "#fca5a5" : p.surfaceBorder}`,
                  }}
                >
                  {myAllergens.length
                    ? `⚠ Le mie allergie (${myAllergens.length})`
                    : "Imposta le mie allergie"}
                </button>
              </div>
            )}

            {allergeniInCategory.length > 0 && (
              <div className="px-5 pb-2">
                <button
                  onClick={() => setAllOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ background: p.tint, color: p.textMuted }}
                  aria-expanded={allOpen}
                >
                  <span>
                    ⓘ Allergeni in &ldquo;{activeCat || categories[0]}&rdquo; (
                    {allergeniInCategory.length})
                  </span>
                  <span>{allOpen ? "▲" : "▼"}</span>
                </button>
                {allOpen && (
                  <ul
                    className="mf-fade mt-1.5 space-y-1 rounded-lg px-3 py-2 text-sm"
                    style={{ background: p.surface, border: `1px solid ${p.surfaceBorder}` }}
                  >
                    {allergeniInCategory.map((id) => (
                      <li key={id} style={{ color: p.text }}>
                        <b style={{ color: p.brand }}>
                          {ALLERGENI_BY_ID.get(id)?.short ?? id}
                        </b>
                        {" — "}
                        {ALLERGENI_BY_ID.get(id)?.label ?? id}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
          <ul className={compact ? "space-y-2" : "space-y-3"}>
            {shown.map((item, idx) => {
              const sold = !item.disponibile || (scorteOn && item.scorta === 0);
              const qty = qtyForItem(item.id);
              const hasOpts = effectiveOptions(item, tenant.aggiunte).length > 0;
              const myHits =
                allergyOn && myAllergens.length
                  ? (item.allergeni ?? []).filter((a) => myAllergens.includes(a))
                  : [];
              const showPhoto =
                !layout.foto_categorie_nascoste.includes(item.categoria) &&
                (!dark || !!item.foto_url);
              const photoRadius = Math.max(radius - 4, 2);
              const photo = showPhoto ? (
                item.foto_url ? (
                  <Image
                    src={item.foto_url}
                    alt={t(item.nome, item.nome_i18n)}
                    width={photoTop ? 480 : 64}
                    height={photoTop ? 200 : 64}
                    className={
                      photoTop ? "h-32 w-full object-cover" : "h-16 w-16 shrink-0 object-cover"
                    }
                    style={{ borderRadius: photoRadius }}
                  />
                ) : (
                  <div
                    className={
                      photoTop
                        ? "flex h-28 w-full items-center justify-center font-display text-3xl"
                        : "flex h-16 w-16 shrink-0 items-center justify-center font-display text-xl"
                    }
                    style={{ background: p.tint, color: p.brand, borderRadius: photoRadius }}
                  >
                    {item.nome.charAt(0)}
                  </div>
                )
              ) : null;
              return (
                <li
                  key={item.id}
                  className="mf-up"
                  style={{
                    animationDelay: `${Math.min(idx * 45, 300)}ms`,
                    opacity: sold ? 0.5 : 1,
                    ...(dark
                      ? {
                          borderBottom: `1px solid ${p.surfaceBorder}`,
                          paddingBottom: compact ? "12px" : "16px",
                        }
                      : {
                          background: p.surface,
                          border: `1px solid ${p.surfaceBorder}`,
                          borderRadius: radius,
                          padding: compact ? "9px" : "12px",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        }),
                  }}
                >
                  {photoTop && photo}
                  <div className={`flex items-start gap-3${photoTop && photo ? " mt-3" : ""}`}>
                    {!photoTop && photo}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-[1.05rem] font-semibold leading-tight">
                          {t(item.nome, item.nome_i18n)}
                        </h3>
                        {sold && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: p.surfaceBorder, color: p.textMuted }}
                          >
                            Esaurito
                          </span>
                        )}
                        {tenant.funzioni_attive?.piatto_consigliato && item.consigliato && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: p.accent, color: p.onAccent }}
                          >
                            ★ Consigliato
                          </span>
                        )}
                        {scorteOn &&
                          item.scorta != null &&
                          item.scorta > 0 &&
                          item.scorta <= 5 && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: "#fef3c7", color: "#92400e" }}
                            >
                              Ultime {item.scorta}
                            </span>
                          )}
                        {myHits.length > 0 && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: "#fee2e2", color: "#b91c1c" }}
                          >
                            ⚠ Allergeni
                          </span>
                        )}
                      </div>
                      {(item.descrizione || item.descrizione_i18n?.[lang]) && (
                        <p className="mt-0.5 text-sm leading-snug" style={{ color: p.textMuted }}>
                          {t(item.descrizione ?? "", item.descrizione_i18n)}
                        </p>
                      )}
                      {item.allergeni?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.allergeni.map((a) => (
                            <span
                              key={a}
                              title={ALLERGENI_BY_ID.get(a)?.label ?? a}
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ background: p.tint, color: p.textMuted }}
                            >
                              {ALLERGENI_BY_ID.get(a)?.short ?? a}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 font-display text-base font-semibold" style={{ color: p.price }}>
                        {formatEUR(Math.round(item.prezzo * 100))}
                        {hasOpts && (
                          <span className="ml-1 text-xs font-normal" style={{ color: p.textMuted }}>
                            + opzioni
                          </span>
                        )}
                      </div>
                    </div>

                    {!sold && !ordersBlocked && (
                      <div className="shrink-0 self-center">
                        {qty > 0 && !hasOpts ? (
                          <div
                            className="flex items-center gap-2 rounded-full px-1.5 py-1"
                            style={{ background: p.tint }}
                          >
                            <Round bg={p.accent} fg={p.onAccent} onClick={() => setQty(item.id, qty - 1)}>
                              −
                            </Round>
                            <span className="w-4 text-center text-sm font-bold">{qty}</span>
                            <Round bg={p.accent} fg={p.onAccent} onClick={() => addLine(item, [])}>
                              +
                            </Round>
                          </div>
                        ) : (
                          <div className="relative">
                            <Round bg={p.accent} fg={p.onAccent} onClick={() => tapAdd(item)}>
                              +
                            </Round>
                            {qty > 0 && (
                              <span
                                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                                style={{ background: p.text, color: p.pageBg }}
                              >
                                {qty}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && (
            <p className="py-10 text-center text-sm" style={{ color: p.textMuted }}>
              Nessuna voce in questa categoria.
            </p>
          )}
        </main>
      </div>

      {/* Vedi ordine bar */}
      {!ordersBlocked && count > 0 && !sheet && !done && !pending && !optItem && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
          <button
            onClick={() => setSheet(true)}
            className="mf-up pointer-events-auto flex w-full max-w-[480px] items-center justify-between rounded-2xl px-5 py-3.5 font-semibold shadow-2xl"
            style={{ background: p.accent, color: p.onAccent }}
          >
            <span className="uppercase tracking-wide">Vedi ordine</span>
            <span className="rounded-full px-3 py-1 text-sm" style={{ background: "rgba(0,0,0,0.16)" }}>
              {count} {count === 1 ? "piatto" : "piatti"} · {formatEUR(totalCents)}
            </span>
          </button>
        </div>
      )}

      {/* Options modal */}
      {optItem && (
        <OptionsModal
          item={optItem}
          groups={effectiveOptions(optItem, tenant.aggiunte)}
          p={p}
          onClose={() => setOptItem(null)}
          onConfirm={(chosen) => {
            addLine(optItem, chosen);
            setOptItem(null);
          }}
        />
      )}

      {/* Allergy profile sheet */}
      {allergyOpen && (
        <div
          className="mf-fade fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setAllergyOpen(false)}
        >
          <div
            className="mf-sheet flex max-h-[85vh] w-full max-w-[480px] flex-col rounded-t-3xl sm:rounded-3xl"
            style={{ background: p.surface, color: p.text }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between rounded-t-3xl px-5 py-4"
              style={{ background: p.headerBg, color: p.headerText }}
            >
              <h2 className="font-display text-lg font-bold">Le mie allergie</h2>
              <button
                onClick={() => setAllergyOpen(false)}
                className="text-2xl leading-none opacity-80"
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-sm" style={{ color: p.textMuted }}>
                Seleziona i tuoi allergeni: le voci che li contengono verranno segnalate con ⚠.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ALLERGENI.map((a) => {
                  const on = myAllergens.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() =>
                        setMyAllergens((s) =>
                          s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id],
                        )
                      }
                      className="rounded-full px-3 py-1.5 text-sm"
                      style={{
                        background: on ? "#fee2e2" : p.tint,
                        color: on ? "#b91c1c" : p.text,
                        border: `1px solid ${on ? "#fca5a5" : p.surfaceBorder}`,
                      }}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="border-t px-5 py-4" style={{ borderColor: p.surfaceBorder }}>
              <button
                onClick={() => setAllergyOpen(false)}
                className="w-full rounded-xl py-3 font-semibold"
                style={{ background: p.brand, color: p.onBrand }}
              >
                Fatto
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <span className="block truncate">{l.nome}</span>
                      {l.opzioni.length > 0 && (
                        <span className="text-xs" style={{ color: p.textMuted }}>
                          {l.opzioni.map((o) => o.scelta).join(", ")}
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
}: {
  children: React.ReactNode;
  bg: string;
  fg: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold leading-none"
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
  p,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  groups: ItemOption[];
  p: Pal;
  onClose: () => void;
  onConfirm: (chosen: Chosen[]) => void;
}) {
  // default: preselect first choice of required single groups
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups)
      init[g.id] = g.tipo === "single" && g.obbligatorio ? [g.scelte[0]?.nome] : [];
    return init;
  });

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
  const missing = groups.some((g) => g.obbligatorio && (sel[g.id]?.length ?? 0) === 0);
  const unitCents =
    Math.round(item.prezzo * 100) + chosen.reduce((s, c) => s + Math.round(c.prezzo * 100), 0);

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
        </div>
        <div className="border-t px-5 py-4" style={{ borderColor: p.surfaceBorder }}>
          <button
            onClick={() => onConfirm(chosen)}
            disabled={missing}
            className="w-full rounded-xl py-3.5 font-semibold disabled:opacity-50"
            style={{ background: p.brand, color: p.onBrand }}
          >
            {missing ? "Scegli le opzioni richieste" : `Aggiungi · ${formatEUR(unitCents)}`}
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
