# Prompt per Claude (o altra AI di design) — versione ANIMATA del pitch MenuFlow

Copia/incolla il prompt qui sotto in Claude (o nello strumento di design AI), allegando la cartella `screenshots/` (16 immagini) e il file `MenuFlow-Pitch.html` come riferimento del contenuto e dello stile.

---

## PROMPT

Sei un senior motion/presentation designer. Crea una **presentazione web animata 16:9** (HTML + CSS + JS, single-file, autosufficiente) per il prodotto **MenuFlow**, partendo dai contenuti e dagli screenshot che ti fornisco. Deve sembrare un pitch alla *Shark Tank*: ritmo, energia, momenti "wow", chiarezza per un pubblico non tecnico (ristoratori e investitori).

**Cos'è MenuFlow:** una piattaforma SaaS multi-tenant per ristoranti — menu digitale via QR, ordini al tavolo/asporto/delivery, prenotazioni, cucina digitale (KDS), pagamenti online, statistiche e gestione completa. Un solo software per tutti i locali: aggiungere un cliente = una riga nel database.

**Sistema visivo (rispettalo):**
- Colori: verde primario `#16855c`, verde scuro `#0c3b2e` (slide "dark"), testo `#16241d`, sfondo crema `#faf7f2`, linee `#e7e0d5`, accento oro `#cf9b3a`.
- Font: **Manrope** (Google Fonts), pesi 400–800. Sentence case, niente ALL CAPS tranne gli eyebrow piccoli con letter-spacing.
- Stile: flat, pulito, molto leggibile, nessun gradiente pesante. Mockup: telefoni con bezel scuro arrotondato per gli screenshot mobile, finestra browser (3 pallini) per gli screenshot desktop.

**Screenshot da usare** (cartella `screenshots/`, sono reali, dell'app in funzione):
- Mobile (telefono): `02-menu-top` (menu), `07-poke-builder` (componibili), `08-checkout` (ordine), `04-reservation` (prenotazione), `01-menu-cookie-banner` (banner cookie), `06-privacy-policy`.
- Desktop (browser): `11-cucina-kds` (cucina/KDS), `09-dashboard`, `13-statistiche`, `12-menu-manager` (gestione menu), `17-admin` (multi-tenant), `10-ordini`, `14-prenotazioni`, `15-conti`, `16-qr`.

**Struttura (14 slide, stessa narrativa del PDF allegato):**
1. Cover (dark) — "Il menu che vende per te." + chips delle funzioni.
2. Il problema — menu fermi, ordini caotici, zero dati (3 card).
3. La soluzione (dark) — per il cliente / per il ristoratore / per la scala.
4. Esperienza cliente — `02-menu-top`.
5. Componibili & upsell — `07-poke-builder`.
6. Ordine in pochi tap — `08-checkout`.
7. Prenotazioni — `04-reservation`.
8. Cucina digitale (KDS) — `11-cucina-kds`.
9. Dashboard & statistiche — `09-dashboard` + `13-statistiche`.
10. Gestione menu — `12-menu-manager`.
11. Conformità & GDPR — `01-menu-cookie-banner` + `06-privacy-policy`.
12. Scalabilità / multi-tenant (dark) — `17-admin`.
13. Modello di ricavo — piani Base 29€ / Plus 39€ / Pro 59€ (+ Multilingua 10€).
14. Chiusura / ask (dark) — KPI + "Parliamone."

**Animazioni richieste (questo è il cuore del lavoro):**
- **Transizioni tra slide** fluide (fade + slide-up leggero, ~500ms, easing morbido). Navigazione con frecce tastiera, click e swipe; barra di progresso in basso.
- **Reveal in stagger** degli elementi di ogni slide all'ingresso: eyebrow → headline → testo → mockup → bullet uno dopo l'altro (delay ~80–120ms).
- **Mockup**: i telefoni e le finestre browser entrano con un leggero scale-up + fade da sotto; ombra che si "posa".
- **Bullet con spunta**: il cerchio verde con ✓ che "pop"-pa quando il bullet appare.
- **Numeri (slide 13 e 14)**: count-up animato (es. l'incasso, i prezzi dei piani, i KPI).
- **Cover**: il titolo entra parola per parola; le chip delle funzioni entrano in cascata.
- **KDS (slide 8)**: idealmente evidenzia in sequenza le 4 colonne (da preparare → in preparazione → pronto → servito) con un piccolo glow/scale per raccontare il flusso.
- **Vetrina/carosello**: se mostri più screenshot mobile, falli scorrere.
- Rispetta `prefers-reduced-motion` (riduci/annulla le animazioni).

**Requisiti tecnici:**
- Single-file HTML autosufficiente (puoi usare GSAP o Motion One via CDN, o CSS animations + IntersectionObserver). 16:9, responsive, leggibile a proiettore.
- Funziona aprendo il file nel browser e va in **fullscreen** (tasto F). Deve restare **esportabile in PDF** (una slide per pagina) con `@media print`.
- Testi in **italiano**, tono professionale ma diretto.

Consegna il file HTML completo. Mantieni i testi del PDF allegato (puoi rifinirli ma non snaturarli).
