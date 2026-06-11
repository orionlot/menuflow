"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS, MULTILINGUA_ADDON, formatEUR, type PlanId } from "@/lib/config/plans";
import { registraLocale } from "./actions";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const BRAND = "#c8453b";

export default function OnboardingClient({ origin }: { origin: string }) {
  const [piano, setPiano] = useState<PlanId>("plus");
  const [multilingua, setMultilingua] = useState(false);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string } | null>(null);

  const totalCents = PLANS[piano].priceCents + (multilingua ? MULTILINGUA_ADDON.priceCents : 0);

  function onNome(v: string) {
    setNome(v);
    if (!slugEdited) setSlug(slugify(v));
  }
  function onSlug(v: string) {
    setSlugEdited(true);
    setSlug(slugify(v));
  }

  async function submit() {
    setError(null);
    if (!nome.trim()) return setError("Inserisci il nome del locale.");
    if (!slug) return setError("Scegli l'indirizzo del tuo menu.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Email non valida.");
    if (password.length < 8) return setError("La password deve avere almeno 8 caratteri.");
    setSubmitting(true);
    try {
      const res = await registraLocale({ nome, slug, email, password, piano, multilingua });
      if (res.ok) setDone({ slug: res.slug });
      else setError(res.error);
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const menuUrl = `${origin}/${done.slug}`;
    const guidaUrl = `/onboarding/guida?slug=${encodeURIComponent(done.slug)}&nome=${encodeURIComponent(nome)}`;
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-3 text-2xl font-bold">Locale attivato!</h1>
        <p className="mt-2 text-neutral-600">
          Il menu di <b>{nome}</b> è pronto. Ecco i tuoi accessi:
        </p>
        <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left text-sm">
          <div className="break-all">
            <span className="text-neutral-500">Menu pubblico:</span>{" "}
            <a href={menuUrl} className="font-medium underline" target="_blank" rel="noreferrer">
              {menuUrl}
            </a>
          </div>
          <div className="mt-1">
            <span className="text-neutral-500">Accesso dashboard:</span>{" "}
            <span className="font-medium">{email}</span>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: BRAND }}
          >
            Vai alla dashboard
          </Link>
          <a
            href={guidaUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-50"
          >
            📄 Scarica la guida (PDF)
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Hero */}
      <section className="text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-bold text-white"
          style={{ background: BRAND }}
        >
          M
        </div>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          Il menu digitale del tuo locale, pronto in 5 minuti
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-neutral-600">
          I clienti inquadrano il QR al tavolo, vedono il menu e ordinano. Tu gestisci tutto da
          una dashboard semplice. Nessuna app da scaricare, nessun sito da costruire.
        </p>
        <a
          href={`${origin}/pizzeria-mario`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm font-semibold underline"
          style={{ color: BRAND }}
        >
          👀 Guarda un menu d’esempio
        </a>
      </section>

      {/* Punti di forza */}
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { t: "Ordini al tavolo", d: "Il cliente ordina dal telefono, tu ricevi tutto in tempo reale." },
          { t: "Menu sempre aggiornato", d: "Cambi prezzi, foto e disponibilità in un istante." },
          { t: "Il tuo stile", d: "Colori, logo e layout coordinati al tuo locale." },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="font-semibold">{c.t}</div>
            <div className="mt-1 text-sm text-neutral-600">{c.d}</div>
          </div>
        ))}
      </section>

      {/* Piani */}
      <section className="mt-10">
        <h2 className="text-center text-xl font-bold">Scegli il tuo piano</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.values(PLANS).map((p) => {
            const on = piano === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPiano(p.id)}
                className="rounded-xl border-2 bg-white p-4 text-left transition"
                style={{ borderColor: on ? BRAND : "#e5e5e5" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{p.label}</span>
                  {on && (
                    <span className="text-xs font-semibold" style={{ color: BRAND }}>
                      ✓ scelto
                    </span>
                  )}
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {formatEUR(p.priceCents)}
                  <span className="text-sm font-normal text-neutral-500"> /mese</span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-neutral-600">
                  {p.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center justify-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={multilingua}
            onChange={(e) => setMultilingua(e.target.checked)}
          />
          Aggiungi <b>{MULTILINGUA_ADDON.label}</b> (menu in più lingue) ·{" "}
          {formatEUR(MULTILINGUA_ADDON.priceCents)}/mese
        </label>
      </section>

      {/* Form */}
      <section className="mx-auto mt-10 max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Crea il tuo locale</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Nome del locale</label>
            <input
              value={nome}
              onChange={(e) => onNome(e.target.value)}
              placeholder="es. Trattoria da Luca"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">
              Indirizzo del menu
            </label>
            <input
              value={slug}
              onChange={(e) => onSlug(e.target.value)}
              placeholder="trattoria-da-luca"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 break-all text-xs text-neutral-400">
              {origin}/{slug || "il-tuo-locale"}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Email (per accedere)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.it"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">Password (min. 8 caratteri)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-lg py-3 text-center font-semibold text-white disabled:opacity-60"
            style={{ background: BRAND }}
          >
            {submitting
              ? "Attivazione…"
              : `Attiva il mio locale · ${formatEUR(totalCents)}/mese`}
          </button>
          <p className="text-center text-xs text-neutral-400">
            Attivazione di prova: nessuna carta richiesta. Il pagamento online verrà aggiunto a breve.
          </p>
        </div>
      </section>
    </main>
  );
}
