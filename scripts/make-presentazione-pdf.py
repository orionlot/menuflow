#!/usr/bin/env python3
"""
Genera 'MenuFlow-Presentazione.pdf' — brochure commerciale per convincere un
ristoratore. Distingue i piani (necessita' del cliente finale, facilita' di
configurazione, velocita') ed elenca tutte le funzionalita'.

Render: WeasyPrint (HTML/CSS -> PDF).  Esegui:  python3 scripts/make-presentazione-pdf.py

I valori dei piani rispecchiano src/lib/config/plans.ts (Base 29 / Plus 39 /
Pro 59 / Multilingua +10, EUR/mese). I contatti qui sotto sono PLACEHOLDER:
modificali con i tuoi prima di consegnare il PDF.
"""
from weasyprint import HTML

OUT = "/Users/orion/Downloads/Menu-restaurant/MenuFlow-Presentazione.pdf"

# ── Personalizza qui ─────────────────────────────────────────────
DOMAIN = "menuflow.it"            # il tuo dominio (es. ilmiomenu.it)
PHONE  = "+39 ___ ___ ____"       # il tuo telefono
EMAIL  = "ciao@menuflow.it"       # la tua email
# ─────────────────────────────────────────────────────────────────

HTML_DOC = r"""
<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><style>
  :root{
    --brand:#c8453b; --brand-d:#a8362e; --ink:#211b17; --mute:#6f655d;
    --cream:#faf6f1; --line:#ece2d7; --gold:#bd8a2e; --green:#2f7d52; --soft:#fbeee9;
  }
  @page{
    size:A4; margin:15mm 14mm 17mm 14mm;
    @bottom-center{ content:"MenuFlow · il menu digitale che fa ordinare dal tavolo · " counter(page) "/" counter(pages);
      font:8pt 'Helvetica Neue',Arial,sans-serif; color:#a99f96; }
  }
  *{ box-sizing:border-box; }
  body{ font-family:'Helvetica Neue',Arial,sans-serif; color:var(--ink); font-size:10.2pt; line-height:1.5; margin:0; }
  h1,h2,h3,.brandfont{ font-family:Georgia,'Times New Roman',serif; }
  .section{ break-before:page; }
  .eyebrow{ text-transform:uppercase; letter-spacing:.16em; font-size:8pt; font-weight:bold; color:var(--brand); }
  h2.title{ font-size:21pt; color:var(--ink); margin:.1em 0 .15em; line-height:1.12; }
  h2.title b{ color:var(--brand); }
  .lead{ color:var(--mute); font-size:11pt; margin:0 0 12px; }
  .rule{ height:3px; width:54px; background:var(--brand); border-radius:3px; margin:6px 0 14px; }

  /* COVER */
  .cover{ background:linear-gradient(135deg,#c8453b 0%,#a8362e 100%); color:#fff;
    border-radius:16px; padding:30px 30px 26px; }
  .cover .wm{ font-size:30pt; font-weight:bold; letter-spacing:-.01em; }
  .cover .dot{ color:#f4c9b9; }
  .cover .tag{ display:inline-block; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.35);
    padding:3px 10px; border-radius:999px; font-size:8.5pt; letter-spacing:.04em; margin-top:6px; }
  .cover h1{ font-size:25pt; line-height:1.16; margin:16px 0 8px; }
  .cover p{ font-size:11.5pt; color:#fdeee8; margin:0 0 4px; max-width:96%; }
  .chips{ margin-top:16px; }
  .chip{ display:inline-block; background:#fff; color:var(--brand-d); font-weight:bold; font-size:9pt;
    padding:6px 11px; border-radius:999px; margin:4px 6px 0 0; }
  .why{ display:flex; gap:14px; margin-top:18px; }
  .why .col{ flex:1; background:var(--cream); border:1px solid var(--line); border-radius:12px; padding:13px 14px; }
  .why h3{ font-size:11pt; margin:0 0 4px; color:var(--brand-d); }
  .why p{ margin:0; font-size:9.4pt; color:var(--mute); }
  .flow{ margin-top:14px; text-align:center; font-size:10pt; color:var(--ink); background:var(--soft);
    border:1px solid #f1d8cf; border-radius:10px; padding:10px; }
  .flow b{ color:var(--brand-d); }

  /* GENERIC CARDS / GRID */
  .two{ display:flex; gap:16px; }
  .two > div{ flex:1; }
  .card{ background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 15px; }
  .card.warm{ background:var(--cream); }
  .card h3{ font-size:12pt; margin:0 0 7px; color:var(--ink); }
  .need{ margin:0 0 8px; padding-left:0; }
  .need b{ color:var(--brand-d); }
  ul.tick{ list-style:none; margin:6px 0 0; padding:0; }
  ul.tick li{ position:relative; padding:3px 0 3px 18px; font-size:9.6pt; }
  ul.tick li:before{ content:"✓"; position:absolute; left:0; color:var(--green); font-weight:bold; }

  /* PLANS */
  .plans{ display:flex; gap:12px; align-items:stretch; margin-top:4px; }
  .plan{ flex:1; border:1px solid var(--line); border-radius:14px; overflow:hidden; background:#fff; }
  .plan .top{ padding:13px 14px 11px; border-bottom:1px solid var(--line); }
  .plan.best{ border:2px solid var(--brand); box-shadow:0 8px 18px rgba(200,69,59,.12); }
  .plan.best .top{ background:var(--brand); color:#fff; border-bottom:none; }
  .plan .name{ font-family:Georgia,serif; font-size:15pt; font-weight:bold; }
  .plan .price{ font-size:21pt; font-weight:bold; font-family:Georgia,serif; }
  .plan .price small{ font-size:9.5pt; font-weight:normal; color:var(--mute); }
  .plan.best .price small{ color:#fbe4dc; }
  .plan .who{ font-size:9pt; color:var(--mute); min-height:30px; }
  .plan.best .who{ color:#fde9e3; }
  .ribbon{ display:inline-block; background:#fff; color:var(--brand-d); font-weight:bold; font-size:7.5pt;
    letter-spacing:.08em; text-transform:uppercase; padding:2px 8px; border-radius:999px; margin-bottom:5px; }
  .plan .body{ padding:11px 14px 14px; }
  .plan .body .lab{ font-size:8pt; text-transform:uppercase; letter-spacing:.1em; color:var(--brand);
    font-weight:bold; margin:0 0 4px; }
  .plan ul.tick li{ font-size:9pt; padding-left:16px; }
  .addon{ margin-top:12px; background:var(--ink); color:#fff; border-radius:12px; padding:12px 16px;
    display:flex; align-items:center; gap:12px; }
  .addon .pz{ font-family:Georgia,serif; font-size:15pt; font-weight:bold; color:#ffd9a0; white-space:nowrap; }
  .addon p{ margin:0; font-size:9.4pt; color:#e9e2db; }
  .addon b{ color:#fff; }

  /* COMPARISON TABLE */
  table.cmp{ width:100%; border-collapse:collapse; margin-top:6px; font-size:9.2pt; }
  table.cmp th,table.cmp td{ border-bottom:1px solid var(--line); padding:5.5px 8px; text-align:left; }
  table.cmp thead th{ background:var(--cream); color:var(--ink); font-family:Georgia,serif; }
  table.cmp th.col,table.cmp td.col{ text-align:center; width:62px; }
  table.cmp td.feat{ color:var(--ink); }
  table.cmp .yes{ color:var(--green); font-weight:bold; }
  table.cmp .no{ color:#c9bdb2; }
  table.cmp .tagp{ font-size:7.5pt; color:var(--brand-d); font-weight:bold; }
  table.cmp tr.group td{ background:#fff; font-weight:bold; font-family:Georgia,serif; color:var(--brand-d);
    border-bottom:2px solid var(--soft); padding-top:9px; }

  /* STEPS / SPEED */
  .steps{ counter-reset:s; margin-top:4px; }
  .step{ display:flex; gap:12px; padding:8px 0; border-bottom:1px dashed var(--line); }
  .step .n{ counter-increment:s; }
  .step .n:before{ content:counter(s); display:inline-flex; align-items:center; justify-content:center;
    width:24px; height:24px; background:var(--brand); color:#fff; border-radius:50%; font-weight:bold; font-size:10pt; }
  .step h4{ margin:0 0 1px; font-size:10.5pt; }
  .step p{ margin:0; font-size:9.3pt; color:var(--mute); }
  .speed{ display:flex; gap:14px; flex-wrap:wrap; margin-top:4px; }
  .speed .s{ flex:1 1 45%; background:var(--cream); border:1px solid var(--line); border-radius:11px; padding:12px 14px; }
  .speed .s h4{ margin:0 0 3px; font-size:10.5pt; color:var(--brand-d); }
  .speed .s p{ margin:0; font-size:9.3pt; color:var(--mute); }

  /* FEATURES GRID */
  .feat{ columns:2; column-gap:18px; }
  .fc{ break-inside:avoid; margin:0 0 11px; }
  .fc h4{ margin:0 0 4px; font-size:10.5pt; color:var(--brand-d); border-bottom:2px solid var(--soft); padding-bottom:3px; }
  .fc ul{ list-style:none; margin:0; padding:0; }
  .fc li{ position:relative; padding:2.5px 0 2.5px 14px; font-size:9pt; line-height:1.35; }
  .fc li:before{ content:"›"; position:absolute; left:0; color:var(--brand); font-weight:bold; }
  .pill{ font-size:7pt; font-weight:bold; letter-spacing:.04em; padding:1px 5px; border-radius:999px;
    background:var(--soft); color:var(--brand-d); vertical-align:middle; }

  /* CTA */
  .cta{ background:linear-gradient(135deg,#c8453b,#a8362e); color:#fff; border-radius:16px; padding:26px 28px; }
  .cta h2{ font-size:20pt; margin:0 0 6px; }
  .cta p{ font-size:11pt; color:#fdeee8; margin:0 0 12px; }
  .cta .url{ display:inline-block; background:#fff; color:var(--brand-d); font-weight:bold; font-size:13pt;
    padding:9px 16px; border-radius:10px; font-family:Georgia,serif; }
  .contact{ margin-top:16px; display:flex; gap:14px; }
  .contact .c{ flex:1; background:#fff; border:1px solid var(--line); border-radius:11px; padding:11px 14px; }
  .contact .c .k{ font-size:7.5pt; text-transform:uppercase; letter-spacing:.1em; color:var(--brand); font-weight:bold; }
  .contact .c .v{ font-size:11pt; font-weight:bold; }
  .note{ margin-top:14px; background:var(--cream); border:1px solid var(--line); border-left:4px solid var(--gold);
    border-radius:8px; padding:11px 14px; font-size:8.8pt; color:var(--mute); }
  .note b{ color:var(--ink); }
</style></head><body>

<!-- ══════════════ COVER ══════════════ -->
<div class="cover">
  <div class="wm brandfont">Menu<span class="dot">Flow</span></div>
  <span class="tag">Menu digitale · Ordini al tavolo · Pagamenti · Telegram</span>
  <h1>Il tuo menu diventa digitale.<br>I clienti ordinano dal tavolo.<br>Tu pensi solo a cucinare.</h1>
  <p>Il cliente inquadra il <b>QR</b>, vede il menu sul suo telefono — senza scaricare nulla — ordina,
     paga (se vuoi) e l'ordine ti arriva subito su <b>Telegram</b>.</p>
  <div class="chips">
    <span class="chip">Zero app da scaricare</span>
    <span class="chip">Pronto in ~10 minuti</span>
    <span class="chip">Sempre online</span>
    <span class="chip">Aggiorni prezzi in 1 clic</span>
  </div>
</div>

<div class="why">
  <div class="col"><h3>Tavoli più veloci</h3><p>Il cliente ordina quando è pronto, senza aspettare il cameriere. Meno code, più giri tavolo.</p></div>
  <div class="col"><h3>Meno errori</h3><p>L'ordine arriva scritto, con varianti ed extra. Niente fraintendimenti, niente comande perse.</p></div>
  <div class="col"><h3>Scontrini comodi</h3><p>Ti arriva l'avviso «battere scontrino»: il fiscale lo emetti tu, ma il promemoria è automatico.</p></div>
</div>

<div class="flow">
  <b>Come funziona:</b> QR al tavolo &nbsp;→&nbsp; menu sul telefono &nbsp;→&nbsp; ordine &nbsp;→&nbsp;
  (pagamento online) &nbsp;→&nbsp; notifica Telegram a te &nbsp;→&nbsp; cucina &amp; servizio.
</div>

<div style="margin-top:16px; font-size:9pt; color:var(--mute); text-align:center;">
  Una piattaforma sola, un solo abbonamento mensile. Niente sito da costruire, niente menu da ristampare.
</div>

<!-- ══════════════ COSA RISOLVE ══════════════ -->
<div class="section">
  <div class="eyebrow">I bisogni che soddisfa</div>
  <h2 class="title">Cosa risolve per il <b>cliente</b> al tavolo</h2>
  <div class="rule"></div>
  <p class="lead">Le persone non vogliono attendere, vogliono capire cosa mangiano e pagare comode. MenuFlow risponde a ogni esigenza.</p>

  <div class="two">
    <div class="card warm">
      <p class="need"><b>«Non voglio scaricare app.»</b></p>
      <ul class="tick"><li>Inquadra il QR e il menu si apre nel browser, all'istante.</li>
        <li>Funziona su qualsiasi telefono, anche con connessione lenta.</li></ul>
      <p class="need" style="margin-top:10px"><b>«Voglio capire cosa mangio.»</b></p>
      <ul class="tick"><li>Foto, descrizioni e <b>allergeni</b> per ogni piatto.</li>
        <li><b>Profilo allergie</b>: imposta le tue e le voci a rischio si evidenziano.</li>
        <li>Menu <b>multilingua</b> per i clienti stranieri.</li></ul>
    </div>
    <div class="card warm">
      <p class="need"><b>«Voglio ordinare quando sono pronto.»</b></p>
      <ul class="tick"><li>Aggiunge piatti, sceglie varianti ed extra, indica il tavolo e invia.</li>
        <li>Vede lo <b>stato dell'ordine</b> in tempo reale: in preparazione → pronto → servito.</li>
        <li>Può <b>chiamare il cameriere</b> o <b>chiedere il conto</b> con un tocco.</li></ul>
      <p class="need" style="margin-top:10px"><b>«Voglio pagare comodo.»</b></p>
      <ul class="tick"><li><b>Paga dal telefono</b> (dove attivo) o ordina e salda alla cassa.</li>
        <li>Totale sempre chiaro, con coperto e mancia opzionale.</li>
        <li>A fine pasto: <b>voto</b> e invito a lasciare una <b>recensione Google</b>.</li></ul>
    </div>
  </div>

  <h2 class="title" style="margin-top:20px">Cosa risolve per <b>te</b> che gestisci</h2>
  <div class="rule"></div>
  <div class="two">
    <div class="card">
      <ul class="tick">
        <li><b>Più scontrino medio</b>: piatti consigliati ed extra spingono l'upselling.</li>
        <li><b>Aggiorni in tempo reale</b>: prezzo o «esaurito» cambiano subito, niente menu da ristampare.</li>
        <li><b>Recensioni Google</b> in crescita: l'invito parte da solo dopo l'ordine.</li>
      </ul>
    </div>
    <div class="card">
      <ul class="tick">
        <li><b>Cucina ordinata</b>: ordini live, Kitchen Display, stampa comanda.</li>
        <li><b>Dati chiari</b>: statistiche, riepilogo giornaliero, export per il commercialista.</li>
        <li><b>Zero competenze tecniche</b>: configuri tutto da solo dal pannello.</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════ PIANI ══════════════ -->
<div class="section">
  <div class="eyebrow">Scegli come partire</div>
  <h2 class="title">Tre piani, <b>un prezzo chiaro</b> al mese</h2>
  <div class="rule"></div>
  <p class="lead">Tutti i piani includono menu digitale, personalizzazione completa e notifiche. Cresci quando vuoi: cambi piano in un clic.</p>

  <div class="plans">
    <div class="plan">
      <div class="top">
        <div class="name">Base</div>
        <div class="price">29€<small>/mese</small></div>
        <div class="who">Per partire subito: menu digitale e ordini al tavolo, senza fronzoli.</div>
      </div>
      <div class="body">
        <p class="lab">Il cliente può</p>
        <ul class="tick">
          <li>Vedere il menu dal QR e ordinare al tavolo</li>
          <li>Allergeni, profilo allergie e piatti consigliati</li>
          <li>Lasciare una recensione Google</li>
        </ul>
        <p class="lab" style="margin-top:9px">Per te</p>
        <ul class="tick"><li>Bot Telegram Ordini</li><li>Stampa comanda · orari di apertura</li><li>Brand, stili e statistiche</li></ul>
      </div>
    </div>

    <div class="plan best">
      <div class="top">
        <span class="ribbon">Il più scelto</span>
        <div class="name">Plus</div>
        <div class="price">39€<small>/mese</small></div>
        <div class="who">Per incassare dal tavolo e avere un dominio tutto tuo.</div>
      </div>
      <div class="body">
        <p class="lab">Tutto di Base, più</p>
        <ul class="tick">
          <li><b>Pagamenti al tavolo</b> (carta, dal telefono)</li>
          <li><b>Dominio personalizzato</b> (il-tuo-nome.it)</li>
          <li>Mancia, <b>feedback</b> a stelle</li>
          <li><b>Riepilogo giornaliero</b> e <b>scorte</b></li>
        </ul>
        <p class="lab" style="margin-top:9px">Il cliente può</p>
        <ul class="tick"><li>Pagare subito e lasciare la mancia</li></ul>
      </div>
    </div>

    <div class="plan">
      <div class="top">
        <div class="name">Pro</div>
        <div class="price">59€<small>/mese</small></div>
        <div class="who">Per chi fa volumi e vuole controllo e supporto prioritario.</div>
      </div>
      <div class="body">
        <p class="lab">Tutto di Plus, più</p>
        <ul class="tick">
          <li><b>Riconciliazione avanzata</b> dei pagamenti</li>
          <li><b>Priorità nel supporto</b></li>
          <li>Ideale per più sale e alto traffico</li>
        </ul>
        <p class="lab" style="margin-top:9px">Il cliente percepisce</p>
        <ul class="tick"><li>Un servizio rapido e curato in ogni dettaglio</li></ul>
      </div>
    </div>
  </div>

  <div class="addon">
    <div class="pz">+10€/mese</div>
    <p><b>Multilingua</b> (add-on, su qualsiasi piano) — il menu nella lingua del cliente.
       Perfetto in zone turistiche: ogni straniero legge e ordina senza barriere.</p>
  </div>

  <div style="break-before:page"></div>
  <div class="eyebrow">A confronto</div>
  <h2 class="title" style="font-size:18pt;">Confronto rapido dei piani</h2>
  <div class="rule"></div>
  <table class="cmp">
    <thead><tr><th>Funzionalità</th><th class="col">Base</th><th class="col">Plus</th><th class="col">Pro</th></tr></thead>
    <tbody>
      <tr class="group"><td colspan="4">Menu & cliente</td></tr>
      <tr><td class="feat">Menu digitale QR + ordini al tavolo</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Personalizzazione (stili, colori, logo, layout)</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Allergeni + profilo allergie</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Piatto consigliato · recensioni Google</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Varianti, extra e aggiunte</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr class="group"><td colspan="4">Operatività</td></tr>
      <tr><td class="feat">Bot Telegram · stampa comanda · Kitchen Display</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Orari di apertura</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Statistiche + export CSV</td><td class="col yes">✓</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr class="group"><td colspan="4">Incasso & crescita</td></tr>
      <tr><td class="feat">Pagamenti al tavolo (Stripe) + mancia</td><td class="col no">—</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Dominio personalizzato</td><td class="col no">—</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Feedback a stelle · riepilogo giornaliero · scorte</td><td class="col no">—</td><td class="col yes">✓</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Riconciliazione avanzata · priorità supporto</td><td class="col no">—</td><td class="col no">—</td><td class="col yes">✓</td></tr>
      <tr><td class="feat">Multilingua <span class="tagp">add-on +10€</span></td><td class="col yes">+</td><td class="col yes">+</td><td class="col yes">+</td></tr>
    </tbody>
  </table>
</div>

<!-- ══════════════ CONFIGURAZIONE + VELOCITÀ ══════════════ -->
<div class="section">
  <div class="eyebrow">Facile da attivare</div>
  <h2 class="title">Pronto in <b>~10 minuti</b>, senza tecnici</h2>
  <div class="rule"></div>
  <p class="lead">Ti registri da solo e parti con un menu d'esempio già pronto. Niente sviluppatori, niente attese.</p>

  <div class="steps">
    <div class="step"><div class="n"></div><div><h4>Registrati online</h4><p>Vai su <b>""" + DOMAIN + r"""/onboarding</b>, scegli il piano e crea l'account. Ricevi una guida PDF.</p></div></div>
    <div class="step"><div class="n"></div><div><h4>Scegli lo stile</h4><p>Applichi uno <b>stile pronto</b> (Trattoria, Moderno, Elegante, Caffè, Pub) con un clic e regoli colori e logo.</p></div></div>
    <div class="step"><div class="n"></div><div><h4>Carica il menu</h4><p>Aggiungi voci, foto e prezzi — o <b>importi tutto da un file CSV</b>. Trascini per riordinare.</p></div></div>
    <div class="step"><div class="n"></div><div><h4>Collega Telegram (e Stripe)</h4><p>Imposti il bot Ordini dal pannello, con notifica di prova. Su Plus/Pro colleghi il tuo account Stripe per i pagamenti.</p></div></div>
    <div class="step"><div class="n"></div><div><h4>Stampa i QR</h4><p>Generi i <b>QR per tavolo</b> pronti da stampare. Da questo momento i clienti ordinano.</p></div></div>
  </div>

  <h2 class="title" style="margin-top:20px">Veloce e <b>sempre disponibile</b></h2>
  <div class="rule"></div>
  <div class="speed">
    <div class="s"><h4>Si apre in un istante</h4><p>Il menu è una pagina statica ultra-leggera: carica subito, anche con rete lenta o tanti clienti insieme.</p></div>
    <div class="s"><h4>Non si rompe mai</h4><p>Anche durante una manutenzione il menu resta visibile, con avviso a rivolgersi allo staff. Il cliente non trova mai una pagina vuota.</p></div>
    <div class="s"><h4>Tempo reale</h4><p>Segni «esaurito» e sparisce all'istante; gli ordini arrivano live in dashboard e in cucina.</p></div>
    <div class="s"><h4>Sicuro by design</h4><p>Pagamenti gestiti da Stripe, dati isolati per ogni locale, totali ricalcolati lato server: prezzi a prova di manomissione.</p></div>
  </div>
</div>

<!-- ══════════════ TUTTE LE FUNZIONALITÀ ══════════════ -->
<div class="section">
  <div class="eyebrow">L'elenco completo</div>
  <h2 class="title">Tutte le funzionalità</h2>
  <div class="rule"></div>
  <p class="lead">Tutto quello che MenuFlow mette a disposizione, in un colpo d'occhio.</p>

  <div class="feat">
    <div class="fc"><h4>Menu & contenuti</h4><ul>
      <li>Categorie, descrizioni e foto illimitate</li>
      <li>Riordino drag-and-drop</li>
      <li>Allergeni (14) con legenda + profilo allergie</li>
      <li>Varianti/extra per voce (cottura, impasto…)</li>
      <li>Aggiunte valide per intere categorie</li>
      <li>Piatto consigliato (★) e «più ordinati» automatico</li>
      <li>Ricerca nel menu</li>
      <li>Esaurito istantaneo · scorte del giorno <span class="pill">PLUS</span></li>
      <li>Import da CSV · duplica voce</li>
    </ul></div>

    <div class="fc"><h4>Aspetto & brand</h4><ul>
      <li>5 stili pronti applicabili con un clic</li>
      <li>Colore principale + secondario, tema chiaro/scuro</li>
      <li>Logo e sottotitolo del locale</li>
      <li>4 tipografie + 5 controlli di layout</li>
      <li>Anteprima dal vivo delle modifiche</li>
    </ul></div>

    <div class="fc"><h4>Ordini & pagamenti</h4><ul>
      <li>Ordine dal tavolo via QR, con numero tavolo e note</li>
      <li>Coperto (per persona / a ordine / servizio %)</li>
      <li>Mancia opzionale <span class="pill">PLUS</span></li>
      <li>Pagamento online con Stripe <span class="pill">PLUS</span></li>
      <li>Totale ricalcolato lato server (anti-frode)</li>
      <li>Stato ordine in tempo reale per il cliente</li>
    </ul></div>

    <div class="fc"><h4>Cucina & operatività</h4><ul>
      <li>Ordini live: badge «Nuovo», suono, auto-refresh</li>
      <li>Kitchen Display a schermo intero (pronto/servito)</li>
      <li>Stampa comanda 80mm (qualsiasi stampante termica)</li>
      <li>Chiama cameriere / chiedi il conto dal tavolo</li>
      <li>Riconciliazione pagamenti del giorno</li>
    </ul></div>

    <div class="fc"><h4>Marketing & fidelizzazione</h4><ul>
      <li>Spinta recensioni Google (1 tap dopo l'ordine)</li>
      <li>Feedback post-ordine a stelle <span class="pill">PLUS</span></li>
      <li>Piatti in evidenza per l'upselling</li>
    </ul></div>

    <div class="fc"><h4>Gestione & dati</h4><ul>
      <li>Statistiche incassi/ordini + export CSV</li>
      <li>Riepilogo giornaliero <span class="pill">PLUS</span></li>
      <li>Generatore QR per tavolo</li>
      <li>Notifiche Telegram Ordini e Pagamenti</li>
    </ul></div>

    <div class="fc"><h4>Multilingua <span class="pill">ADD-ON</span></h4><ul>
      <li>Menu in più lingue</li>
      <li>Il cliente sceglie la lingua in alto</li>
    </ul></div>

    <div class="fc"><h4>Piattaforma</h4><ul>
      <li>Dominio personalizzato <span class="pill">PLUS</span> o sottodominio</li>
      <li>Onboarding self-service + menu d'esempio + guida PDF</li>
      <li>Dati isolati per locale · pagamenti via Stripe</li>
      <li>Menu statico ultra-veloce e resiliente</li>
    </ul></div>
  </div>
</div>

<!-- ══════════════ CTA ══════════════ -->
<div class="section">
  <div class="cta">
    <h2>Porta il tuo menu nel presente.</h2>
    <p>Attivalo oggi: in pochi minuti il tuo locale è online e i clienti ordinano dal tavolo.</p>
    <span class="url">""" + DOMAIN + r"""/onboarding</span>
  </div>

  <div class="contact">
    <div class="c"><div class="k">Telefono</div><div class="v">""" + PHONE + r"""</div></div>
    <div class="c"><div class="k">Email</div><div class="v">""" + EMAIL + r"""</div></div>
    <div class="c"><div class="k">Sito</div><div class="v">""" + DOMAIN + r"""</div></div>
  </div>

  <div class="note">
    <b>Nessuno scontrino fiscale.</b> MenuFlow non emette corrispettivi telematici: lo scontrino lo batti
    sempre tu con il tuo registratore di cassa. L'app è un promemoria gestionale e ti avvisa quando un
    ordine è stato pagato. &nbsp;Prezzi in euro al mese; il piano si cambia o disdice quando vuoi.
  </div>

  <div style="margin-top:14px; text-align:center; font-size:9pt; color:#a99f96;">
    MenuFlow — un menu digitale, un abbonamento, tutti i tuoi tavoli.
  </div>
</div>

</body></html>
"""

HTML(string=HTML_DOC).write_pdf(OUT)
print("OK:", OUT)
