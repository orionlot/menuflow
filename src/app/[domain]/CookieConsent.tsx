"use client";

import { useEffect, useMemo, useState } from "react";
import type { Palette } from "@/lib/brand";
import {
  CONSENT_CATEGORIES,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  NON_NECESSARY,
  defaultConsent,
  grantAll,
  parseConsent,
  serializeConsent,
  type Consent,
  type ConsentCategory,
  type CookieDef,
} from "@/lib/cookies";

type Prefs = Pick<Consent, "funzionali" | "statistiche" | "marketing">;

function readConsentCookie(): Consent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(m?.slice(CONSENT_COOKIE.length + 1));
}

function writeConsentCookie(c: Consent) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(c)}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  // Consent Mode signal: a no-op unless a tag (gtag) is present, plus an event
  // any future client-side tracker can subscribe to.
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === "function") {
    w.gtag("consent", "update", {
      functionality_storage: c.funzionali ? "granted" : "denied",
      personalization_storage: c.funzionali ? "granted" : "denied",
      analytics_storage: c.statistiche ? "granted" : "denied",
      ad_storage: c.marketing ? "granted" : "denied",
      ad_user_data: c.marketing ? "granted" : "denied",
      ad_personalization: c.marketing ? "granted" : "denied",
    });
  }
  window.dispatchEvent(new CustomEvent("mf-consent-change", { detail: c }));
}

/** Half-eaten cookie, tinted with the tenant brand colour. */
function BiscuitIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <mask id="mf-biscuit-bite">
          <rect width="48" height="48" fill="black" />
          <circle cx="23" cy="25" r="20" fill="white" />
          {/* the bite taken out of the top-right */}
          <circle cx="42" cy="9" r="12" fill="black" />
        </mask>
      </defs>
      <g mask="url(#mf-biscuit-bite)">
        <circle cx="23" cy="25" r="20" fill={color} />
      </g>
      {/* chocolate chips */}
      <g fill="rgba(0,0,0,0.42)">
        <circle cx="17" cy="20" r="2.4" />
        <circle cx="28" cy="31" r="2.7" />
        <circle cx="15" cy="31" r="1.9" />
        <circle cx="29" cy="18" r="1.7" />
        <circle cx="22" cy="26" r="1.5" />
      </g>
    </svg>
  );
}

