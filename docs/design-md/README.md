# Libreria DESIGN.md — riferimenti di design system

Raccolta **vendored** (copiata nel repo) di file `DESIGN.md`: documenti di design-system in
markdown — colori, token, tipografia e regole — estratti da brand reali. Servono come
**materiale di riferimento** per generare UI coerenti con un'estetica specifica.

> Un `DESIGN.md` è un concetto introdotto da Google Stitch: un documento di design in
> testo semplice che un AI agent legge per produrre interfacce visivamente coerenti.

## Provenienza e licenza

- Fonte: **VoltAgent / awesome-design-md** — https://github.com/VoltAgent/awesome-design-md
- Commit copiato: `664b3e7`
- Licenza: **MIT** (© 2026 VoltAgent) — vedi [`LICENSE`](LICENSE).

Questa è solo una **libreria di consultazione**: non cambia il design attuale di MenuFlow e
non viene importata da nessun codice.

## Come si usa

Quando vuoi una pagina o un componente nello stile di un brand, apri il suo
`DESIGN.md` e chiedi all'agente di costruire la UI seguendone token e regole. Esempio:

> "Costruisci una landing page seguendo `docs/design-md/vercel/DESIGN.md`."

L'agente legge colori, tipografia, spaziature e principi di quel design system e li applica,
restando coerente con quell'estetica invece di produrre output generici.

## Brand disponibili (74)

`airbnb` · `airtable` · `apple` · `binance` · `bmw` · `bmw-m` · `bugatti` · `cal` ·
`claude` · `clay` · `clickhouse` · `cohere` · `coinbase` · `composio` · `cursor` ·
`dell-1996` · `elevenlabs` · `expo` · `ferrari` · `figma` · `framer` · `hashicorp` ·
`hp` · `ibm` · `intercom` · `kraken` · `lamborghini` · `linear.app` · `lovable` ·
`mastercard` · `meta` · `minimax` · `mintlify` · `miro` · `mistral.ai` · `mongodb` ·
`nike` · `nintendo-2001` · `notion` · `nvidia` · `ollama` · `opencode.ai` · `pinterest` ·
`playstation` · `posthog` · `raycast` · `renault` · `replicate` · `resend` · `revolut` ·
`runwayml` · `sanity` · `sentry` · `shopify` · `slack` · `spacex` · `spotify` ·
`starbucks` · `stripe` · `supabase` · `superhuman` · `tesla` · `theverge` ·
`together.ai` · `uber` · `vercel` · `vodafone` · `voltagent` · `warp` · `webflow` ·
`wired` · `wise` · `x.ai` · `zapier`

Ogni cartella contiene un `DESIGN.md` (il documento completo) e un `README.md` (sintesi +
link agli originali su getdesign.md).

## Aggiornare la libreria

Per aggiornarla, ri-scarica dal repo di origine e ricopia `design-md/` qui:

```bash
git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git /tmp/adm
cp -R /tmp/adm/design-md/. docs/design-md/ && cp /tmp/adm/LICENSE docs/design-md/LICENSE
```
