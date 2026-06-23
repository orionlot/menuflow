/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { appOrigin } from "@/lib/origin";
import { FEATURES } from "@/lib/config/features";
import { PLANS, type PlanId } from "@/lib/config/plans";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Guida operativa — MenuFlow" };
export const dynamic = "force-dynamic";

type Img = { src: string; alt: string; caption: string; phone?: boolean };
type Cap = {
  n: number;
  id: string;
  titolo: string;
  occhiello: string;
  intro: string[];
  passi?: string[];
  img?: Img[];
  tip?: string;
  table?: boolean;
};

const PLAN_ORDER: Record<PlanId, number> = { base: 0, plus: 1, pro: 2 };

const CHAPTERS: Cap[] = [
  {
    n: 2,
    id: "primo-accesso",
    titolo: "Primo accesso e dashboard",
    occhiello: "Per iniziare",
    intro: [
      "Tutto si gestisce dalla dashboard. Vai su /dashboard e accedi con l'email e la password scelte in fase di registrazione. Da qui controlli menu, ordini, cucina, incassi e impostazioni.",
      "A sinistra c'è il menu di navigazione: Dashboard (panoramica della giornata), Ordini, Prenotazioni, Conti, Cucina, Sala, Menu, Inventario, Clienti, Analytics, QR Menu e, in basso, Aspetto, Riconciliazione e Impostazioni. In fondo trovi l'interruttore Tema chiaro/scuro e il pulsante Esci.",
      "La schermata Dashboard mostra a colpo d'occhio i numeri di oggi — Incasso, Ordini, Conti aperti, Scontrini da battere — un grafico dell'andamento ordini, il riepilogo dell'Abbonamento e le azioni rapide.",
    ],
    passi: [
      "Apri /dashboard e inserisci email e password.",
      "Usa il menu di sinistra per spostarti tra le sezioni.",
      "In alto a destra trovi lo stato del servizio; in basso a sinistra il tema chiaro/scuro.",
    ],
    img: [
      { src: "/guida/g-01-login.png", alt: "Schermata di accesso", caption: "Accesso alla dashboard." },
      { src: "/guida/g-02-dashboard.png", alt: "Panoramica dashboard", caption: "La dashboard: numeri di oggi, andamento ordini e abbonamento." },
    ],
  },
  {
    n: 3,
    id: "aspetto",
    titolo: "Aspetto del menu",
    occhiello: "Configura il locale",
    intro: [
      "In «Aspetto» dai al tuo menu l'identità del locale. Parti da uno Stile pronto (Trattoria, Moderno, Elegante…) e poi rifinisci colori, logo, tema chiaro/scuro e tipografia.",
      "Ogni modifica è mostrata in un'anteprima dal vivo: vedi subito come apparirà ai clienti prima di salvare.",
    ],
    passi: [
      "Scegli uno Stile pronto come punto di partenza.",
      "Imposta il colore principale (e secondario) e carica il logo.",
      "Scegli tema chiaro o scuro e la tipografia.",
      "Controlla l'anteprima e salva.",
    ],
    img: [{ src: "/guida/g-03-aspetto.png", alt: "Pagina Aspetto", caption: "Stili pronti, colori, logo e anteprima dal vivo." }],
  },
  {
    n: 4,
    id: "menu",
    titolo: "Menu",
    occhiello: "Configura il locale",
    intro: [
      "Il cuore del prodotto. In «Menu» organizzi categorie e piatti: trovi già alcune voci d'esempio da rinominare o cancellare.",
      "Per ogni piatto puoi impostare: foto, descrizione, prezzo (e prezzo asporto separato), disponibilità, allergeni, varianti e opzioni (es. cottura, taglia), aggiunte, etichette (es. «Vegetariano», «Piccante») e — se attivi — peso e calorie.",
      "Trascina per riordinare categorie e piatti: l'ordine sul menu pubblico è quello che imposti qui. Puoi anche esportare e importare l'intero menu in un file, utile per copiarlo o farne un backup.",
    ],
    passi: [
      "Crea le categorie e aggiungi i piatti (o modifica quelli d'esempio).",
      "Carica le foto e scrivi le descrizioni.",
      "Imposta allergeni, varianti/opzioni e aggiunte dove servono.",
      "Trascina per riordinare; usa la disponibilità per esaurire un piatto al volo.",
      "Esporta/importa il menu dal pulsante dedicato per backup o copia.",
    ],
    img: [{ src: "/guida/g-04-menu.png", alt: "Gestione menu", caption: "Categorie, piatti, foto, prezzi, allergeni e riordino con trascinamento." }],
    tip: "Una buona foto e una descrizione breve aumentano sensibilmente gli ordini: cura soprattutto i piatti più redditizi.",
  },
  {
    n: 5,
    id: "inventario",
    titolo: "Inventario",
    occhiello: "Configura il locale",
    intro: [
      "In «Inventario» gestisci gli ingredienti: per ognuno puoi indicare scorta disponibile, unità di misura, peso e calorie.",
      "Con i prodotti componibili (es. una poke) il piatto si costruisce con gli ingredienti scelti dal cliente: peso e calorie totali si calcolano in automatico sommando gli ingredienti.",
      "Quando la scorta di un ingrediente finisce, tutti i piatti che lo usano vengono esauriti automaticamente sul menu — niente ordini che non puoi evadere.",
    ],
    passi: [
      "Inserisci gli ingredienti con scorta, unità, peso e kcal.",
      "Collega gli ingredienti ai piatti (o crea un prodotto componibile).",
      "Lascia che l'esaurimento automatico tolga dal menu ciò che è finito.",
    ],
    img: [
      { src: "/guida/g-05-inventario.png", alt: "Inventario ingredienti", caption: "Ingredienti con scorta, unità, peso e calorie." },
      { src: "/guida/g-05b-componibile.png", alt: "Prodotto componibile", caption: "Un piatto componibile: il cliente sceglie gli ingredienti, peso e kcal si sommano da soli.", phone: true },
    ],
  },
  {
    n: 6,
    id: "qr",
    titolo: "QR Menu",
    occhiello: "Configura il locale",
    intro: [
      "In «QR Menu» scarichi i codici QR da stampare e mettere sui tavoli. Puoi generare il QR generale del locale oppure un QR per singolo tavolo: il cliente inquadra e vede subito il menu, con il tavolo già compilato.",
    ],
    passi: [
      "Scarica il QR del locale oppure quello per singolo tavolo.",
      "Stampa e applica i QR sui tavoli (o sul menu cartaceo, sulla vetrina…).",
    ],
    img: [{ src: "/guida/g-06-qr.png", alt: "Generatore QR", caption: "QR del locale e per singolo tavolo, pronti da stampare." }],
  },
  {
    n: 7,
    id: "ordini",
    titolo: "Ordini",
    occhiello: "Servizio quotidiano",
    intro: [
      "In «Ordini» arriva tutto ciò che ordinano i clienti, in tempo reale, con avviso sonoro e badge. Vedi lo stato di ogni ordine (ricevuto, in preparazione, pronto, servito) e il dettaglio delle voci.",
      "Puoi creare anche un Ordine manuale dalla dashboard (cameriere/cassa) quando prendi l'ordine a voce, scegliendo il tavolo. Gestisci asporto e delivery, e stampi la comanda con un clic.",
    ],
    passi: [
      "Tieni la pagina aperta in cassa: i nuovi ordini suonano e si evidenziano.",
      "Crea un ordine manuale per i tavoli serviti dal cameriere.",
      "Stampa la comanda o lascia che si stampi in automatico (se attivo).",
    ],
    img: [
      { src: "/guida/g-07-ordini.png", alt: "Lista ordini", caption: "Ricezione ordini in tempo reale, con stati e dettaglio." },
      { src: "/guida/g-07b-ordine-manuale.png", alt: "Ordine manuale", caption: "Ordine manuale dalla cassa: scegli tavolo e piatti." },
    ],
  },
  {
    n: 8,
    id: "cucina",
    titolo: "Cucina — Kitchen Display (KDS)",
    occhiello: "Servizio quotidiano",
    intro: [
      "Il monitor della cucina. Ogni ordine si divide nei singoli piatti e ogni piatto va al suo reparto (Cucina, Rosticceria, Pokeria, Bar…). Il cuoco avvia la preparazione piatto per piatto.",
      "Due viste: «Per stato» (colonne Da preparare → In preparazione → Pronti → Serviti) e «Per tavolo» (tutti i piatti di un tavolo raggruppati). Filtri per reparto, priorità, tempi stimati e countdown, e gestione delle portate «a seguire» (tieni un piatto e lo mandi quando serve).",
      "In alto vedi il valore dei piatti in coda e il tempo stimato per smaltirla; gli allergeni del tavolo sono evidenziati in rosso per la sicurezza.",
    ],
    passi: [
      "Scegli la vista «Per stato» o «Per tavolo».",
      "Avvia i piatti uno per uno (o tutto il tavolo insieme).",
      "Usa «Tieni a seguire» / «Manda ora» per le portate.",
      "Attiva l'audio per sentire quando un piatto è pronto.",
    ],
    img: [
      { src: "/guida/g-08-kds.png", alt: "KDS per stato", caption: "Vista «Per stato»: colonne con reparti, allergeni e avvio piatto-per-piatto." },
      { src: "/guida/g-09-kds-tavolo.png", alt: "KDS per tavolo", caption: "Vista «Per tavolo»: tutti i piatti di un tavolo insieme." },
    ],
  },
  {
    n: 9,
    id: "sala",
    titolo: "Sala",
    occhiello: "Servizio quotidiano",
    intro: [
      "In «Sala» disegni la mappa del locale (Sala interna, Dehors…) posizionando i tavoli con forma e numero di posti. In servizio, tocchi un tavolo per avviare subito un ordine per quel tavolo.",
    ],
    passi: [
      "In «Modifica» aggiungi le sale e trascina i tavoli sulla mappa.",
      "Imposta posti e forma di ogni tavolo.",
      "In «Servizio» tocca un tavolo per aprire un ordine.",
    ],
    img: [{ src: "/guida/g-10-sala.png", alt: "Mappa sala", caption: "Mappa dei tavoli con posti e forma; tocca un tavolo per ordinare." }],
  },
  {
    n: 10,
    id: "conti",
    titolo: "Conti",
    occhiello: "Servizio quotidiano",
    intro: [
      "In «Conti» vedi i tavoli con un conto aperto e l'importo. A fine pasto «Estingui conto» chiude il conto del tavolo (resta nel fatturato e nelle statistiche, non è un annullamento).",
      "Puoi stampare il conto aggregato del tavolo da consegnare al cliente.",
    ],
    passi: [
      "Apri «Conti» per vedere i tavoli aperti e il totale.",
      "Stampa il conto aggregato se il cliente lo chiede.",
      "«Estingui conto» quando il tavolo ha pagato.",
    ],
    img: [{ src: "/guida/g-11-conti.png", alt: "Conti aperti", caption: "Conti aperti per tavolo, con estinzione e stampa del conto." }],
  },
  {
    n: 11,
    id: "prenotazioni",
    titolo: "Prenotazioni",
    occhiello: "Servizio quotidiano",
    intro: [
      "I clienti possono richiedere un tavolo dal menu pubblico. In «Prenotazioni» vedi le richieste con nome, telefono, data, ora, coperti ed eventuale sala, e le confermi o rifiuti.",
      "Puoi anche limitare le fasce orarie in cui accettare prenotazioni.",
    ],
    passi: [
      "Controlla le richieste in arrivo (in attesa / confermate).",
      "Conferma o rifiuta; il cliente ha lasciato un recapito.",
      "Imposta le fasce orarie disponibili dove serve.",
    ],
    img: [{ src: "/guida/g-12-prenotazioni.png", alt: "Prenotazioni", caption: "Richieste di prenotazione da gestire: conferma o rifiuto." }],
  },
  {
    n: 12,
    id: "clienti",
    titolo: "Clienti",
    occhiello: "Servizio quotidiano",
    intro: [
      "In «Clienti» trovi lo storico degli ordini per tavolo e per asporto: utile per ricostruire una serata, capire i tavoli più attivi e dare un servizio più attento.",
    ],
    img: [{ src: "/guida/g-13-clienti.png", alt: "Storico clienti", caption: "Storico ordini per tavolo e asporto." }],
  },
  {
    n: 13,
    id: "analytics",
    titolo: "Analytics",
    occhiello: "Analisi e incassi",
    intro: [
      "In «Analytics» analizzi l'andamento del locale: incassi, numero di ordini, piatti più venduti e i tempi della cucina (quanto resta un piatto in ogni stato).",
      "Puoi esportare i dati in CSV per il commercialista o per le tue analisi.",
    ],
    passi: [
      "Consulta incassi e ordini nel periodo che ti interessa.",
      "Guarda i tempi cucina per individuare i colli di bottiglia.",
      "Esporta in CSV quando ti serve.",
    ],
    img: [{ src: "/guida/g-14-statistiche.png", alt: "Analytics", caption: "Incassi, ordini, tempi cucina ed export CSV." }],
  },
  {
    n: 14,
    id: "pagamenti",
    titolo: "Pagamenti al tavolo e Abbonamento",
    occhiello: "Analisi e incassi",
    intro: [
      "Pagamenti al tavolo (Stripe Connect): se vuoi far pagare online i clienti, premi «Connetti con Stripe» e segui la procedura guidata (dati dell'attività e IBAN per i bonifici). Gli incassi al tavolo arrivano direttamente sul tuo conto. È una funzione dei piani Plus/Pro.",
      "Abbonamento: in dashboard vedi il tuo piano, il canone e lo stato. Da «Gestisci abbonamento» apri il portale per cambiare carta, cambiare piano o disdire.",
      "Importante — lo scontrino fiscale lo batti sempre tu con il tuo registratore di cassa. L'app NON emette corrispettivi telematici: il promemoria «scontrini da battere» è solo gestionale.",
    ],
    passi: [
      "«Connetti con Stripe» per abilitare gli incassi online (Plus/Pro).",
      "«Gestisci abbonamento» per carta, piano e disdetta.",
      "Ricorda: lo scontrino fiscale lo emetti sempre tu.",
    ],
    img: [{ src: "/guida/g-16-pagamenti.png", alt: "Pagamenti e Telegram", caption: "«Connetti con Stripe» per gli incassi al tavolo." }],
  },
  {
    n: 15,
    id: "riconciliazione",
    titolo: "Riconciliazione",
    occhiello: "Analisi e incassi",
    intro: [
      "Se usi i pagamenti online, in «Riconciliazione» verifichi gli incassi: ogni ordine pagato è collegato alla transazione, così controlli che i soldi tornino con gli ordini.",
    ],
    img: [{ src: "/guida/g-18-riconciliazione.png", alt: "Riconciliazione", caption: "Verifica degli incassi online ordine per ordine." }],
  },
  {
    n: 16,
    id: "funzionalita",
    titolo: "Impostazioni e Funzionalità",
    occhiello: "Impostazioni",
    intro: [
      "In «Impostazioni → Funzionalità» accendi o spegni ciò che ti serve. Ogni funzione ha un piano minimo: con un piano superiore hai più funzioni a disposizione.",
      "Qui sotto trovi l'elenco completo delle funzioni attivabili, con una breve descrizione e il piano minimo richiesto.",
    ],
    img: [{ src: "/guida/g-15-funzionalita.png", alt: "Funzionalità", caption: "Attiva/disattiva le funzioni in base al tuo piano." }],
    table: true,
  },
  {
    n: 17,
    id: "telegram",
    titolo: "Telegram",
    occhiello: "Impostazioni",
    intro: [
      "Puoi ricevere gli ordini (e i pagamenti) direttamente su Telegram, sul telefono. In «Impostazioni → Notifiche Telegram» inserisci l'ID della chat dove vuoi ricevere gli avvisi.",
      "Per trovarlo: scrivi un messaggio al bot, apri il link indicato e copia il valore chat.id. Puoi usare una chat per gli ordini e una per i pagamenti.",
    ],
    passi: [
      "Scrivi un messaggio al bot indicato.",
      "Copia il tuo chat.id e incollalo nella casella «Chat ordini».",
      "Salva e usa «Invia notifica di prova» per verificare.",
    ],
    img: [{ src: "/guida/g-17-telegram.png", alt: "Telegram", caption: "Collega le chat Telegram per ordini e pagamenti." }],
    tip: "Il token del bot è segreto: non condividerlo, perché chi lo possiede può controllare il bot.",
  },
  {
    n: 18,
    id: "cliente-ordine",
    titolo: "L'esperienza del cliente: dal QR all'ordine",
    occhiello: "L'esperienza del cliente",
    intro: [
      "Ecco cosa vede il cliente. Inquadra il QR e apre il menu del tuo locale, con foto, descrizioni, allergeni e (se attivi) peso e calorie. Può sfogliare le categorie, cercare un piatto e filtrare per allergeni e preferenze.",
      "Aggiunge i piatti al carrello, sceglie eventuali varianti e — se hai attivato la funzione — può segnare quali piatti vanno serviti «a seguire». Poi invia l'ordine (e paga online, se abilitato).",
    ],
    img: [
      { src: "/guida/g-20-cust-menu.png", alt: "Menu cliente", caption: "Il menu come lo vede il cliente: foto, allergeni, peso/kcal, tempo stimato.", phone: true },
      { src: "/guida/g-21-cust-ordine.png", alt: "Riepilogo ordine", caption: "Riepilogo dell'ordine, con la possibilità di segnare i piatti «a seguire».", phone: true },
    ],
  },
  {
    n: 19,
    id: "cliente-segui",
    titolo: "Segui il tuo ordine e chiama il cameriere",
    occhiello: "L'esperienza del cliente",
    intro: [
      "Dopo l'invio, il cliente può seguire il suo ordine: avanzamento (ricevuto → in preparazione → pronto → servito), tempo stimato (se attivo) e — piatto per piatto — lo stato di ciascuna portata, comprese quelle «a seguire».",
      "Dal menu, con un tocco su «Serve aiuto?», il cliente può chiamare il cameriere o chiedere il conto al tavolo: tu ricevi la richiesta in tempo reale.",
    ],
    img: [
      { src: "/guida/g-22-cust-tracking.png", alt: "Segui il tuo ordine", caption: "«Segui il tuo ordine»: avanzamento e stato piatto per piatto.", phone: true },
      { src: "/guida/g-23-cust-aiuto.png", alt: "Chiama cameriere", caption: "«Serve aiuto?»: chiama il cameriere o chiedi il conto.", phone: true },
    ],
  },
];

