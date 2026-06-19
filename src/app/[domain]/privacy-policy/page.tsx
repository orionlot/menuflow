/* eslint-disable @next/next/no-html-link-for-pages --
   Tenant-relative links resolved via the Host-based middleware rewrite; full
   <a> navigation is required (a <Link> would match the [domain] dynamic root). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { resolveTenant } from "@/lib/tenant";
import { resolveDatiLegali } from "@/lib/legal";
import PolicyShell, { Sec, Row } from "../PolicyShell";

type Params = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { domain } = await params;
  const tenant = await resolveTenant(domain);
  return { title: tenant ? `Privacy Policy — ${tenant.nome}` : "Privacy Policy" };
}

export default async function PrivacyPolicyPage({ params }: Params) {
  const { domain } = await params;
  const tenant = await resolveTenant(domain);
  if (!tenant) notFound();

  const host = (await headers()).get("host");
  const legali = resolveDatiLegali(tenant, host);
  const pagamenti = tenant.pagamenti_attivi;
  const contatto = legali.email ?? "il Titolare";

  return (
    <PolicyShell nome={tenant.nome} titolo="Privacy Policy" aggiornatoIl={legali.aggiornatoIl}>
      <p>
        La presente informativa descrive le modalità di trattamento dei dati personali degli
        utenti che consultano il menu digitale, effettuano un ordine o richiedono una prenotazione,
        ai sensi del Regolamento (UE) 2016/679 (&quot;GDPR&quot;).
      </p>

      <Sec title="Titolare del trattamento">
        <Row label="Titolare" value={legali.titolare} />
        <Row label="Indirizzo" value={legali.indirizzo} />
        <Row label="Sede legale" value={legali.sedeLegale} />
        <Row label="P.IVA / C.F." value={legali.piva} />
        <Row label="Email" value={legali.email} />
        <Row label="PEC" value={legali.pec} />
        <Row label="Telefono" value={legali.telefono} />
        <Row label="Sito" value={legali.dominio} />
      </Sec>

      <Sec title="Dati personali che raccogliamo">
        <p>Trattiamo solo i dati necessari a fornire il servizio:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-semibold text-neutral-900">Dati dell&apos;ordine</span>: numero
            del tavolo o nome per il ritiro, prodotti scelti ed eventuali note (incluse eventuali
            indicazioni su allergie, fornite volontariamente).
          </li>
          <li>
            <span className="font-semibold text-neutral-900">Consegna a domicilio</span> (se
            attiva): indirizzo di consegna ed eventuale posizione geografica, forniti volontariamente.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">Prenotazioni</span> (se attive): nome,
            telefono, data, ora e numero di persone.
          </li>
          <li>
            <span className="font-semibold text-neutral-900">Dati di navigazione</span>: dati
            tecnici raccolti tramite cookie, come descritto nella{" "}
            <a href="/cookie-policy" className="font-medium text-neutral-900 underline">Cookie Policy</a>.
          </li>
        </ul>
        <p>
          Non raccogliamo categorie particolari di dati (origine etnica, opinioni, salute, ecc.)
          salvo le informazioni su allergie che l&apos;utente decide liberamente di comunicare per
          la propria sicurezza alimentare.
        </p>
      </Sec>

      <Sec title="Destinatari e servizi di terze parti">
        <p>
          I dati sono trattati dal personale del locale e possono essere comunicati ai seguenti
          fornitori che agiscono come responsabili del trattamento:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-semibold text-neutral-900">MenuFlow</span> — fornitore della
            piattaforma di menu e ordinazioni (hosting e gestione tecnica).
          </li>
          <li>
            <span className="font-semibold text-neutral-900">Telegram</span> — utilizzato per
            recapitare al locale le notifiche di nuovi ordini e prenotazioni.
          </li>
          {pagamenti && (
            <li>
              <span className="font-semibold text-neutral-900">Stripe</span> — gestione dei
              pagamenti online; i dati della carta non sono mai memorizzati su questo sito.
            </li>
          )}
        </ul>
      </Sec>

      <Sec title="Finalità e base giuridica">
        <ul className="list-disc space-y-1 pl-5">
          <li>Gestione di ordini e prenotazioni — esecuzione di un contratto/servizio richiesto.</li>
          <li>Invio delle notifiche operative al locale — esecuzione del servizio.</li>
          {pagamenti && <li>Gestione dei pagamenti — esecuzione del contratto e obblighi di legge.</li>}
          <li>Cookie non necessari — consenso dell&apos;utente.</li>
          <li>Adempimenti amministrativi e contabili — obbligo di legge.</li>
        </ul>
      </Sec>

      <Sec title="Conservazione dei dati">
        <p>
          I dati sono conservati per il tempo strettamente necessario alle finalità indicate e nel
          rispetto dei termini di legge (in particolare quelli fiscali e contabili), secondo il
          principio di limitazione della conservazione (art. 5 GDPR).
        </p>
      </Sec>

      <Sec title="Minori">
        <p>
          Il servizio non è rivolto ai minori di 14 anni. Per i minori, il trattamento presuppone
          il consenso di chi esercita la responsabilità genitoriale, ai sensi dell&apos;art. 8 GDPR.
        </p>
      </Sec>

      <Sec title="Diritti dell'interessato">
        <p>In ogni momento puoi esercitare i diritti previsti dagli artt. 15-22 GDPR:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>accesso ai tuoi dati e conferma del trattamento;</li>
          <li>rettifica e aggiornamento;</li>
          <li>cancellazione (&quot;diritto all&apos;oblio&quot;);</li>
          <li>limitazione del trattamento;</li>
          <li>portabilità dei dati;</li>
          <li>opposizione al trattamento (art. 21);</li>
          <li>revoca del consenso in qualsiasi momento;</li>
          <li>reclamo all&apos;Autorità Garante per la protezione dei dati personali.</li>
        </ul>
        <p>Per esercitare i tuoi diritti puoi contattare {contatto}.</p>
      </Sec>

      <Sec title="Revoca del consenso ai cookie">
        <p>
          Puoi revocare o modificare il consenso ai cookie in qualsiasi momento tramite l&apos;icona
          a forma di biscotto sul menu. Per i dettagli, consulta la{" "}
          <a href="/cookie-policy" className="font-medium text-neutral-900 underline">Cookie Policy</a>.
        </p>
      </Sec>
    </PolicyShell>
  );
}
