/* eslint-disable @next/next/no-img-element -- static marketing screenshots; next/image is overkill here */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Fraunces, Manrope } from "next/font/google";
import Reveal from "./Reveal";

const display = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "MenuFlow — Il menu digitale che fa ordinare e gestisce il tuo locale",
  description:
    "Menu digitale via QR, ordini al tavolo/asporto/delivery, cucina digitale, prenotazioni, conti e statistiche. Tutto in un’unica app per il tuo ristorante.",
};

const IMG = "/pitch";

/* ---- small building blocks (server components) ---- */
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
      <div className="bbar">
        <i /><i /><i />
      </div>
      <img src={src} alt={alt} width={1440} height={900} loading="lazy" />
    </div>
  );
}
function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

export default function PresentazionePage() {
  return (
    <main className={`mf-pres ${display.variable} ${body.variable}`}>
      <style>{CSS}</style>
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="wrap topbar-in">
          <a href="#top" className="brand"><span className="brand-mk">🍽️</span> MenuFlow</a>
          <a href="#contatti" className="btn btn-sm btn-gold">Richiedi la demo</a>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="top" className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <Reveal><Eyebrow>Menu digitale · Ordini · Gestione</Eyebrow></Reveal>
            <Reveal delay={80}>
              <h1 className="ff h1">Il menu che<br />vende, ordina<br />e gestisce.<br /><em>Per te.</em></h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="lead">
                Il cliente inquadra un QR e ordina dal tavolo. Tu ricevi tutto in cucina, gestisci
                i conti e vedi gli incassi in tempo reale. Una sola app, zero carta, nessun errore.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="hero-cta">
                <a href="#contatti" className="btn btn-gold">Richiedi la demo</a>
                <a href="#come-ordina" className="btn btn-ghost-l">Guarda come funziona ↓</a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="hero-chips">
                <span>Al tavolo · Asporto · Delivery</span>
                <span>Pagamento online</span>
                <span>Cucina digitale</span>
                <span>Prenotazioni</span>
              </div>
            </Reveal>
          </div>
          <Reveal delay={200} className="hero-art">
            <Phone src={`${IMG}/02-menu-top.png`} alt="Menu digitale del locale" w={266} />
          </Reveal>
        </div>
      </section>

      {/* ── Come ordina il cliente ── */}
      <section id="come-ordina" className="band">
        <div className="wrap">
          <Reveal><Eyebrow>L’esperienza del cliente</Eyebrow>
            <h2 className="ff h2">Ordinare è questione di tre tocchi.</h2></Reveal>
          <div className="steps">
            <Reveal className="step" delay={0}>
              <span className="step-n">1</span>
              <Phone src={`${IMG}/02-menu-top.png`} alt="Scansione QR e menu" w={210} />
              <h3 className="ff h3">Inquadra & sfoglia</h3>
              <p>Un QR sul tavolo apre il menu: foto reali, descrizioni, allergeni e calorie. Nessuna app da scaricare.</p>
            </Reveal>
            <Reveal className="step" delay={120}>
              <span className="step-n">2</span>
              <Phone src={`${IMG}/07-poke-builder.png`} alt="Prodotto componibile" w={210} />
              <h3 className="ff h3">Componi a piacere</h3>
              <p>Poke, bowl e piatti su misura con regole min/max. Ogni scelta aggiorna peso e calorie in automatico.</p>
            </Reveal>
            <Reveal className="step" delay={240}>
              <span className="step-n">3</span>
              <Phone src={`${IMG}/08-checkout.png`} alt="Invio ordine" w={210} />
              <h3 className="ff h3">Ordina & paga</h3>
              <p>Sceglie tavolo, asporto o delivery, segnala le allergie e — se vuoi — paga subito online. Tu ricevi l’ordine all’istante.</p>
            </Reveal>
          </div>
          <Reveal delay={120} className="trackrow">
            <Phone src={`${IMG}/20-tracking.png`} alt="Segui il tuo ordine in tempo reale" w={208} />
            <div className="trackrow-copy">
              <h3 className="ff h3">…e poi segue l’ordine in tempo reale.</h3>
              <p>Appena invia, il cliente vede l’avanzamento dal telefono — Ricevuto → In preparazione → Pronto → Servito. Meno «è pronto?» al personale, più serenità in sala.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Modalità ritiro + pagamento ── */}
      <section className="band band-alt">
        <div className="wrap split">
          <Reveal className="split-art">
            <Phone src={`${IMG}/19-checkout-pay.png`} alt="Modalità di ordine e pagamento, mancia e pagamento online" w={250} />
          </Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Ritiro & pagamento</Eyebrow>
            <h2 className="ff h2">Ogni modalità, un solo flusso.</h2>
            <ul className="ticks">
              <li><b>Al tavolo</b> — il cliente indica il numero del tavolo, l’ordine arriva in cucina.</li>
              <li><b>Asporto</b> — ordine col nome per il ritiro, pronto quando arriva.</li>
              <li><b>Delivery</b> — indirizzo e posizione sulla mappa, niente telefonate.</li>
              <li><b>Pagamento online o alla cassa</b> — incassi subito con carta (Stripe) oppure paga al banco. Coperto e mancia inclusi.</li>
            </ul>
            <p className="note">Il totale è sempre ricalcolato dal server sui prezzi reali: niente errori, niente trucchi.</p>
          </Reveal>
        </div>
      </section>

      {/* ── Calorie & peso ── */}
      <section className="band">
        <div className="wrap split reverse">
          <Reveal className="split-art">
            <Phone src={`${IMG}/07-poke-builder.png`} alt="Calorie e peso per ingrediente" w={250} />
          </Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Trasparenza nutrizionale</Eyebrow>
            <h2 className="ff h2">Calorie e peso, calcolati da soli.</h2>
            <p className="lead-sm">
              Imposti le calorie per 100 g di ogni ingrediente una volta sola: l’app somma in automatico
              peso e calorie di ogni piatto, anche per i prodotti componibili.
            </p>
            <ul className="ticks">
              <li>Valori «~stima» mostrati con chiarezza, ingrediente per ingrediente.</li>
              <li>Il peso della bowl in evidenza — una vera leva di vendita.</li>
              <li>Attivabile o disattivabile per ogni piatto.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Cucina digitale (KDS) — dark spotlight ── */}
      <section className="band band-dark">
        <div className="wrap">
          <Reveal><Eyebrow className="on-dark">La cucina</Eyebrow>
            <h2 className="ff h2">La cucina che non sbaglia un ordine.</h2>
            <p className="lead on-dark-muted">Comande digitali in tempo reale, divise per reparto, con timer e priorità. Addio comande di carta.</p></Reveal>
          <Reveal delay={120}><Browser src={`${IMG}/11-cucina-kds.png`} alt="Kitchen Display System" /></Reveal>
          <div className="trio on-dark-muted">
            <Reveal delay={0}><p><b className="on-dark">Per reparto</b><br />Cucina, Bar, Pokeria, Rosticceria: ognuno vede solo i suoi piatti.</p></Reveal>
            <Reveal delay={100}><p><b className="on-dark">Timer & ritardi</b><br />Ogni piatto col suo tempo; alert automatico se va oltre.</p></Reveal>
            <Reveal delay={200}><p><b className="on-dark">Stati chiari</b><br />Da preparare → in preparazione → pronto → servito.</p></Reveal>
          </div>
        </div>
      </section>

      {/* ── Workflow del locale ── */}
      <section className="band band-alt">
        <div className="wrap split">
          <Reveal className="split-art"><Browser src={`${IMG}/10-ordini.png`} alt="Gestione ordini" /></Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Il flusso di lavoro</Eyebrow>
            <h2 className="ff h2">Dall’ordine al conto, senza intoppi.</h2>
            <ol className="flow">
              <li><span>1</span> Il cliente invia l’ordine → arriva su <b>Ordini</b> e in <b>Cucina</b>.</li>
              <li><span>2</span> La cucina avanza gli stati; il cliente può seguire l’avanzamento.</li>
              <li><span>3</span> Al servizio incassi al tavolo o online; <b>coperto</b> e <b>mancia</b> calcolati.</li>
              <li><span>4</span> A fine pasto <b>chiudi il conto</b> con un tocco.</li>
            </ol>
            <p className="note">Notifiche istantanee su <b>Telegram</b> a ogni nuovo ordine e prenotazione.</p>
          </Reveal>
        </div>
      </section>

      {/* ── Conto al tavolo & chiusura ── */}
      <section className="band">
        <div className="wrap split reverse">
          <Reveal className="split-art"><Browser src={`${IMG}/15-conti.png`} alt="Conti aperti per tavolo" /></Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Conti & cassa</Eyebrow>
            <h2 className="ff h2">Il conto del tavolo, sempre giusto.</h2>
            <p className="lead-sm">
              Tutti gli ordini di un tavolo si sommano in un unico conto, aggiornato in tempo reale.
              Quando il tavolo va via, chiudi il conto e archivi tutto.
            </p>
            <ul className="ticks">
              <li>Totale per tavolo aggiornato a ogni ordine.</li>
              <li>Coperto, mance e modalità di servizio inclusi nel calcolo.</li>
              <li>Stampa del riepilogo conto in un clic.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Sala ── */}
      <section className="band band-alt">
        <div className="wrap split">
          <Reveal className="split-art"><Browser src={`${IMG}/18-sala.png`} alt="Disposizione della sala" /></Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Sala</Eyebrow>
            <h2 className="ff h2">Disegna la tua sala come la vivi.</h2>
            <p className="lead-sm">
              Crei la planimetria con i tuoi tavoli e le tue sale. Il cliente può indicare in quale
              sala si trova e in cucina compare accanto al numero del tavolo.
            </p>
            <ul className="ticks">
              <li>Più sale (interno, dehors, privé…) con i loro tavoli.</li>
              <li>Capienza e stima dei tempi di servizio.</li>
              <li>Attivabile quando ti serve.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Prenotazioni ── */}
      <section className="band">
        <div className="wrap split reverse">
          <Reveal className="split-art"><Phone src={`${IMG}/04-reservation.png`} alt="Prenotazione tavolo" w={250} /></Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Prenotazioni</Eyebrow>
            <h2 className="ff h2">Riempi i tavoli, senza telefonate.</h2>
            <p className="lead-sm">
              Il cliente richiede un tavolo dal menu (nome, telefono, data, ora, persone). Tu
              confermi o rifiuti dal pannello e ricevi una notifica.
            </p>
            <ul className="ticks">
              <li>Richieste raggruppate per giorno, con stato.</li>
              <li>Conferma / rifiuta / annulla con un tocco.</li>
              <li>Meno chiamate perse, più coperti.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Dashboard & statistiche ── */}
      <section className="band band-alt">
        <div className="wrap">
          <Reveal><Eyebrow>Tutto sotto controllo</Eyebrow>
            <h2 className="ff h2">Incassi e statistiche, in tempo reale.</h2></Reveal>
          <div className="duo">
            <Reveal delay={0}><Browser src={`${IMG}/09-dashboard.png`} alt="Dashboard del locale" /></Reveal>
            <Reveal delay={120}><Browser src={`${IMG}/13-statistiche.png`} alt="Statistiche" /></Reveal>
          </div>
          <Reveal delay={120}><p className="lead center">Incasso del giorno, ordini, conti aperti, stato del servizio e alert sui ritardi — più analisi su piatti, orari e tempi di cucina, con esportazione CSV.</p></Reveal>
        </div>
      </section>

      {/* ── Gestione menu ── */}
      <section className="band">
        <div className="wrap split">
          <Reveal className="split-art"><Browser src={`${IMG}/12-menu-manager.png`} alt="Gestione del menu" /></Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Autonomia totale</Eyebrow>
            <h2 className="ff h2">Il menu lo gestisci tu, in un clic.</h2>
            <p className="lead-sm">
              Aggiungi piatti, foto, prezzi, varianti, allergeni e calorie da solo. Riordini
              categorie e prodotti; «esaurito» aggiornato all’istante per il cliente.
            </p>
            <ul className="ticks">
              <li>Nessun tecnico, nessuna attesa.</li>
              <li>Import/export dell’intero menu.</li>
              <li>QR del menu pronto da stampare.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Trasparenza fiscale ── */}
      <section className="band band-dark">
        <div className="wrap callout-wrap">
          <Reveal className="callout">
            <span className="callout-badge">Trasparenza</span>
            <h2 className="ff h2">Lo scontrino fiscale resta al tuo registratore.</h2>
            <p className="lead on-dark-muted">
              MenuFlow <b className="on-dark">non emette documenti fiscali</b>: lo scontrino lo batti
              tu con il tuo registratore telematico, come sempre. L’app ti segnala in modo chiaro gli
              ordini per cui «battere scontrino», così non dimentichi nulla.
            </p>
            <p className="on-dark-muted soft">
              È una scelta di correttezza. La <b className="on-dark">stampa fiscale automatica</b> (integrazione
              con registratori telematici certificati) è già nella roadmap come funzione futura.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── GDPR / trust ── */}
      <section className="band band-alt">
        <div className="wrap split">
          <Reveal className="split-art phones2">
            <Phone src={`${IMG}/01-menu-cookie-banner.png`} alt="Banner cookie" w={186} />
            <Phone src={`${IMG}/06-privacy-policy.png`} alt="Privacy policy" w={186} />
          </Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>A norma di legge</Eyebrow>
            <h2 className="ff h2">Conforme, e si vede.</h2>
            <ul className="ticks">
              <li><b>Banner cookie</b> con consenso granulare (accetta / rifiuta / personalizza).</li>
              <li>Pagine <b>Cookie & Privacy Policy</b> generate per il tuo locale, con i tuoi dati.</li>
              <li>Dati al sicuro, accessi separati per ogni ristoratore.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Scala / multi-locale ── */}
      <section className="band">
        <div className="wrap split reverse">
          <Reveal className="split-art"><Browser src={`${IMG}/17-admin.png`} alt="Più locali, una piattaforma" /></Reveal>
          <Reveal delay={100} className="split-copy">
            <Eyebrow>Cresci senza limiti</Eyebrow>
            <h2 className="ff h2">Un locale oggi, una catena domani.</h2>
            <p className="lead-sm">
              Ogni locale ha il suo indirizzo personalizzato e il suo brand (logo, colori, tema).
              Apri un secondo punto? Si aggiunge in un attimo, stessa app.
            </p>
            <ul className="ticks">
              <li>Sottodominio o dominio personalizzato.</li>
              <li>Tema chiaro/scuro e colori del tuo brand.</li>
              <li>Multilingua disponibile come add-on.</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Prezzi ── */}
      <section id="prezzi" className="band band-alt">
        <div className="wrap">
          <Reveal><Eyebrow>Piani</Eyebrow><h2 className="ff h2">Scegli quanto far crescere il locale.</h2></Reveal>
          <div className="plans">
            <Reveal className="plan" delay={0}>
              <p className="pn">Base</p><p className="pp ff">29€<small>/mese</small></p>
              <ul><li>Menu digitale + ordini</li><li>Cucina & dashboard</li><li>Notifiche Telegram</li></ul>
            </Reveal>
            <Reveal className="plan hot" delay={100}>
              <span className="plan-tag">Più scelto</span>
              <p className="pn">Plus</p><p className="pp ff">39€<small>/mese</small></p>
              <ul><li>Tutto di Base +</li><li>Sala & funzioni avanzate</li><li>Pagamenti online</li></ul>
            </Reveal>
            <Reveal className="plan" delay={200}>
              <p className="pn">Pro</p><p className="pp ff">59€<small>/mese</small></p>
              <ul><li>Tutto di Plus +</li><li>Statistiche complete</li><li>Tutte le funzioni</li></ul>
            </Reveal>
          </div>
          <Reveal delay={120}><p className="note center">Add-on <b>Multilingua +10€/mese</b>. Nessun vincolo, attivi e disattivi le funzioni quando vuoi.</p></Reveal>
        </div>
      </section>

      {/* ── CTA finale ── */}
      <section id="contatti" className="band band-dark cta">
        <div className="wrap cta-in">
          <Reveal>
            <h2 className="ff h1-sm">Porta il tuo locale al tavolo digitale.</h2>
            <p className="lead on-dark-muted">Ti mostriamo MenuFlow sul tuo menu, dal vivo. Senza impegno.</p>
            <div className="hero-cta center-cta">
              <a href="mailto:info@menuflow.it?subject=Demo%20MenuFlow" className="btn btn-gold">Richiedi la demo</a>
              <Link href="/" className="btn btn-ghost-l">Vai alla piattaforma</Link>
            </div>
            <p className="brand brand-foot"><span className="brand-mk">🍽️</span> MenuFlow</p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}

