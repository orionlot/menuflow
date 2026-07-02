# Admin restyle — ciano + magenta (tema chiaro)

**Data:** 2026-07-02 · **Approvato:** sì (chat)

## Obiettivo
Rendere l'area admin (`src/app/admin/`) più leggibile e visivamente distintiva:
tema chiaro con accenti **ciano** (primario) e **magenta** (secondario), gerarchia
visiva chiara, niente "muro di form".

## Direzione visiva
- Base bianco/ghiaccio (`slate-50`), testo inchiostro (`slate-900`).
- Ciano (`cyan-500/600`) = azioni, stati attivi, link, pill "attivo".
- Magenta (`fuchsia-500/600`) = alert, pill "sospeso", highlights.
- Gradiente ciano→magenta per: marchio header, numeri KPI, bottoni primari.
- Card bianche, bordi tinti delicati, ombre soft. Pill di stato colorate.

## Struttura pagina admin (`(app)/page.tsx`)
1. **Fascia KPI**: Tenant totali · Attivi · Sospesi · MRR stimato (somma prezzi
   piano dei tenant attivi, da `PLANS`) — numeri grandi in gradiente.
2. **Barra ricerca + filtri** (nome/slug; piano; stato) — filtro client-side.
3. **Card tenant compatte e richiudibili**: testata con nome, slug, pill
   piano/stato, link menu pubblico; i form (modifica, branding, funzionalità,
   elimina) si aprono on demand (collassati di default).
4. "Nuovo ristorante": bottone gradiente prominente che apre il form.
5. Stesso trattamento a `layout.tsx` (header), `admin/login`, `menu/[id]`.

## Vincoli
- **Zero cambi** a schema, server action, logica dati. Solo presentazione +
  un client component per ricerca/collapse (le action passano come props o
  restano server-rendered dentro sezioni richiudibili).
- Stringhe UI in italiano.
