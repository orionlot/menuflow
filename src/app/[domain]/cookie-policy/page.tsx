/* eslint-disable @next/next/no-html-link-for-pages --
   Tenant-relative links resolved via the Host-based middleware rewrite; full
   <a> navigation is required (a <Link> would match the [domain] dynamic root). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { resolveTenant } from "@/lib/tenant";
import { resolveDatiLegali } from "@/lib/legal";
import { publicCookiesFor, CONSENT_CATEGORIES } from "@/lib/cookies";
import PolicyShell, { Sec, Row } from "../PolicyShell";

type Params = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { domain } = await params;
  const tenant = await resolveTenant(domain);
  return { title: tenant ? `Cookie Policy — ${tenant.nome}` : "Cookie Policy" };
}

export default async function CookiePolicyPage({ params }: Params) {
  const { domain } = await params;
  const tenant = await resolveTenant(domain);
  if (!tenant) notFound();

  const host = (await headers()).get("host");
  const legali = resolveDatiLegali(tenant, host);
  const cookies = publicCookiesFor({
    funzioni: tenant.funzioni_attive,
    pagamenti: tenant.pagamenti_attivi,
  });
  const byCat = CONSENT_CATEGORIES.map((c) => ({
    cat: c,
    list: cookies.filter((k) => k.category === c.id),
  })).filter((g) => g.list.length > 0);

  return (
    <PolicyShell nome={tenant.nome} titolo="Cookie Policy" aggiornatoIl={legali.aggiornatoIl}>
      <p>
        Questo sito utilizza cookie e tecnologie simili per garantire il corretto funzionamento
        del menu digitale e, con il tuo consenso, per ricordare le tue preferenze. Di seguito
        trovi le informazioni su quali cookie utilizziamo e come gestirli.
      </p>

      <Sec title="Cosa sono i cookie">
        <p>
          I cookie sono piccoli file di testo che i siti visitati inviano al dispositivo
          dell&apos;utente, dove vengono memorizzati per essere ritrasmessi agli stessi siti alla
          visita successiva. Possono essere di sessione (cancellati alla chiusura del browser) o
          persistenti (con una durata definita).
        </p>
      </Sec>

      <Sec title="Tipologie di cookie">
        <ul className="list-disc space-y-1 pl-5">
          {CONSENT_CATEGORIES.map((c) => (
            <li key={c.id}>
              <span className="font-semibold text-neutral-900">{c.nome}.</span> {c.descrizione}
            </li>
          ))}
        </ul>
        <p>
          I cookie necessari non richiedono consenso. Tutti gli altri vengono installati solo dopo
          il tuo consenso, prestato tramite il banner alla prima visita.
        </p>
      </Sec>

      <Sec title="Cookie utilizzati da questo sito">
        {byCat.map(({ cat, list }) => (
          <div key={cat.id} className="mt-3">
            <p className="font-semibold text-neutral-900">{cat.nome}</p>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="border-b border-neutral-200 py-1 pr-3 font-medium">Cookie</th>
                    <th className="border-b border-neutral-200 py-1 pr-3 font-medium">Fornitore</th>
                    <th className="border-b border-neutral-200 py-1 pr-3 font-medium">Durata</th>
                    <th className="border-b border-neutral-200 py-1 font-medium">Finalità</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((k) => (
                    <tr key={k.name} className="align-top">
                      <td className="border-b border-neutral-100 py-1.5 pr-3 font-mono">{k.name}</td>
                      <td className="border-b border-neutral-100 py-1.5 pr-3">{k.provider}</td>
                      <td className="border-b border-neutral-100 py-1.5 pr-3 whitespace-nowrap">{k.durata}</td>
                      <td className="border-b border-neutral-100 py-1.5">{k.scopo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Sec>

      <Sec title="Gestione e revoca del consenso">
        <p>
          Puoi modificare in qualsiasi momento le tue scelte sui cookie tramite l&apos;icona a
          forma di biscotto presente sul menu, che riapre il pannello delle preferenze. Da lì puoi
          accettare, rifiutare o personalizzare le singole categorie; revocando il consenso, i
          cookie non necessari già salvati vengono rimossi.
        </p>
        <p>
          Puoi inoltre gestire i cookie dalle impostazioni del tuo browser (Chrome, Firefox,
          Safari, Edge), dove è possibile visualizzarli, bloccarli ed eliminarli. La disattivazione
          di alcuni cookie potrebbe limitare alcune funzionalità del sito.
        </p>
      </Sec>

      <Sec title="Titolare del trattamento">
        <Row label="Titolare" value={legali.titolare} />
        <Row label="Indirizzo" value={legali.indirizzo} />
        <Row label="Sede legale" value={legali.sedeLegale} />
        <Row label="P.IVA / C.F." value={legali.piva} />
        <Row label="Email" value={legali.email} />
        <Row label="PEC" value={legali.pec} />
        <Row label="Sito" value={legali.dominio} />
      </Sec>

      <Sec title="Riferimenti normativi">
        <p>
          La presente cookie policy è redatta in conformità al Regolamento (UE) 2016/679 (GDPR),
          alla Direttiva ePrivacy 2002/58/CE e successive modifiche, e alle linee guida del Garante
          per la protezione dei dati personali. Per il trattamento dei dati personali si rimanda
          alla <a href="/privacy-policy" className="font-medium text-neutral-900 underline">Privacy Policy</a>.
        </p>
      </Sec>
    </PolicyShell>
  );
}
