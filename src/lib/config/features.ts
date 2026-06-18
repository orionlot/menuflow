import type { PlanId } from "@/lib/config/plans";

/**
 * Optional features the restaurateur (and admin) can switch on/off. Three layers:
 *  1. PLAN — `pianoMinimo` defines whether the plan includes it by default.
 *  2. ADMIN — `funzionalita_admin[id]` can grant/revoke per tenant (overrides plan).
 *  3. OWNER — `funzionalita[id]` is the restaurateur's switch, within entitlement.
 * Effective ON = entitled AND owner switch (or `defaultOn` if untouched).
 */
export type FeatureId =
  | "piatto_consigliato"
  | "recensioni"
  | "profilo_allergie"
  | "orari"
  | "stampa"
  | "feedback"
  | "riepilogo"
  | "scorte"
  | "componibili"
  | "descrizione"
  | "ingredienti"
  | "asporto"
  | "reparto"
  | "prezzo_asporto"
  | "etichette"
  | "fasce_orarie"
  | "tracking_ordine"
  | "richiesta_servizio"
  | "delivery"
  | "ordine_manuale"
  | "sala"
  | "conti"
  | "tempo_stimato"
  | "attesa_stimata"
  | "peso"
  | "kcal"
  | "allergeni_ordine"
  | "sala_ordine"
  | "stampa_automatica"
  | "vetrina";

export interface FeatureDef {
  id: FeatureId;
  nome: string;
  descrizione: string;
  /** Lowest plan that includes it by default. */
  pianoMinimo: PlanId;
  /** Switch state once entitled and the owner hasn't chosen yet. */
  defaultOn: boolean;
}

const PLAN_RANK: Record<PlanId, number> = { base: 0, plus: 1, pro: 2 };

export const FEATURES: FeatureDef[] = [
  {
    id: "piatto_consigliato",
    nome: "Piatto consigliato",
    descrizione: "Badge “★ Consigliato” sulle voci che metti in evidenza.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "recensioni",
    nome: "Spinta recensioni Google",
    descrizione: "Dopo l’ordine invita il cliente a lasciare una recensione Google.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "profilo_allergie",
    nome: "Profilo allergie",
    descrizione:
      "Il cliente seleziona le sue allergie e le voci a rischio vengono evidenziate.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "orari",
    nome: "Orari di apertura",
    descrizione: "Mostra aperto/chiuso e blocca gli ordini fuori orario.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "stampa",
    nome: "Stampa comanda",
    descrizione: "Pulsante per stampare il biglietto dell’ordine (qualsiasi stampante).",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "feedback",
    nome: "Feedback post-ordine",
    descrizione: "Voto a stelle dopo l’ordine, raccolto nella dashboard.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "riepilogo",
    nome: "Riepilogo giornaliero",
    descrizione: "Recap di fine giornata: incasso, ordini, scontrini da battere.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "scorte",
    nome: "Scorte semplici",
    descrizione: "Porzioni disponibili al giorno, con auto-esaurito a zero.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "componibili",
    nome: "Prodotti componibili",
    descrizione:
      "Categorie componibili dagli ingredienti, con scorta per ingrediente.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "descrizione",
    nome: "Descrizione breve",
    descrizione: "Campo descrizione sul prodotto, mostrato sotto il nome nel menu.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "ingredienti",
    nome: "Ingredienti del prodotto",
    descrizione:
      "Spunta gli ingredienti del piatto: compaiono in elenco, separati da virgola.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "asporto",
    nome: "Ordini da asporto",
    descrizione:
      "Il cliente sceglie «Da asporto» col nome per il ritiro; se i pagamenti sono attivi può pagare in cassa.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "reparto",
    nome: "Reparti cucina",
    descrizione:
      "Assegna ogni piatto a un reparto (Pizzeria, Cucina, Friggitoria…) e filtra la Cucina per reparto.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "prezzo_asporto",
    nome: "Prezzo asporto",
    descrizione: "Prezzo separato per asporto/delivery, diverso dal prezzo al tavolo.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "etichette",
    nome: "Etichette piatti",
    descrizione:
      "Tag riutilizzabili (Vegetariano, Senza lattosio, Piccante…) mostrati sul menu pubblico.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "vetrina",
    nome: "Vetrina in homepage",
    descrizione:
      "Carosello in cima al menu con i prodotti che scegli (del giorno, di stagione…), con annuncio personalizzabile per ciascuno.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "fasce_orarie",
    nome: "Solo pranzo / cena",
    descrizione: "Mostra un piatto solo a pranzo o solo a cena.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "tracking_ordine",
    nome: "Segui il tuo ordine",
    descrizione:
      "Il cliente segue lo stato del suo ordine (ricevuto → in preparazione → pronto → servito).",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "richiesta_servizio",
    nome: "Chiama cameriere / conto",
    descrizione: "Dal menu il cliente può chiamare il cameriere o chiedere il conto al tavolo.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "delivery",
    nome: "Consegna a domicilio",
    descrizione: "Aggiunge «Delivery» come tipo d’ordine, con indirizzo di consegna.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "ordine_manuale",
    nome: "Ordine manuale (cassa)",
    descrizione: "Crea un ordine dalla dashboard (cameriere/cassa), pagato al banco.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "sala",
    nome: "Mappa sala / tavoli",
    descrizione: "Disegna la sala e avvia un ordine toccando un tavolo.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "conti",
    nome: "Estingui conto",
    descrizione:
      "Raggruppa gli ordini per tavolo e chiudi il conto, con stampa e divisione alla romana.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "tempo_stimato",
    nome: "Tempi di preparazione",
    descrizione:
      "Countdown in cucina, smaltimento coda e avvisi quando la stima scade. Usa il tempo del piatto o, in mancanza, la media della categoria.",
    pianoMinimo: "base",
    defaultOn: true,
  },
  {
    id: "attesa_stimata",
    nome: "Attesa stimata al cliente",
    descrizione:
      "Mostra al cliente il tempo stimato per il servizio sul menu e nel carrello (richiede i Tempi di preparazione).",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "peso",
    nome: "Peso di piatti e ingredienti",
    descrizione: "Mostra sul menu il peso (g) dei piatti e, dove presente, dei singoli ingredienti.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "kcal",
    nome: "Calorie (kcal)",
    descrizione: "Mostra sul menu le calorie dei piatti e, dove presente, dei singoli ingredienti.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "allergeni_ordine",
    nome: "Allergeni in ordine",
    descrizione:
      "Il cliente può segnalare gli allergeni del tavolo alla conferma; l'ordine viene evidenziato in cucina.",
    pianoMinimo: "base",
    defaultOn: false,
  },
  {
    id: "sala_ordine",
    nome: "Scelta della sala dal cliente",
    descrizione: "Oltre al tavolo, il cliente sceglie la sala in cui si trova; compare anche in cucina.",
    pianoMinimo: "plus",
    defaultOn: false,
  },
  {
    id: "stampa_automatica",
    nome: "Stampa automatica comande",
    descrizione:
      "Stampa la comanda da sola appena arriva un ordine, in Cucina e in Ordini. Per la stampa senza finestra di dialogo apri la pagina in Chrome con --kiosk-printing.",
    pianoMinimo: "base",
    defaultOn: false,
  },
];

