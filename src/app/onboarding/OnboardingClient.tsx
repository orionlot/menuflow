"use client";

/* eslint-disable @next/next/no-img-element -- single static menu preview; next/image is overkill here */
import { useState } from "react";
import Link from "next/link";
import { Fraunces, Manrope } from "next/font/google";
import { PLANS, MULTILINGUA_ADDON, formatEUR, type PlanId } from "@/lib/config/plans";
import { registraLocale } from "./actions";

const display = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

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
    if (!slug) return setError("Scegli l’indirizzo del tuo menu.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Email non valida.");
    if (password.length < 8) return setError("La password deve avere almeno 8 caratteri.");
    setSubmitting(true);
    try {
      const res = await registraLocale({ nome, slug, email, password, piano, multilingua });
      if (res.ok) {
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
          return;
        }
        setDone({ slug: res.slug });
      } else setError(res.error);
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  const root = `mf-ob ${display.variable} ${body.variable}`;

  if (done) {
    const menuUrl = `${origin}/${done.slug}`;
    const guidaUrl = `/onboarding/guida?slug=${encodeURIComponent(done.slug)}&nome=${encodeURIComponent(nome)}`;
    return (
      <main className={root}>
        <style>{CSS}</style>
        <section className="band band-dark done-wrap">
          <div className="done">
            <div className="done-mk">✓</div>
            <h1 className="ff h1-sm">Locale attivato!</h1>
            <p className="lead on-dark-muted">Il menu di <b className="on-dark">{nome}</b> è pronto. Ecco i tuoi accessi:</p>
            <div className="done-box">
              <div><span className="dim">Menu pubblico</span><br /><a href={menuUrl} className="link-em" target="_blank" rel="noreferrer">{menuUrl}</a></div>
              <div style={{ marginTop: 12 }}><span className="dim">Accesso dashboard</span><br /><b>{email}</b></div>
            </div>
            <div className="hero-cta center-cta">
              <Link href="/dashboard" className="btn btn-gold">Vai alla dashboard</Link>
              <a href={guidaUrl} target="_blank" rel="noreferrer" className="btn btn-ghost-l">📄 Scarica la guida (PDF)</a>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={root}>
      <style>{CSS}</style>

      <header className="topbar">
        <div className="wrap topbar-in">
          <span className="brand"><span className="brand-mk">🍽️</span> MenuFlow</span>
          <Link href="/dashboard/login" className="link-light">Accedi</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <p className="eyebrow on-dark">Attiva il tuo locale</p>
            <h1 className="ff h1">Il tuo menu digitale,<br />pronto in <em>5 minuti</em>.</h1>
            <p className="lead">
              I clienti inquadrano il QR al tavolo, vedono il menu e ordinano. Tu gestisci tutto da
              una dashboard semplice. Nessuna app da scaricare, nessun sito da costruire.
            </p>
            <div className="hero-cta">
              <a href="#attiva" className="btn btn-gold">Attiva il mio locale</a>
              <a href={`${origin}/pizzeria-mario`} target="_blank" rel="noreferrer" className="btn btn-ghost-l">👀 Vedi un menu d’esempio</a>
            </div>
            <p className="microtrust">Attivazione di prova · nessuna carta richiesta</p>
          </div>
          <div className="hero-art">
            <div className="phone"><img src="/pitch/02-menu-top.png" alt="Esempio di menu digitale" width={430} height={932} /></div>
          </div>
        </div>
      </section>

      {/* Value points */}
      <section className="band">
        <div className="wrap grid3">
          {[
            { t: "Ordini al tavolo", d: "Il cliente ordina dal telefono, tu ricevi tutto in tempo reale." },
            { t: "Menu sempre aggiornato", d: "Cambi prezzi, foto e disponibilità in un istante." },
            { t: "Il tuo stile", d: "Colori, logo e layout coordinati al tuo locale." },
          ].map((c) => (
            <div key={c.t} className="vcard">
              <h3 className="ff vt">{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="band band-alt">
        <div className="wrap">
          <h2 className="ff h2 center">Scegli il tuo piano</h2>
          <div className="plans">
            {Object.values(PLANS).map((p) => {
              const on = piano === p.id;
              return (
                <button key={p.id} type="button" onClick={() => setPiano(p.id)} aria-pressed={on} className={`plan ${on ? "on" : ""}`}>
                  {p.id === "plus" && <span className="plan-tag">Più scelto</span>}
                  <span className="pn">{p.label}{on && <span className="pchk"> ✓</span>}</span>
                  <span className="pp ff">{formatEUR(p.priceCents)}<small>/mese</small></span>
                  <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                </button>
              );
            })}
          </div>
          <label className="ml-toggle">
            <input type="checkbox" checked={multilingua} onChange={(e) => setMultilingua(e.target.checked)} />
            <span>Aggiungi <b>{MULTILINGUA_ADDON.label}</b> (menu in più lingue) · {formatEUR(MULTILINGUA_ADDON.priceCents)}/mese</span>
          </label>
        </div>
      </section>

      {/* Form */}
      <section id="attiva" className="band">
        <div className="wrap">
          <div className="formcard">
            <h2 className="ff h2">Crea il tuo locale</h2>
            <p className="formsub">Ci vogliono meno di due minuti.</p>
            <div className="fields">
              <label className="fld">
                <span>Nome del locale</span>
                <input value={nome} onChange={(e) => onNome(e.target.value)} placeholder="es. Trattoria da Luca" maxLength={80} />
              </label>
              <label className="fld">
                <span>Indirizzo del menu</span>
                <input value={slug} onChange={(e) => onSlug(e.target.value)} placeholder="trattoria-da-luca" />
                <em className="urlprev">{origin.replace(/^https?:\/\//, "")}/{slug || "il-tuo-locale"}</em>
              </label>
              <label className="fld">
                <span>Email (per accedere)</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.it" />
              </label>
              <label className="fld">
                <span>Password (min. 8 caratteri)</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              {error && <p className="err">{error}</p>}
              <button onClick={submit} disabled={submitting} className="btn btn-gold btn-block">
                {submitting ? "Attivazione…" : `Attiva il mio locale · ${formatEUR(totalCents)}/mese`}
              </button>
              <p className="microtrust center">
                Attivazione di prova: nessuna carta richiesta. Il pagamento online verrà aggiunto a breve.
              </p>
              <p className="loginline">Hai già un locale? <Link href="/dashboard/login" className="link-em">Accedi</Link></p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const CSS = `
.mf-ob{font-family:var(--font-body);color:var(--ink);background:var(--paper);
  --forest:#0e3a2c;--forest2:#0a2b21;--cream:#f7f2e9;--paper:#fffdf7;--emerald:#15885b;
  --emerald-d:#0f6e49;--gold:#cf8a3c;--gold-d:#b9772d;--ink:#1a2620;--muted:#5f6b62;--line:#e8dfce;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh;}
.mf-ob *{box-sizing:border-box;margin:0;}
.mf-ob img{max-width:100%;display:block;}
.mf-ob .ff{font-family:var(--font-display);}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px;}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--emerald);margin-bottom:12px;}
.eyebrow.on-dark{color:#7fd6ad;}
.h1{font-size:clamp(36px,7.5vw,62px);font-weight:600;line-height:1.03;letter-spacing:-.02em;}
.h1 em{font-style:italic;color:var(--gold);}
.h1-sm{font-size:clamp(28px,6vw,44px);font-weight:600;line-height:1.06;letter-spacing:-.02em;}
.h2{font-size:clamp(25px,4.6vw,38px);font-weight:600;line-height:1.1;letter-spacing:-.015em;}
.center{text-align:center;}
.lead{font-size:clamp(16px,2.3vw,19px);line-height:1.55;color:var(--muted);max-width:52ch;}
.hero .lead{color:#cfe2d7;}
.on-dark{color:#fff;} .on-dark-muted{color:#bcd6c9;}
.dim{font-size:13px;color:var(--muted);}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:13px 24px;font-size:15px;font-weight:700;text-decoration:none;border:none;cursor:pointer;transition:transform .15s,background .15s;}
.btn:active{transform:scale(.98);}
.btn-gold{background:var(--gold);color:#241403;box-shadow:0 8px 22px rgba(207,138,60,.3);}
.btn-gold:hover{background:var(--gold-d);}
.btn-gold:disabled{opacity:.6;cursor:default;}
.btn-ghost-l{border:1.5px solid rgba(255,255,255,.45);color:#f3ece0;background:transparent;}
.btn-ghost-l:hover{background:rgba(255,255,255,.08);}
.btn-block{width:100%;padding:15px;font-size:16px;}

.topbar{background:var(--forest);}
.topbar-in{display:flex;align-items:center;justify-content:space-between;height:58px;}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;color:#fff;}
.brand-mk{width:32px;height:32px;border-radius:9px;background:var(--emerald);display:flex;align-items:center;justify-content:center;font-size:17px;}
.link-light{color:#cfe2d7;font-weight:600;font-size:14px;text-decoration:none;}
.link-light:hover{color:#fff;}
.link-em{color:var(--emerald-d);font-weight:700;text-decoration:underline;}

.hero{background:radial-gradient(120% 120% at 82% 0%,#11503b 0%,var(--forest) 46%,var(--forest2) 100%);color:#f4efe4;padding:48px 0 56px;}
.hero-in{display:grid;grid-template-columns:1fr;gap:34px;align-items:center;}
.hero-copy{max-width:600px;}
.hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;}
.center-cta{justify-content:center;}
.microtrust{margin-top:16px;font-size:13px;color:#9fc4b3;}
.microtrust.center{color:var(--muted);}
.hero-art{display:flex;justify-content:center;}
.phone{width:240px;border:9px solid #14201b;border-radius:30px;overflow:hidden;background:#14201b;box-shadow:0 18px 44px rgba(8,24,17,.4);}
.phone img{width:100%;height:auto;}

.band{padding:52px 0;}
.band-alt{background:var(--cream);}
.band-dark{background:var(--forest);color:#eaf3ee;}

.grid3{display:grid;grid-template-columns:1fr;gap:16px;}
.vcard{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:22px;}
.vt{font-size:19px;font-weight:600;margin-bottom:6px;}
.vcard p{color:var(--muted);font-size:15.5px;line-height:1.5;}

.plans{display:grid;grid-template-columns:1fr;gap:16px;margin-top:26px;}
.plan{position:relative;background:var(--paper);border:2px solid var(--line);border-radius:18px;padding:24px;text-align:left;cursor:pointer;transition:border-color .15s,box-shadow .15s;font:inherit;}
.plan.on{border-color:var(--emerald);box-shadow:0 14px 34px rgba(21,136,91,.14);}
.plan-tag{position:absolute;top:-12px;left:24px;background:var(--emerald);color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:5px 13px;}
.pn{display:block;font-size:19px;font-weight:700;}
.pchk{color:var(--emerald-d);font-size:14px;}
.pp{display:block;font-size:34px;font-weight:600;color:var(--emerald-d);margin:6px 0 10px;}
.pp small{font-size:15px;color:var(--muted);font-weight:600;}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:7px;}
.plan li{font-size:15px;color:var(--muted);padding-left:18px;position:relative;}
.plan li::before{content:"·";position:absolute;left:4px;color:var(--emerald);font-weight:800;}
.ml-toggle{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:18px;font-size:15px;color:var(--ink);}
.ml-toggle input{width:18px;height:18px;accent-color:var(--emerald);}

.formcard{max-width:520px;margin:0 auto;background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:30px;box-shadow:0 16px 44px rgba(10,30,22,.07);}
.formsub{color:var(--muted);font-size:15px;margin-top:4px;}
.fields{display:flex;flex-direction:column;gap:15px;margin-top:20px;}
.fld{display:flex;flex-direction:column;gap:6px;}
.fld>span{font-size:13px;font-weight:600;color:var(--muted);}
.fld input{width:100%;border:1px solid var(--line);border-radius:11px;padding:12px 14px;font-size:15px;background:#fff;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s;}
.fld input:focus{border-color:var(--emerald);box-shadow:0 0 0 3px rgba(21,136,91,.16);}
.urlprev{font-size:12.5px;color:var(--muted);word-break:break-all;font-style:normal;}
.err{color:#b42318;font-size:14px;font-weight:600;}
.loginline{text-align:center;font-size:14px;color:var(--muted);}

.done-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;}
.done{max-width:560px;text-align:center;padding:0 22px;}
.done-mk{width:64px;height:64px;border-radius:50%;background:var(--emerald);color:#fff;font-size:34px;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;}
.done .lead{margin:10px auto 0;}
.done-box{margin:22px auto 0;max-width:420px;text-align:left;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:18px;font-size:14px;color:#eaf3ee;word-break:break-all;}
.done .link-em{color:#7fd6ad;}
.done-box b{color:#fff;}

@media(min-width:840px){
  .hero{padding:72px 0 80px;}
  .hero-in{grid-template-columns:1.1fr .9fr;gap:40px;}
  .grid3{grid-template-columns:repeat(3,1fr);}
  .plans{grid-template-columns:repeat(3,1fr);}
}
`;
