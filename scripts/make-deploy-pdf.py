#!/usr/bin/env python3
"""Genera la guida PDF al deploy gratuito di MenuFlow (Supabase + Vercel)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Preformatted, ListFlowable, ListItem, HRFlowable, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT

BRAND = colors.HexColor("#c8453b")
INK = colors.HexColor("#1f1a16")
MUTE = colors.HexColor("#6b625b")
CODEBG = colors.HexColor("#f3efe9")
NOTEBG = colors.HexColor("#eef4ff")
WARNBG = colors.HexColor("#fff7e6")
OKBG = colors.HexColor("#eefaf0")
LINE = colors.HexColor("#e6ddd2")

OUT = "/Users/orion/Downloads/Menu-restaurant/MenuFlow-Deploy-Gratuito.pdf"

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="Helvetica-Bold",
                    fontSize=15, textColor=BRAND, spaceBefore=16, spaceAfter=6, leading=18)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                    fontSize=11.5, textColor=INK, spaceBefore=10, spaceAfter=4, leading=14)
BODY = ParagraphStyle("Body", parent=ss["Normal"], fontName="Helvetica",
                      fontSize=9.8, textColor=INK, leading=14, spaceAfter=5, alignment=TA_LEFT)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=8.5, textColor=MUTE, leading=12)
BULLET = ParagraphStyle("Bullet", parent=BODY, spaceAfter=2)
CODE = ParagraphStyle("Code", parent=ss["Code"], fontName="Courier", fontSize=8.3,
                      textColor=INK, leading=11.5)
TITLE = ParagraphStyle("Title", parent=ss["Title"], fontName="Helvetica-Bold",
                       fontSize=26, textColor=BRAND, leading=30, spaceAfter=2)
SUBT = ParagraphStyle("Subt", parent=BODY, fontSize=12, textColor=INK, leading=16)


def code(txt):
    t = Table([[Preformatted(txt, CODE)]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODEBG),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def callout(label, html, bg, bar):
    inner = [Paragraph(f'<b>{label}</b>', ParagraphStyle("cl", parent=BODY, textColor=bar, spaceAfter=2)),
             Paragraph(html, BODY)]
    t = Table([[inner]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, bar),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def note(html):  return callout("NOTA", html, NOTEBG, colors.HexColor("#2b6cb0"))
def warn(html):  return callout("IMPORTANTE", html, WARNBG, colors.HexColor("#b7791f"))
def ok(html):    return callout("OK", html, OKBG, colors.HexColor("#2f855a"))


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, BULLET), leftIndent=10, value="•") for i in items],
        bulletType="bullet", start="•", leftIndent=12, bulletFontSize=8,
    )


def kv_table(rows, c0=55 * mm, c1=110 * mm, head=None):
    data = []
    if head:
        data.append([Paragraph(f"<b>{head[0]}</b>", SMALL), Paragraph(f"<b>{head[1]}</b>", SMALL)])
    for k, v in rows:
        data.append([Paragraph(k, ParagraphStyle("k", parent=SMALL, fontName="Courier", textColor=INK)),
                     Paragraph(v, SMALL)])
    t = Table(data, colWidths=[c0, c1])
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f7f3ee")) if head else ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    t.setStyle(TableStyle(style))
    return t


story = []
S = story.append

# ---------------- COVER ----------------
S(Spacer(1, 30 * mm))
S(Paragraph("MenuFlow", TITLE))
S(Paragraph("Guida al deploy <b>gratuito</b> per testare online", SUBT))
S(Spacer(1, 4))
S(Paragraph("Supabase (Free) + Vercel (Hobby) &mdash; pronta da seguire passo&nbsp;passo", SMALL))
S(Spacer(1, 8))
S(HRFlowable(width="100%", thickness=2, color=BRAND))
S(Spacer(1, 10))
S(Paragraph(
    "Questa guida ti porta da zero a un'istanza di MenuFlow <b>online e testabile</b> "
    "usando solo i piani gratuiti. Quando sarai pronto per la produzione commerciale, "
    "in fondo trovi cosa cambiare e i costi dei piani a pagamento.", BODY))
S(Spacer(1, 6))
S(ok("Si pu&ograve; testare tutto online a costo zero, <b>anche senza comprare un dominio</b>: "
     "i menu dei locali si raggiungono via percorso (es. <font face='Courier'>tuo-app.vercel.app/pizzeria-mario</font>). "
     "I sottodomini personalizzati servono solo per la produzione."))
S(Spacer(1, 8))
S(warn("I piani gratuiti hanno una clausola d'uso: <b>Vercel Hobby &egrave; solo per progetti non commerciali</b> "
       "e <b>Supabase Free mette in pausa il progetto dopo ~1 settimana di inattivit&agrave;</b> (si riattiva con un clic). "
       "Perfetti per <b>testare</b>; per andare live a pagamento passa a Vercel Pro + Supabase Pro (vedi cap. 9)."))

S(PageBreak())

# ---------------- 0. Panoramica ----------------
S(Paragraph("Cosa ti serve (account, tutti con piano gratuito)", H1))
S(bullets([
    "<b>GitHub</b> &mdash; per ospitare il codice (Vercel deploya da qui).",
    "<b>Vercel</b> (piano Hobby) &mdash; hosting dell'app Next.js.",
    "<b>Supabase</b> (piano Free) &mdash; database PostgreSQL, autenticazione e storage.",
    "<b>Telegram</b> &mdash; i due bot (Ordini e Pagamenti) che hai gi&agrave; creato. Opzionale ma consigliato.",
    "<b>Stripe</b> &mdash; solo se vuoi testare i pagamenti reali. Per il primo giro puoi saltarlo.",
]))
S(note("Tempo stimato: <b>30&ndash;45 minuti</b>. Non serve carta di credito per i piani gratuiti."))

# ---------------- 1. GitHub ----------------
S(Paragraph("1) Metti il codice su GitHub", H1))
S(Paragraph("Dalla cartella del progetto, crea un repository (privato) e fai il push:", BODY))
S(code(
    "git init\n"
    "git add -A\n"
    'git commit -m "MenuFlow"\n'
    "# crea un repo vuoto su github.com, poi:\n"
    "git branch -M main\n"
    "git remote add origin https://github.com/TUO-UTENTE/menuflow.git\n"
    "git push -u origin main"))
S(warn("Verifica che il file <font face='Courier'>.gitignore</font> escluda "
       "<font face='Courier'>.env.local</font> e <font face='Courier'>node_modules</font> "
       "(gi&agrave; configurato nel progetto): le chiavi segrete NON devono finire su GitHub."))

# ---------------- 2. Supabase ----------------
S(Paragraph("2) Crea il progetto Supabase (Free)", H1))
S(Paragraph("2.1 &mdash; Nuovo progetto", H2))
S(bullets([
    "Vai su <font face='Courier'>app.supabase.com</font> &rarr; <b>New project</b>.",
    "Scegli una <b>Region</b> vicina (es. <i>Central EU &mdash; Frankfurt</i>).",
    "Imposta e <b>salva</b> la <b>Database Password</b> (ti servir&agrave;).",
    "Attendi ~2 minuti che il progetto sia pronto.",
]))
S(Paragraph("2.2 &mdash; Copia le chiavi (Settings &rarr; API)", H2))
S(kv_table([
    ("Project URL", "&rarr; <font face='Courier'>NEXT_PUBLIC_SUPABASE_URL</font>"),
    ("anon public", "&rarr; <font face='Courier'>NEXT_PUBLIC_SUPABASE_ANON_KEY</font>"),
    ("service_role", "&rarr; <font face='Courier'>SUPABASE_SERVICE_ROLE_KEY</font> (segreta, solo server)"),
], head=("Valore in Supabase", "Variabile d'ambiente")))
S(Spacer(1, 6))
S(Paragraph("2.3 &mdash; Applica lo schema del database", H2))
S(Paragraph("Apri <b>SQL Editor</b> e incolla/esegui i file di migrazione <b>in ordine</b>, "
            "uno alla volta (li trovi nella cartella <font face='Courier'>supabase/migrations/</font>):", BODY))
S(bullets([
    "<font face='Courier'>0001_init.sql</font> &mdash; tabelle, RLS e bucket storage <font face='Courier'>menu-photos</font>.",
    "<font face='Courier'>0002_branding.sql</font> &mdash; campo sottotitolo.",
    "<font face='Courier'>0003_telegram_topics.sql</font> &mdash; id dei Topic Telegram.",
    "<font face='Courier'>0004_kitchen.sql</font> &mdash; stato cucina (pronto/servito).",
    "&hellip; e ogni altra migrazione presente: applicale <b>tutte, in ordine numerico</b>.",
]))
S(note("In alternativa, con la Supabase CLI: <font face='Courier'>supabase link --project-ref &lt;ref&gt;</font> "
       "poi <font face='Courier'>supabase db push</font> applica tutte le migrazioni automaticamente."))
S(Paragraph("2.4 &mdash; (Opzionale) Dati demo", H2))
S(Paragraph("Per partire con due locali di esempio, esegui nel SQL Editor il contenuto di "
            "<font face='Courier'>supabase/seed.sql</font>.", BODY))
S(Paragraph("2.5 &mdash; Crea gli utenti (login dashboard/admin)", H2))
S(Paragraph("Modo semplice dalla dashboard Supabase: <b>Authentication &rarr; Users &rarr; Add user</b> "
            "(spunta <i>Auto Confirm</i>). Crea ad es. l'admin e i ristoratori. Poi collega ogni "
            "ristoratore al suo locale impostando <font face='Courier'>owner_id</font> via SQL:", BODY))
S(code(
    "-- prendi l'id utente da Authentication > Users\n"
    "update restaurants set owner_id = '<USER_ID>' where slug = 'pizzeria-mario';"))
S(note("Modo automatico: esegui in locale lo script "
       "<font face='Courier'>scripts/seed-users.mjs</font> puntando alle chiavi del progetto cloud "
       "(URL + service_role) &mdash; crea gli utenti demo e collega gli owner."))

# ---------------- 3. Vercel ----------------
S(Paragraph("3) Deploy su Vercel (Hobby)", H1))
S(bullets([
    "Vai su <font face='Courier'>vercel.com</font> &rarr; <b>Add New&hellip; &rarr; Project</b> &rarr; importa il repo GitHub.",
    "Framework: <b>Next.js</b> (rilevato in automatico). Lascia i comandi di default.",
    "Apri <b>Environment Variables</b> e aggiungi quelle dell'appendice (cap. 10).",
    "Premi <b>Deploy</b>. Dopo ~1&ndash;2 minuti avrai un URL <font face='Courier'>https://&lt;nome&gt;.vercel.app</font>.",
]))
S(warn("Imposta <font face='Courier'>ADMIN_EMAILS</font> con la tua email (quella con cui accedi a /admin) "
       "e <font face='Courier'>ROOT_DOMAIN</font> col tuo dominio quando lo avrai (per ora lascialo pure "
       "<font face='Courier'>menuflow.it</font>: non blocca il test via percorso)."))

# ---------------- 4. Come aprirlo ----------------
S(Paragraph("4) Come raggiungere l'app (senza dominio)", H1))
S(Paragraph("Per <b>testare</b> non serve comprare nulla. Usa l'URL <font face='Courier'>.vercel.app</font>:", BODY))
S(kv_table([
    ("Menu di un locale", "<font face='Courier'>https://&lt;app&gt;.vercel.app/pizzeria-mario</font>"),
    ("Dashboard ristoratore", "<font face='Courier'>https://&lt;app&gt;.vercel.app/dashboard</font>"),
    ("Pannello admin", "<font face='Courier'>https://&lt;app&gt;.vercel.app/admin</font>"),
], c0=55 * mm, c1=110 * mm, head=("Cosa", "Indirizzo")))
S(Spacer(1, 6))
S(note("Il routing per <b>sottodominio</b> (es. <font face='Courier'>pizzeria-mario.tuodominio.it</font>) "
       "funziona uguale, ma richiede un dominio tuo con wildcard (cap. 5). Per il test, il percorso "
       "<font face='Courier'>/slug</font> &egrave; il modo pi&ugrave; rapido e gratuito."))

# ---------------- 5. Dominio ----------------
S(Paragraph("5) (Produzione) Dominio personalizzato + sottodomini", H1))
S(bullets([
    "Compra un dominio (es. <font face='Courier'>menuflow.it</font>).",
    "Su Vercel: <b>Project &rarr; Settings &rarr; Domains</b> &rarr; aggiungi il dominio <b>e</b> il wildcard "
    "<font face='Courier'>*.tuodominio.it</font>.",
    "Aggiorna la DNS come indicato da Vercel (record per il dominio + wildcard).",
    "Imposta la env <font face='Courier'>ROOT_DOMAIN = tuodominio.it</font> e fai redeploy.",
]))
S(Paragraph("Da quel momento ogni locale ha il suo <font face='Courier'>slug.tuodominio.it</font>, e i "
            "domini personalizzati dei clienti si gestiscono dalla tabella <font face='Courier'>custom_domains</font>.", BODY))

# ---------------- 6. Telegram & Stripe ----------------
S(Paragraph("6) Notifiche Telegram e Pagamenti", H1))
S(Paragraph("6.1 &mdash; Telegram", H2))
S(bullets([
    "Aggiungi su Vercel le env <font face='Courier'>TELEGRAM_BOT_ORDINI_TOKEN</font> e "
    "<font face='Courier'>TELEGRAM_BOT_PAGAMENTI_TOKEN</font> (i bot che hai gi&agrave;).",
    "I <font face='Courier'>chat_id</font> / Topic dei locali sono nel database (colonne "
    "<font face='Courier'>telegram_chat_*</font> / <font face='Courier'>telegram_topic_*</font>).",
]))
S(Paragraph("6.2 &mdash; Stripe (opzionale al primo test)", H2))
S(bullets([
    "Per il primo giro puoi tenere i pagamenti <b>disattivati</b> (<font face='Courier'>pagamenti_attivi=false</font>): "
    "gli ordini arrivano come &laquo;ricevuto&raquo; sul bot Ordini.",
    "Per i pagamenti reali servono le chiavi Stripe e i due webhook (Connect e Billing) puntati agli URL "
    "pubblici Vercel <font face='Courier'>/api/stripe/connect-webhook</font> e "
    "<font face='Courier'>/api/stripe/billing-webhook</font>.",
]))
S(warn("Il simulatore di pagamento di sviluppo (<font face='Courier'>/api/dev/simulate-payment</font>) "
       "&egrave; <b>disabilitato in produzione</b>: online la verit&agrave; sul pagamento arriva solo dal webhook Stripe."))

# ---------------- 7. Checklist ----------------
S(Paragraph("7) Checklist finale", H1))
S(bullets([
    "Codice su GitHub, segreti esclusi.",
    "Progetto Supabase creato, migrazioni 0001&rarr;0003 applicate, (opz.) seed eseguito.",
    "Utenti creati e <font face='Courier'>owner_id</font> collegati.",
    "Variabili d'ambiente impostate su Vercel (cap. 10).",
    "Deploy completato: <font face='Courier'>/dashboard</font> e <font face='Courier'>/admin</font> accessibili.",
    "Un ordine di prova arriva su Telegram.",
]))

# ---------------- 8. Limiti free ----------------
S(Paragraph("8) Limiti dei piani gratuiti (in breve)", H1))
S(kv_table([
    ("Vercel Hobby", "Uso non commerciale; banda/limiti generosi per il test."),
    ("Supabase Free", "500 MB DB, 1 GB storage, 50.000 utenti/mese; pausa dopo ~7 gg di inattivit&agrave;."),
    ("Dominio", "Non necessario per testare (si usa il percorso /slug)."),
], c0=40 * mm, c1=125 * mm, head=("Servizio", "Limite principale")))

# ---------------- 9. Produzione / costi ----------------
S(Paragraph("9) Quando vai in produzione (a pagamento)", H1))
S(Paragraph("Per un uso commerciale reale, fai upgrade dei due piani e collega il dominio:", BODY))
S(kv_table([
    ("Vercel Pro", "~ $20 / mese (uso commerciale, pi&ugrave; risorse)."),
    ("Supabase Pro", "~ $25 / mese (no pausa, backup, pi&ugrave; spazio)."),
    ("Dominio", "~ €10&ndash;15 / anno."),
    ("Stripe", "Nessun canone: commissioni per transazione."),
], c0=40 * mm, c1=125 * mm, head=("Voce", "Costo indicativo")))
S(Spacer(1, 6))
S(ok("Il codice &egrave; lo stesso: passare da free a pagamento &egrave; un upgrade di piano + "
     "il collegamento del dominio. Nessuna riscrittura."))

# ---------------- 10. Appendice env ----------------
S(PageBreak())
S(Paragraph("10) Appendice &mdash; Variabili d'ambiente (Vercel)", H1))
S(Paragraph("Imposta queste in <b>Project &rarr; Settings &rarr; Environment Variables</b>. "
            "Le <font face='Courier'>NEXT_PUBLIC_*</font> sono pubbliche; le altre sono segrete (solo server).", BODY))
S(kv_table([
    ("NEXT_PUBLIC_SUPABASE_URL", "Project URL di Supabase. <b>Obbligatoria</b>."),
    ("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Chiave anon di Supabase. <b>Obbligatoria</b>."),
    ("SUPABASE_SERVICE_ROLE_KEY", "Chiave service_role (segreta). <b>Obbligatoria</b>."),
    ("ADMIN_EMAILS", "Email ammesse in /admin (separate da virgola). <b>Obbligatoria</b>."),
    ("ROOT_DOMAIN", "Dominio radice (es. menuflow.it). Per il test va bene il default."),
    ("TELEGRAM_BOT_ORDINI_TOKEN", "Token bot Ordini. Consigliata."),
    ("TELEGRAM_BOT_PAGAMENTI_TOKEN", "Token bot Pagamenti. Consigliata."),
    ("STRIPE_SECRET_KEY", "Chiave Stripe. Solo se usi i pagamenti."),
    ("STRIPE_CONNECT_WEBHOOK_SECRET", "Firma webhook Connect. Solo con pagamenti."),
    ("STRIPE_BILLING_WEBHOOK_SECRET", "Firma webhook Billing. Solo con abbonamenti."),
    ("STRIPE_PRICE_BASE / PLUS / PRO", "Price ID dei piani Billing. Solo con abbonamenti."),
    ("STRIPE_PRICE_MULTILINGUA", "Price ID add-on multilingua. Solo con abbonamenti."),
], c0=72 * mm, c1=93 * mm, head=("Variabile", "Descrizione")))
S(Spacer(1, 10))
S(HRFlowable(width="100%", thickness=1, color=LINE))
S(Spacer(1, 4))
S(Paragraph("MenuFlow &mdash; guida al deploy gratuito. Documento generato automaticamente.", SMALL))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTE)
    canvas.drawString(20 * mm, 12 * mm, "MenuFlow — Deploy gratuito (Supabase + Vercel)")
    canvas.drawRightString(190 * mm, 12 * mm, f"Pag. {doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canvas.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=20 * mm, rightMargin=20 * mm,
                      topMargin=18 * mm, bottomMargin=20 * mm,
                      title="MenuFlow - Deploy gratuito", author="MenuFlow")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
doc.build(story)
print("PDF scritto:", OUT)
