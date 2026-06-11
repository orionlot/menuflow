import type { Metadata } from "next";
import { appOrigin } from "@/lib/origin";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Guida rapida — MenuFlow" };

export const dynamic = "force-dynamic";

const STEPS: { titolo: string; testo: string }[] = [
  {
    titolo: "1 · Accedi alla tua dashboard",
    testo:
      "Vai su /dashboard e accedi con l'email e la password scelte in fase di registrazione. È il pannello da cui gestisci tutto.",
  },
  {
    titolo: "2 · Personalizza l'aspetto",
    testo:
      "In “Aspetto” scegli uno Stile pronto (Trattoria, Moderno, Elegante…), i colori, il logo e la tipografia. Vedi l'anteprima dal vivo e salva.",
  },
  {
    titolo: "3 · Crea il tuo menu",
    testo:
      "In “Menu” trovi alcune voci d'esempio già pronte: rinominale, cambia prezzi e descrizioni, aggiungi le tue, carica le foto e trascina per riordinare. Imposta allergeni e varianti dove servono.",
  },
  {
    titolo: "4 · Genera i QR per i tavoli",
    testo:
      "In “QR” scarichi i codici QR (anche per singolo tavolo) da stampare e mettere sui tavoli: il cliente inquadra e vede subito il menu.",
  },
  {
    titolo: "5 · Ricevi gli ordini",
    testo:
      "Gli ordini arrivano in “Ordini” (con avviso sonoro e badge) e nel “Kitchen Display” per la cucina. Puoi collegare anche il bot Telegram per riceverli sul telefono.",
  },
  {
    titolo: "6 · Attiva le funzioni che vuoi",
    testo:
      "In “Funzionalità” accendi o spegni ciò che ti serve (piatto consigliato, orari di apertura, stampa comanda, ecc.) in base al tuo piano.",
  },
  {
    titolo: "Pagamenti al tavolo (opzionale)",
    testo:
      "Se vuoi far pagare online, i pagamenti si attivano separatamente. Lo scontrino fiscale lo batti sempre tu con il tuo registratore di cassa: l'app non emette corrispettivi.",
  },
];

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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-neutral-800">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <span className="text-sm text-neutral-500">Guida rapida</span>
        <PrintButton />
      </div>

      <h1 className="text-2xl font-bold">Benvenuto in MenuFlow — {nome}</h1>
      <p className="mt-2 text-neutral-600">
        Questa guida ti porta dall’attivazione al primo ordine. Tienila a portata di mano
        (puoi salvarla in PDF con il pulsante in alto).
      </p>

      <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <div className="grid gap-1">
          <div>
            <span className="text-neutral-500">Il tuo menu pubblico:</span>{" "}
            <span className="font-medium">{menuUrl}</span>
          </div>
          <div>
            <span className="text-neutral-500">La tua dashboard:</span>{" "}
            <span className="font-medium">{dashUrl}</span>
          </div>
        </div>
      </div>

      <ol className="mt-6 space-y-4">
        {STEPS.map((s) => (
          <li key={s.titolo} className="rounded-xl border border-neutral-200 p-4">
            <h2 className="font-semibold">{s.titolo}</h2>
            <p className="mt-1 text-sm text-neutral-600">{s.testo}</p>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-center text-xs text-neutral-400">
        MenuFlow — guida rapida per {nome}.
      </p>
    </main>
  );
}