const CSS = `
.mf-pres{font-family:var(--font-body);color:var(--ink);background:var(--paper);
  --forest:#0e3a2c;--forest2:#0a2b21;--cream:#f7f2e9;--paper:#fffdf7;--emerald:#15885b;
  --emerald-d:#0f6e49;--gold:#cf8a3c;--gold-d:#b9772d;--ink:#1a2620;--muted:#5f6b62;--line:#e8dfce;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;}
.mf-pres *{box-sizing:border-box;margin:0;}
.mf-pres img{max-width:100%;display:block;}
.mf-pres .ff{font-family:var(--font-display);}
.wrap{max-width:1120px;margin:0 auto;padding:0 22px;}
.eyebrow{font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--emerald);margin-bottom:12px;}
.eyebrow.on-dark{color:#7fd6ad;}
.h1{font-size:clamp(40px,8.5vw,72px);font-weight:600;line-height:1.02;letter-spacing:-.02em;}
.h1 em{font-style:italic;color:var(--gold);}
.h1-sm{font-size:clamp(30px,6vw,52px);font-weight:600;line-height:1.05;letter-spacing:-.02em;}
.h2{font-size:clamp(27px,5vw,42px);font-weight:600;line-height:1.08;letter-spacing:-.015em;margin-bottom:6px;}
.h3{font-size:21px;font-weight:600;margin:14px 0 6px;}
.lead{font-size:clamp(16px,2.4vw,20px);line-height:1.55;color:var(--muted);max-width:54ch;}
.lead-sm{font-size:17px;line-height:1.55;color:var(--muted);margin:8px 0 4px;}
.note{font-size:14px;color:var(--muted);margin-top:14px;}
.center{margin-left:auto;margin-right:auto;text-align:center;}
.soft{opacity:.9;font-size:15px;margin-top:12px;}

/* buttons */
.btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:13px 24px;font-size:15px;font-weight:700;text-decoration:none;transition:transform .15s,background .15s,box-shadow .15s;}
.btn:active{transform:scale(.97);}
.btn-sm{padding:9px 18px;font-size:14px;}
.btn-gold{background:var(--gold);color:#241403;box-shadow:0 8px 22px rgba(207,138,60,.32);}
.btn-gold:hover{background:var(--gold-d);}
.btn-ghost-l{border:1.5px solid rgba(255,255,255,.45);color:#f3ece0;}
.btn-ghost-l:hover{background:rgba(255,255,255,.08);}

/* topbar */
.topbar{position:sticky;top:0;z-index:50;background:rgba(14,58,44,.92);backdrop-filter:blur(8px);}
.topbar-in{display:flex;align-items:center;justify-content:space-between;height:60px;}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px;color:#fff;text-decoration:none;letter-spacing:-.01em;}
.brand-mk{width:34px;height:34px;border-radius:9px;background:var(--emerald);display:flex;align-items:center;justify-content:center;font-size:18px;}

/* hero */
.hero{background:radial-gradient(120% 120% at 80% 0%,#11503b 0%,var(--forest) 45%,var(--forest2) 100%);color:#f4efe4;padding:54px 0 64px;}
.hero-in{display:grid;grid-template-columns:1fr;gap:34px;align-items:center;}
.hero-copy{max-width:600px;}
.hero .lead{color:#cfe2d7;}
.hero-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px;}
.center-cta{justify-content:center;}
.hero-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px;}
.hero-chips span{font-size:13px;font-weight:600;color:#cfe2d7;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:7px 14px;}
.hero-art{display:flex;justify-content:center;}

/* bands */
.band{padding:64px 0;}
.band-alt{background:var(--cream);}
.band-dark{background:var(--forest);color:#eaf3ee;}
.on-dark{color:#fff;}
.on-dark-muted{color:#bcd6c9;}
.band-dark .lead{color:#bcd6c9;}

/* steps */
.steps{display:grid;grid-template-columns:1fr;gap:30px;margin-top:34px;}
.step{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:26px 22px;position:relative;text-align:center;}
.step .phone{margin:6px auto 0;}
.step p{color:var(--muted);font-size:15.5px;line-height:1.5;}
.step-n{position:absolute;top:-14px;left:22px;width:34px;height:34px;border-radius:50%;background:var(--emerald);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(21,136,91,.3);}

/* split */
.split{display:grid;grid-template-columns:1fr;gap:34px;align-items:center;}
.split-art{display:flex;justify-content:center;}
.split-copy{max-width:560px;}
.ticks{list-style:none;display:flex;flex-direction:column;gap:13px;margin-top:18px;}
.ticks li{position:relative;padding-left:32px;font-size:16.5px;line-height:1.45;color:var(--ink);}
.band-dark .ticks li{color:#eaf3ee;}
.ticks li::before{content:"✓";position:absolute;left:0;top:0;width:22px;height:22px;border-radius:50%;background:var(--emerald);color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;}
.ticks li b{font-weight:700;}

/* flow list */
.flow{list-style:none;display:flex;flex-direction:column;gap:12px;margin-top:18px;}
.flow li{display:flex;gap:12px;align-items:flex-start;font-size:16.5px;line-height:1.45;}
.flow li span{flex:none;width:26px;height:26px;border-radius:50%;background:var(--gold);color:#241403;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:1px;}

/* device frames */
.phone{border:9px solid #14201b;border-radius:30px;overflow:hidden;background:#14201b;box-shadow:0 18px 44px rgba(10,30,22,.26);}
.phone img{width:100%;height:auto;}
.phones2{gap:14px;}
.browser{width:100%;border-radius:13px;overflow:hidden;border:1px solid var(--line);background:#fff;box-shadow:0 18px 46px rgba(10,30,22,.16);}
.band-dark .browser{border-color:rgba(255,255,255,.12);}
.bbar{height:30px;background:#ece6da;display:flex;align-items:center;gap:6px;padding:0 12px;}
.bbar i{width:10px;height:10px;border-radius:50%;background:#cfc7b8;}
.browser img{width:100%;height:auto;}

/* trio / duo */
.trio{display:grid;grid-template-columns:1fr;gap:20px;margin-top:30px;font-size:16px;line-height:1.5;}
.trio b{font-weight:700;}
.duo{display:grid;grid-template-columns:1fr;gap:22px;margin-top:30px;}

/* order-tracking strip */
.trackrow{display:flex;flex-direction:column;align-items:center;text-align:center;gap:22px;margin-top:42px;}
.trackrow-copy{max-width:46ch;}
.trackrow-copy p{color:var(--muted);font-size:16.5px;line-height:1.5;margin-top:6px;}

/* callout */
.callout-wrap{display:flex;justify-content:center;}
.callout{max-width:760px;text-align:center;border:1px solid rgba(255,255,255,.14);border-radius:22px;padding:40px 30px;background:rgba(255,255,255,.04);}
.callout .lead{margin:14px auto 0;}
.callout-badge{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#241403;background:var(--gold);border-radius:999px;padding:6px 14px;margin-bottom:14px;}

/* plans */
.plans{display:grid;grid-template-columns:1fr;gap:18px;margin-top:32px;}
.plan{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:28px 24px;text-align:center;position:relative;}
.plan.hot{border:2px solid var(--emerald);box-shadow:0 16px 40px rgba(21,136,91,.14);}
.plan-tag{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--emerald);color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:5px 14px;}
.plan .pn{font-size:19px;font-weight:700;}
.plan .pp{font-size:42px;font-weight:600;color:var(--emerald-d);margin:6px 0;}
.plan .pp small{font-size:15px;color:var(--muted);font-weight:600;}
.plan ul{list-style:none;display:flex;flex-direction:column;gap:8px;font-size:15px;color:var(--muted);}

/* cta */
.cta{text-align:center;}
.cta-in{max-width:760px;margin:0 auto;}
.brand-foot{justify-content:center;color:#fff;margin-top:34px;}

/* reveal */
.reveal{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .65s cubic-bezier(.2,.7,.2,1);}
.reveal.in{opacity:1;transform:none;}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none;}}

/* desktop */
@media(min-width:860px){
  .hero{padding:84px 0 90px;}
  .hero-in{grid-template-columns:1.1fr .9fr;gap:40px;}
  .steps{grid-template-columns:repeat(3,1fr);}
  .split{grid-template-columns:1fr 1fr;gap:54px;}
  .split.reverse .split-art{order:2;}
  .trio{grid-template-columns:repeat(3,1fr);}
  .duo{grid-template-columns:1fr 1fr;}
  .plans{grid-template-columns:repeat(3,1fr);}
  .phones2{gap:18px;}
  .trackrow{flex-direction:row;text-align:left;gap:44px;justify-content:center;align-items:center;}
}
`;
