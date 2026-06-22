/* eslint-disable @next/next/no-img-element -- static marketing screenshots; next/image is overkill here */
import Link from "next/link";
import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { tenantSubdomainUrl } from "@/lib/urls";
import { appOrigin } from "@/lib/origin";
import { PLANS, formatEUR, MULTILINGUA_ADDON } from "@/lib/config/plans";
import Reveal from "./presentazione/Reveal";

const display = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });

export const dynamic = "force-dynamic";

async function getTenants() {
  if (!isSupabaseConfigured()) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("restaurants")
      .select("slug, nome, piano, pagamenti_attivi, attivo")
      .order("created_at", { ascending: true });
    return data ?? [];
  } catch {
    return null;
  }
}

function Phone({ src, alt, w = 250 }: { src: string; alt: string; w?: number }) {
  return (
    <div className="phone" style={{ width: w }}>
      <img src={src} alt={alt} width={430} height={932} loading="lazy" />
    </div>
  );
}
function Browser({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="browser">
      <div className="bbar"><i /><i /><i /></div>
      <img src={src} alt={alt} width={1440} height={900} loading="lazy" />
    </div>
  );
}
function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <p className={`eyebrow ${dark ? "on-dark" : ""}`}>{children}</p>;
}

const IMG = "/pitch";