function Switch({
  on,
  disabled,
  onChange,
  p,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  p: Palette;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60"
      style={{ background: on ? p.brand : p.surfaceBorder, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
        style={{ left: on ? 22 : 2 }}
      />
    </button>
  );
}

export default function CookieConsent({ p, cookies }: { p: Palette; cookies: CookieDef[] }) {
  const [mounted, setMounted] = useState(false);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [view, setView] = useState<"hidden" | "banner" | "settings">("hidden");
  const [prefs, setPrefs] = useState<Prefs>(defaultConsent());

  useEffect(() => {
    setMounted(true);
    const existing = readConsentCookie();
    setConsent(existing);
    if (existing) setPrefs(existing);
    setView(existing ? "hidden" : "banner");
  }, []);

  // Categories that actually have a cookie for this tenant (necessari always has
  // at least the consent cookie itself).
  const categories = useMemo(
    () => CONSENT_CATEGORIES.filter((cat) => cookies.some((c) => c.category === cat.id)),
    [cookies],
  );

  if (!mounted || view === "hidden") {
    // Once a choice exists, only the floating biscuit remains.
    if (mounted && consent) {
      return (
        <button
          type="button"
          onClick={() => {
            setPrefs(consent);
            setView("settings");
          }}
          aria-label="Impostazioni cookie"
          className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition active:scale-90"
          style={{ background: p.surface, border: `1px solid ${p.surfaceBorder}` }}
        >
          <BiscuitIcon color={p.brand} />
        </button>
      );
    }
    return null;
  }

  const save = (c: Consent) => {
    writeConsentCookie(c);
    setConsent(c);
    setView("hidden");
  };
  const cookiesIn = (cat: ConsentCategory) => cookies.filter((c) => c.category === cat);

  return (
    <>
      {view === "banner" && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
          <div
            className="mx-auto w-full max-w-[480px] rounded-2xl p-4 shadow-2xl"
            style={{ background: p.surface, border: `1px solid ${p.surfaceBorder}`, color: p.text }}
            role="dialog"
            aria-label="Informativa cookie"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">
                <BiscuitIcon color={p.brand} size={30} />
              </span>
              <p className="text-sm leading-snug" style={{ color: p.textMuted }}>
                Usiamo i cookie per far funzionare il menu e, con il tuo consenso, per ricordare le
                tue preferenze. Puoi scegliere quali accettare.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => save(defaultConsent())}
                className="rounded-full px-4 py-2 text-sm font-semibold transition"
                style={{ border: `1px solid ${p.surfaceBorder}`, color: p.text }}
              >
                Rifiuta
              </button>
              <button
                type="button"
                onClick={() => setView("settings")}
                className="rounded-full px-4 py-2 text-sm font-semibold transition"
                style={{ border: `1px solid ${p.surfaceBorder}`, color: p.text }}
              >
                Personalizza
              </button>
              <button
                type="button"
                onClick={() => save(grantAll())}
                className="rounded-full px-5 py-2 text-sm font-bold transition active:scale-95"
                style={{ background: p.brand, color: p.onBrand }}
              >
                Accetta tutti
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "settings" && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => consent && setView("hidden")}
        >
          <div
            className="max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            style={{ background: p.surface, color: p.text }}
            role="dialog"
            aria-modal="true"
            aria-label="Impostazioni cookie"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sticky top-0 flex items-center gap-2 px-5 py-4"
              style={{ background: p.surface, borderBottom: `1px solid ${p.surfaceBorder}` }}
            >
              <BiscuitIcon color={p.brand} size={24} />
              <h2 className="font-display text-lg font-bold">Impostazioni cookie</h2>
              {consent && (
                <button
                  type="button"
                  onClick={() => setView("hidden")}
                  aria-label="Chiudi"
                  className="ml-auto text-2xl leading-none"
                  style={{ color: p.textMuted }}
                >
                  ×
                </button>
              )}
            </div>

            <div className="space-y-3 px-5 py-4">
              {categories.map((cat) => {
                const locked = Boolean(cat.sempre);
                const on = locked || prefs[cat.id as keyof Prefs];
                return (
                  <div
                    key={cat.id}
                    className="rounded-2xl p-3"
                    style={{ border: `1px solid ${p.surfaceBorder}` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {cat.nome}
                          {locked && (
                            <span className="ml-2 text-[11px] font-medium" style={{ color: p.textMuted }}>
                              Sempre attivi
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs leading-snug" style={{ color: p.textMuted }}>
                          {cat.descrizione}
                        </p>
                      </div>
                      <Switch
                        p={p}
                        on={Boolean(on)}
                        disabled={locked}
                        label={`Consenti ${cat.nome}`}
                        onChange={(v) =>
                          NON_NECESSARY.includes(cat.id) &&
                          setPrefs((prev) => ({ ...prev, [cat.id]: v }))
                        }
                      />
                    </div>
                    <ul className="mt-2 space-y-1.5 border-t pt-2 text-[11px]" style={{ borderColor: p.surfaceBorder }}>
                      {cookiesIn(cat.id).map((c) => (
                        <li key={c.name} style={{ color: p.textMuted }}>
                          <span className="font-mono font-semibold" style={{ color: p.text }}>
                            {c.name}
                          </span>{" "}
                          · {c.provider} · {c.durata}
                          <br />
                          {c.scopo}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div
              className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 px-5 py-4"
              style={{ background: p.surface, borderTop: `1px solid ${p.surfaceBorder}` }}
            >
              <button
                type="button"
                onClick={() => save(defaultConsent())}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ border: `1px solid ${p.surfaceBorder}`, color: p.text }}
              >
                Rifiuta tutto
              </button>
              <button
                type="button"
                onClick={() => save({ v: defaultConsent().v, ...prefs })}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{ border: `1px solid ${p.brand}`, color: p.brand }}
              >
                Salva preferenze
              </button>
              <button
                type="button"
                onClick={() => save(grantAll())}
                className="rounded-full px-5 py-2 text-sm font-bold active:scale-95"
                style={{ background: p.brand, color: p.onBrand }}
              >
                Accetta tutti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