export const FEATURES_BY_ID = new Map(FEATURES.map((f) => [f.id, f]));

interface FeatureCtx {
  piano: PlanId;
  funzionalita?: Record<string, boolean> | null;
  funzionalita_admin?: Record<string, boolean> | null;
}

export function planAllows(piano: PlanId, id: FeatureId): boolean {
  const f = FEATURES_BY_ID.get(id);
  return f ? PLAN_RANK[piano] >= PLAN_RANK[f.pianoMinimo] : false;
}

/** Whether the tenant is ALLOWED to use a feature (plan default; admin can override). */
export function isEntitled(r: FeatureCtx, id: FeatureId): boolean {
  const override = r.funzionalita_admin?.[id];
  if (typeof override === "boolean") return override;
  return planAllows(r.piano, id);
}

/** Whether a feature is actually ACTIVE (entitled AND switched on by the owner). */
export function isFeatureOn(r: FeatureCtx, id: FeatureId): boolean {
  if (!isEntitled(r, id)) return false;
  const v = r.funzionalita?.[id];
  return typeof v === "boolean" ? v : (FEATURES_BY_ID.get(id)?.defaultOn ?? false);
}

/** Effective on/off map for every feature — for the public menu / behaviours. */
export function funzioniAttive(r: FeatureCtx): Record<FeatureId, boolean> {
  const out = {} as Record<FeatureId, boolean>;
  for (const f of FEATURES) out[f.id] = isFeatureOn(r, f.id);
  return out;
}

/** Whitelist a stored/incoming map to known feature ids with boolean values. */
export function sanitizeFunzionalita(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (raw && typeof raw === "object") {
    for (const f of FEATURES) {
      const v = (raw as Record<string, unknown>)[f.id];
      if (typeof v === "boolean") out[f.id] = v;
    }
  }
  return out;
}