export default async function Home() {
  const isDev = process.env.NODE_ENV === "development";
  const tenants = isDev ? await getTenants() : null;
  const origin = await appOrigin();

  return (
    <main className={`mf-home ${display.variable} ${body.variable}`}>
      <style>{CSS}</style>

      {/* Top bar */}
      <header className="topbar">
        <div className="wrap topbar-in">
          <span className="brand"><span className="brand-mk">🍽️</span> MenuFlow</span>
          <nav className="topnav">
            <a href="/presentazione" target="_blank" rel="noopener" className="link-light hide-sm">Presentazione</a>
            <a href="#prezzi" className="link-light hide-sm">Prezzi</a>
            <Link href="/dashboard/login" className="link-light">Accedi</Link>
            <Link href="/onboarding" className="btn btn-sm btn-gold">Attiva il locale</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <Reveal><Eyebrow dark>Menu digitale · Ordini · Gestione</Eyebrow></Reveal>
            <Reveal delay={80}><h1 className="ff h1">Il tuo locale,<br />al tavolo digitale.</h1></Reveal>
            <Reveal delay={160}>
              <p className="lead">
                Menu via QR, ordini al tavolo, asporto e delivery, cucina digitale e prenotazioni —
                in un’unica piattaforma. Il cliente ordina dal telefono, tu gestisci tutto da un pannello.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="hero-cta">
                <Link href="/onboarding" className="btn btn-gold">Attiva il tuo locale</Link>
                <a href="/presentazione" target="_blank" rel="noopener" className="btn btn-ghost-l">▶ Guarda la presentazione</a>
              </div>
            </Reveal>
            <Reveal delay={320}><p className="microtrust">Pronto in 5 minuti · nessuna app da scaricare · nessuna carta richiesta</p></Reveal>
          </div>
          <Reveal delay={200} className="hero-art"><Phone src={`${IMG}/02-menu-top.png`} alt="Menu digitale del locale" w={264} /></Reveal>
        </div>
      </section>

      {/* Value */}
      <section className="band">
        <div className="wrap">
          <Reveal><h2 className="ff h2 center">Tutto ciò che serve, in un’unica app.</h2></Reveal>
          <div className="grid4">
            {[
              { t: "Ordini al tavolo", d: "Il cliente ordina dal telefono; tu ricevi in tempo reale, anche su Telegram." },
              { t: "Cucina digitale", d: "Comande per reparto, timer e priorità sul Kitchen Display. Niente carta." },
              { t: "Prenotazioni & sala", d: "Richieste di prenotazione e planimetria della sala, sempre sotto controllo." },
              { t: "Conti & statistiche", d: "Conto al tavolo, incassi e analisi in tempo reale, con export." },
            ].map((c, i) => (
              <Reveal key={c.t} className="vcard" delay={i * 80}>
                <h3 className="ff vt">{c.t}</h3>
                <p>{c.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section className="band band-alt">
        <div className="wrap showcase">
          <Reveal className="sc-art"><Phone src={`${IMG}/02-menu-top.png`} alt="Menu lato cliente" w={232} /></Reveal>
          <Reveal delay={100} className="sc-copy">
            <Eyebrow>Bello per il cliente, potente per te</Eyebrow>
            <h2 className="ff h2">Un menu che fa venire fame — e fa ordinare.</h2>
            <p className="lead-sm">
              Foto, allergeni e calorie, prodotti componibili e vetrina dei piatti del giorno. Dietro
              le quinte: cucina, ordini, conti e prenotazioni, tutti coordinati.
            </p>
            <a href="/presentazione" target="_blank" rel="noopener" className="link-em">Scopri tutto nella presentazione →</a>
          </Reveal>
        </div>
        <div className="wrap" style={{ marginTop: "34px" }}>
          <Reveal><Browser src={`${IMG}/11-cucina-kds.png`} alt="Kitchen Display della cucina" /></Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="prezzi" className="band">
        <div className="wrap">
          <Reveal><h2 className="ff h2 center">Prezzi semplici, senza vincoli.</h2></Reveal>
          <div className="plans">
            {Object.values(PLANS).map((p, i) => (
              <Reveal key={p.id} className={`plan ${p.id === "plus" ? "on" : ""}`} delay={i * 80}>
                {p.id === "plus" && <span className="plan-tag">Più scelto</span>}
                <span className="pn">{p.label}</span>
                <span className="pp ff">{formatEUR(p.priceCents)}<small>/mese</small></span>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <Link href="/onboarding" className={`btn ${p.id === "plus" ? "btn-gold" : "btn-outline"} btn-block`}>Scegli {p.label}</Link>
              </Reveal>
            ))}
          </div>
          <Reveal><p className="microtrust center">Add-on <b>{MULTILINGUA_ADDON.label}</b> {formatEUR(MULTILINGUA_ADDON.priceCents)}/mese · attivi e disattivi le funzioni quando vuoi.</p></Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="band band-dark cta">
        <div className="wrap cta-in">
          <Reveal>
            <h2 className="ff h1-sm">Porta il tuo locale al tavolo digitale.</h2>
            <p className="lead on-dark-muted">Attivazione in pochi minuti, nessuna carta richiesta.</p>
            <div className="hero-cta center-cta">
              <Link href="/onboarding" className="btn btn-gold">Attiva il tuo locale</Link>
              <a href="/presentazione" target="_blank" rel="noopener" className="btn btn-ghost-l">Guarda la presentazione</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="foot">
        <div className="wrap foot-in">
          <span className="brand foot-brand"><span className="brand-mk">🍽️</span> MenuFlow</span>
          <div className="foot-links">
            <Link href="/dashboard/login" className="link-mut">Accedi</Link>
            <Link href="/onboarding" className="link-mut">Attiva il locale</Link>
            <a href="/presentazione" target="_blank" rel="noopener" className="link-mut">Presentazione</a>
            <Link href="/admin" className="link-mut">Admin</Link>
          </div>
        </div>
      </footer>

      {/* Dev-only tenant list (never shown in production) */}
      {isDev && (
        <section className="devbox">
          <div className="wrap">
            <p className="dev-h">Ambiente di sviluppo · locali</p>
            {tenants === null ? (
              <p className="dev-warn">Backend non raggiungibile. Avvia Supabase con <code>npm run db:start</code>.</p>
            ) : tenants.length === 0 ? (
              <p className="dev-mut">Nessun locale. Crea il primo da /admin.</p>
            ) : (
              <ul className="dev-list">
                {tenants.map((t) => (
                  <li key={t.slug}>
                    <a href={tenantSubdomainUrl(origin, t.slug)} className="link-em">{t.nome}</a>
                    <span className="dev-mut"> · /{t.slug} · {t.piano}{t.pagamenti_attivi ? " · pag. ON" : ""}{!t.attivo ? " · SOSPESO" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const CSS = `
.mf-home{font-family:var(--font-body);color:var(--ink);background:var(--paper);
  --forest:#0e3a2c;--forest2:#0a2b21;--cream:#f7f2e9;--paper:#fffdf7;--emerald:#15885b;
  --emerald-d:#0f6e49;--gold:#cf8a3c;--gold-d:#b9772d;--ink:#1a2620;--muted:#5f6b62;--line:#e8dfce;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;}
.mf-home *{box-sizing:border-box;margin:0;}
.mf-home img{max-width:100%;display:block;}
.mf-home .ff{font-family:var(--font-display);}
.wrap{max-width:1100px;margin:0 auto;padding:0 22px;}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--emerald);margin-bottom:12px;}
.eyebrow.on-dark{color:#7fd6ad;}
.h1{font-size:clamp(38px,7.6vw,64px);font-weight:600;line-height:1.03;letter-spacing:-.02em;}
.h1-sm{font-size:clamp(28px,5.5vw,48px);font-weight:600;line-height:1.06;letter-spacing:-.02em;}
.h2{font-size:clamp(26px,4.6vw,40px);font-weight:600;line-height:1.1;letter-spacing:-.015em;}
.center{text-align:center;}
.lead{font-size:clamp(16px,2.3vw,19px);line-height:1.55;color:var(--muted);max-width:54ch;}
.lead-sm{font-size:17px;line-height:1.55;color:var(--muted);margin-top:8px;}
.hero .lead{color:#cfe2d7;}
.on-dark{color:#fff;} .on-dark-muted{color:#bcd6c9;}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:13px 24px;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap;cursor:pointer;transition:transform .15s,background .15s;}
.btn:active{transform:scale(.98);}
.btn-sm{padding:9px 18px;font-size:14px;}
.btn-gold{background:var(--gold);color:#241403;box-shadow:0 8px 22px rgba(207,138,60,.3);}
.btn-gold:hover{background:var(--gold-d);}
.btn-ghost-l{border:1.5px solid rgba(255,255,255,.45);color:#f3ece0;}
.btn-ghost-l:hover{background:rgba(255,255,255,.08);}
.btn-outline{border:1.5px solid var(--emerald);color:var(--emerald-d);background:transparent;}
.btn-outline:hover{background:rgba(21,136,91,.07);}
.btn-block{width:100%;margin-top:14px;}

.topbar{position:sticky;top:0;z-index:50;background:rgba(14,58,44,.94);backdrop-filter:blur(8px);}
.topbar-in{display:flex;align-items:center;justify-content:space-between;height:60px;}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px;color:#fff;}
.brand-mk{width:34px;height:34px;border-radius:9px;background:var(--emerald);display:flex;align-items:center;justify-content:center;font-size:18px;}
.topnav{display:flex;align-items:center;gap:18px;}
.link-light{color:#cfe2d7;font-weight:600;font-size:14px;text-decoration:none;}
.link-light:hover{color:#fff;}
.link-em{color:var(--emerald-d);font-weight:700;text-decoration:none;}
.link-em:hover{text-decoration:underline;}

.hero{background:radial-gradient(120% 120% at 82% 0%,#11503b 0%,var(--forest) 46%,var(--forest2) 100%);color:#f4efe4;padding:54px 0 64px;}
.hero-in{display:grid;grid-template-columns:1fr;gap:34px;align-items:center;}
.hero-copy{max-width:600px;}
.hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;}
.center-cta{justify-content:center;}
.microtrust{margin-top:16px;font-size:13px;color:#9fc4b3;}
.microtrust.center{color:var(--muted);margin-top:22px;}
.hero-art{display:flex;justify-content:center;}
.phone{width:240px;border:9px solid #14201b;border-radius:30px;overflow:hidden;background:#14201b;box-shadow:0 18px 44px rgba(8,24,17,.4);}
.phone img{width:100%;height:auto;}

.band{padding:58px 0;}
.band-alt{background:var(--cream);}
.band-dark{background:var(--forest);color:#eaf3ee;}

.grid4{display:grid;grid-template-columns:1fr;gap:16px;margin-top:30px;}
.vcard{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:22px;}
.vt{font-size:19px;font-weight:600;margin-bottom:6px;}
.vcard p{color:var(--muted);font-size:15.5px;line-height:1.5;}

.showcase{display:grid;grid-template-columns:1fr;gap:30px;align-items:center;}
.sc-art{display:flex;justify-content:center;}
.sc-copy{max-width:540px;}
.browser{width:100%;border-radius:13px;overflow:hidden;border:1px solid var(--line);background:#fff;box-shadow:0 18px 46px rgba(10,30,22,.14);}
.bbar{height:30px;background:#ece6da;display:flex;align-items:center;gap:6px;padding:0 12px;}
.bbar i{width:10px;height:10px;border-radius:50%;background:#cfc7b8;}
.browser img{width:100%;height:auto;object-fit:cover;object-position:top center;max-height:380px;}

.plans{display:grid;grid-template-columns:1fr;gap:18px;margin-top:30px;}
.plan{position:relative;background:var(--paper);border:2px solid var(--line);border-radius:18px;padding:26px;text-align:center;}
.plan.on{border-color:var(--emerald);box-shadow:0 16px 40px rgba(21,136,91,.14);}
.plan-tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--emerald);color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:5px 14px;}
.pn{display:block;font-size:19px;font-weight:700;}
.pp{display:block;font-size:40px;font-weight:600;color:var(--emerald-d);margin:6px 0 10px;}
.pp small{font-size:15px;color:var(--muted);font-weight:600;}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:8px;font-size:15px;color:var(--muted);text-align:left;}
.plan li{padding-left:18px;position:relative;}
.plan li::before{content:"·";position:absolute;left:4px;color:var(--emerald);font-weight:800;}

.cta{text-align:center;}
.cta-in{max-width:680px;margin:0 auto;}

.foot{background:var(--forest2);color:#bcd6c9;padding:26px 0;}
.foot-in{display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center;}
.foot-brand{font-size:16px;}
.foot-links{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;}
.link-mut{color:#9fc4b3;font-size:14px;font-weight:600;text-decoration:none;}
.link-mut:hover{color:#fff;}

.devbox{background:#11181c;color:#9aa7a0;padding:20px 0;font-size:13px;}
.dev-h{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#5f7068;margin-bottom:8px;}
.dev-warn{color:#e6b566;} .dev-mut{color:#6f7d75;}
.dev-list{list-style:none;display:flex;flex-direction:column;gap:5px;}
.devbox .link-em{color:#7fd6ad;}
.devbox code{background:#1d2a25;padding:1px 6px;border-radius:5px;}

.reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
.reveal.in{opacity:1;transform:none;}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none;}}

@media(min-width:560px){.grid4{grid-template-columns:1fr 1fr;}}
@media(min-width:880px){
  .hero{padding:84px 0 90px;}
  .hero-in{grid-template-columns:1.1fr .9fr;gap:40px;}
  .grid4{grid-template-columns:repeat(4,1fr);}
  .showcase{grid-template-columns:.85fr 1.15fr;gap:48px;}
  .plans{grid-template-columns:repeat(3,1fr);}
  .foot-in{flex-direction:row;justify-content:space-between;text-align:left;}
}
@media(max-width:560px){.hide-sm{display:none;}}
`;