function planBadgeStyle(piano: PlanId): { bg: string; color: string } {
  if (piano === "pro") return { bg: "#ede9fe", color: "#6d28d9" };
  if (piano === "plus") return { bg: "#dbeafe", color: "#1d4ed8" };
  return { bg: "#f3f4f6", color: "#374151" };
}

export default async function GuidaPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; nome?: string }>;
}) {
  const sp = await searchParams;
  const slug = (sp.slug ?? "").toLowerCase();
  const nome = sp.nome?.trim() || "il tuo locale";
  const origin = await appOrigin();
  const menuUrl = slug ? `${origin}/${slug}` : `${origin}/<tuo-indirizzo>`;
  const dashUrl = `${origin}/dashboard`;

  const features = [...FEATURES].sort(
    (a, b) => PLAN_ORDER[a.pianoMinimo] - PLAN_ORDER[b.pianoMinimo] || a.nome.localeCompare(b.nome),
  );

  return (
    <main className="guida">
      <style>{CSS}</style>

      <div className="toolbar">
        <span className="tb-brand">🍽️ MenuFlow · Guida operativa</span>
        <PrintButton />
      </div>

      {/* ---- Copertina ---- */}
      <section className="cover">
        <div className="cover-mark">🍽️</div>
        <div className="cover-kicker">Guida operativa</div>
        <h1 className="cover-title">{nome}</h1>
        <p className="cover-sub">
          Tutto quello che ti serve per usare MenuFlow, funzione per funzione.
        </p>
        <div className="accessi">
          <div className="acc-row">
            <span className="acc-k">Menu pubblico</span>
            <span className="acc-v">{menuUrl}</span>
          </div>
          <div className="acc-row">
            <span className="acc-k">Dashboard</span>
            <span className="acc-v">{dashUrl}</span>
          </div>
          <div className="acc-row">
            <span className="acc-k">Accesso</span>
            <span className="acc-v">la tua email + password</span>
          </div>
        </div>
      </section>

      {/* ---- Indice ---- */}
      <section className="indice">
        <h2 className="idx-title">Indice</h2>
        <ol className="idx-list">
          <li>
            <span>1</span> Introduzione e accessi
          </li>
          {CHAPTERS.map((c) => (
            <li key={c.id}>
              <span>{c.n}</span> {c.titolo}
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Capitoli ---- */}
      {CHAPTERS.map((c) => (
        <section key={c.id} className="cap">
          <div className="cap-head">
            <span className="cap-occhiello">{c.occhiello}</span>
            <h2 className="cap-title">
              <span className="cap-n">{c.n}</span>
              {c.titolo}
            </h2>
          </div>

          {c.intro.map((p, i) => (
            <p key={i} className="cap-p">
              {p}
            </p>
          ))}

          {c.passi && c.passi.length > 0 && (
            <div className="passi">
              <div className="passi-h">Come si fa</div>
              <ul>
                {c.passi.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {c.img?.map((im) => (
            <figure key={im.src} className={im.phone ? "fig fig-phone" : "fig"}>
              <img src={im.src} alt={im.alt} />
              <figcaption>{im.caption}</figcaption>
            </figure>
          ))}

          {c.tip && <div className="tip">💡 {c.tip}</div>}

          {c.table && (
            <table className="feat-table">
              <thead>
                <tr>
                  <th>Funzione</th>
                  <th>Cosa fa</th>
                  <th>Piano min.</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => {
                  const st = planBadgeStyle(f.pianoMinimo);
                  return (
                    <tr key={f.id}>
                      <td className="ft-nome">{f.nome}</td>
                      <td className="ft-desc">{f.descrizione}</td>
                      <td>
                        <span className="ft-badge" style={{ background: st.bg, color: st.color }}>
                          {PLANS[f.pianoMinimo].label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {/* ---- Chiusura ---- */}
      <section className="cap closing">
        <h2 className="cap-title">
          <span className="cap-n">✓</span>Sei pronto
        </h2>
        <p className="cap-p">
          Hai configurato il tuo locale e conosci ogni funzione. Per qualsiasi dubbio, riapri questa
          guida quando vuoi. Buon lavoro con {nome}!
        </p>
        <p className="foot">
          MenuFlow — menu digitale e ordini al tavolo. Lo scontrino fiscale è sempre emesso dal
          locale con il proprio registratore di cassa.
        </p>
      </section>
    </main>
  );
}

const CSS = `
.guida{max-width:840px;margin:0 auto;padding:24px 28px 80px;color:#1f2937;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.62}
.toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:14px;border-bottom:1px solid #e5e7eb}
.tb-brand{font-weight:700;color:#15803d}
.cover{background:#0f3d28;color:#fff;border-radius:20px;padding:54px 40px;text-align:center;margin-bottom:40px}
.cover-mark{font-size:46px}
.cover-kicker{letter-spacing:.22em;text-transform:uppercase;font-size:12px;opacity:.8;margin-top:10px}
.cover-title{font-size:42px;font-weight:800;margin:6px 0 8px;line-height:1.1}
.cover-sub{opacity:.9;max-width:520px;margin:0 auto 26px}
.accessi{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:18px 20px;max-width:560px;margin:0 auto;text-align:left}
.acc-row{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:14px}
.acc-row:last-child{border-bottom:0}
.acc-k{opacity:.7}
.acc-v{font-weight:600;word-break:break-all;text-align:right}
.indice{border:1px solid #e5e7eb;border-radius:16px;padding:24px 28px;margin-bottom:44px}
.idx-title{font-size:18px;font-weight:800;margin:0 0 14px;color:#0f3d28}
.idx-list{list-style:none;margin:0;padding:0;columns:2;column-gap:36px}
.idx-list li{display:flex;gap:10px;align-items:baseline;padding:5px 0;font-size:14px;break-inside:avoid}
.idx-list li span{display:inline-flex;min-width:22px;height:22px;align-items:center;justify-content:center;background:#dcfce7;color:#15803d;border-radius:6px;font-size:12px;font-weight:700}
.cap{margin-bottom:30px;padding-top:8px}
.cap-head{margin-bottom:14px}
.cap-occhiello{display:inline-block;letter-spacing:.16em;text-transform:uppercase;font-size:11px;font-weight:700;color:#15803d;background:#dcfce7;padding:3px 9px;border-radius:999px}
.cap-title{display:flex;align-items:center;gap:12px;font-size:25px;font-weight:800;color:#111827;margin:10px 0 4px}
.cap-n{display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;background:#0f3d28;color:#fff;border-radius:9px;font-size:16px;font-weight:800;flex:none}
.cap-p{margin:10px 0;font-size:15px;color:#374151}
.passi{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 18px;margin:14px 0}
.passi-h{font-weight:800;color:#15803d;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.passi ul{margin:0;padding-left:18px}
.passi li{margin:4px 0;font-size:14.5px}
.fig{margin:18px 0;break-inside:avoid}
.fig img{width:100%;border:1px solid #e5e7eb;border-radius:12px;display:block}
.fig figcaption{font-size:12.5px;color:#6b7280;margin-top:7px;text-align:center}
.fig-phone img{max-width:300px;margin:0 auto;border-radius:18px}
.tip{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:12px 16px;font-size:14px;margin:14px 0}
.feat-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
.feat-table th{text-align:left;background:#0f3d28;color:#fff;padding:9px 12px;font-size:12px}
.feat-table th:last-child{text-align:center}
.feat-table td{border-bottom:1px solid #eef0f2;padding:8px 12px;vertical-align:top}
.ft-nome{font-weight:700;white-space:nowrap}
.ft-desc{color:#4b5563}
.ft-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700}
.feat-table td:last-child{text-align:center}
.closing{border-top:2px solid #dcfce7;padding-top:22px}
.foot{margin-top:18px;font-size:12px;color:#9ca3af}
@media print{
  .guida{max-width:none;padding:0;color:#000}
  .toolbar{display:none}
  .cover{border-radius:0}
  .cover,.indice,.cap,.feat-table th,.cap-n,.ft-badge,.passi,.tip{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cap{break-before:page;page-break-before:always}
  .indice{break-after:page}
  .fig,.passi,.tip,.idx-list li,.feat-table tr{break-inside:avoid}
  a{color:inherit;text-decoration:none}
}
`;
