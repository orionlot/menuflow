#!/usr/bin/env python3
"""Genera il PDF 'Tutte le funzionalita' di MenuFlow (ristoratore + cliente)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem, HRFlowable,
)

BRAND = colors.HexColor("#c8453b")
INK = colors.HexColor("#1f1a16")
MUTE = colors.HexColor("#6b625b")
OUT = "/Users/orion/Downloads/Menu-restaurant/MenuFlow-Funzionalita.pdf"

ss = getSampleStyleSheet()
TITLE = ParagraphStyle("T", parent=ss["Title"], fontName="Helvetica-Bold",
                       fontSize=24, textColor=BRAND, leading=28, spaceAfter=2)
SUB = ParagraphStyle("S", parent=ss["Normal"], fontSize=11, textColor=INK, leading=15, spaceAfter=8)
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold",
                    fontSize=14, textColor=BRAND, spaceBefore=14, spaceAfter=5, leading=17)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                    fontSize=11, textColor=INK, spaceBefore=8, spaceAfter=3, leading=14)
BODY = ParagraphStyle("B", parent=ss["Normal"], fontSize=9.8, textColor=INK, leading=14, spaceAfter=3)
SMALL = ParagraphStyle("Sm", parent=BODY, fontSize=8.5, textColor=MUTE, leading=12)


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, BODY), leftIndent=10) for t in items],
        bulletType="bullet", start="•", leftIndent=12,
    )


doc = SimpleDocTemplate(
    OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=18 * mm, bottomMargin=16 * mm, title="MenuFlow - Funzionalita",
)
S = []
S.append(Paragraph("MenuFlow", TITLE))
S.append(Paragraph("Tutte le funzionalita &mdash; guida per il ristoratore e per il cliente", SUB))
S.append(HRFlowable(color=BRAND, thickness=1.2, spaceAfter=8))

S.append(Paragraph("Per il cliente (al tavolo)", H1))
S.append(bullets([
    "<b>Scansiona il QR</b> al tavolo e vede subito il menu, senza scaricare alcuna app.",
    "<b>Ordina dal telefono</b>: aggiunge piatti, sceglie varianti ed extra (es. cottura, aggiunte), indica il tavolo e invia.",
    "<b>Menu multilingua</b> (dove attivo): seleziona la lingua in alto a destra.",
    "<b>Allergeni</b> indicati per ogni voce, con legenda. <b>Profilo allergie</b>: imposta le proprie allergie e le voci a rischio vengono evidenziate.",
    "<b>Piatti consigliati</b> con badge in evidenza.",
    "<b>Coperto e mancia</b>: il totale si aggiorna in chiaro; la mancia e' opzionale (solo con pagamenti online).",
    "<b>Stato dell'ordine</b> in tempo reale: in preparazione, pronto, servito.",
    "<b>Pagamento online</b> (dove attivo) oppure ordine inviato direttamente allo staff.",
    "<b>Feedback</b>: lascia un voto a stelle dopo l'ordine. <b>Recensione Google</b> con un tap.",
    "<b>Orari</b>: fuori orario il menu mostra &laquo;Siamo chiusi&raquo; e blocca gli ordini.",
]))

S.append(Paragraph("Per il ristoratore (dashboard)", H1))
S.append(Paragraph("Menu", H2))
S.append(bullets([
    "Aggiungi e modifica voci, prezzi, descrizioni e foto; trascina per riordinare; gestione categorie.",
    "Allergeni, varianti/extra per voce e aggiunte valide per intere categorie.",
    "Segna <b>esaurito</b>, <b>consigliato</b>, e imposta le <b>scorte</b> del giorno (auto-esaurito a zero).",
]))
S.append(Paragraph("Aspetto", H2))
S.append(bullets([
    "<b>Stili pronti</b> (Trattoria, Moderno, Elegante, Caffe', Pub) applicabili con un clic.",
    "Colore <b>principale e secondario</b>, tema chiaro/scuro, logo, sottotitolo.",
    "<b>Tipografia</b> (Classico/Moderno/Elegante/Tondo) e <b>5 opzioni di layout</b> (bordi, posizione foto, foto per categoria, intestazione, densita'), con anteprima dal vivo.",
]))
S.append(Paragraph("Funzionalita' (pannello unico)", H2))
S.append(bullets([
    "<b>Servizio</b>: coperto (per persona / a ordine / servizio %) e mancia.",
    "<b>Orari di apertura</b>: giorni e fascia oraria.",
    "<b>Interruttori funzioni</b>: piatto consigliato, recensioni Google, profilo allergie, orari, stampa comanda, feedback, riepilogo, scorte &mdash; disponibili in base al piano.",
]))
S.append(Paragraph("Ordini e cucina", H2))
S.append(bullets([
    "<b>Ordini live</b>: badge &laquo;Nuovo&raquo;, avviso sonoro, aggiornamento automatico, &laquo;segna letti&raquo;.",
    "<b>Stampa comanda</b> 80mm su qualsiasi stampante. <b>Riepilogo giornaliero</b> (incassi, ordini, scontrini da battere). Voto del cliente visibile.",
    "<b>Kitchen Display</b> a schermo intero per la cucina (pronto / servito).",
    "<b>Riconciliazione</b> pagamenti del giorno (promemoria gestionale, non fiscale).",
    "<b>Statistiche</b> con export CSV, generatore <b>QR</b> per tavolo, notifiche <b>Telegram</b>.",
]))

S.append(Paragraph("Attivazione funzioni (piano + admin + ristoratore)", H1))
S.append(bullets([
    "Ogni funzione e' <b>attivabile o disattivabile</b> dalla tab &laquo;Funzionalita'&raquo;.",
    "Il <b>piano</b> (Base / Plus / Pro) definisce cosa e' incluso; l'<b>amministratore</b> puo' sbloccare per il singolo locale; il <b>ristoratore</b> accende cio' che gli e' concesso.",
]))

S.append(Paragraph("Registrazione self-service", H1))
S.append(bullets([
    "Pagina <b>/onboarding</b>: vetrina, piani e prezzi, form di iscrizione, attivazione e <b>menu d'esempio</b> gia' pronto.",
    "Al termine: credenziali a schermo e <b>guida PDF</b> scaricabile dal nuovo ristoratore.",
]))

S.append(Paragraph("Note importanti", H1))
S.append(bullets([
    "<b>Nessuno scontrino fiscale</b>: lo scontrino lo emette sempre il ristoratore con il proprio registratore di cassa. L'app e' solo un promemoria gestionale.",
    "<b>In arrivo</b>: pagamenti Stripe reali, onboarding Telegram automatico, import menu da CSV, ricerca e filtri sul menu, chiamata cameriere, disponibilita' oraria per singola voce.",
]))
S.append(Spacer(1, 10))
S.append(Paragraph("MenuFlow &mdash; documento generato automaticamente.", SMALL))

doc.build(S)
print("OK:", OUT)
