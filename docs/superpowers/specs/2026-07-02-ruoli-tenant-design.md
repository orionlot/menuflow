# Ruoli per tenant — All view / Cameriere / Cuoco

**Data:** 2026-07-02 · **Approvato:** sì (chat)

## Obiettivo
Dopo il login, il ristoratore sceglie la modalità del dispositivo: **All view**
(tutto), **Cameriere** (Sala/Ordini/Conti/Prenotazioni), **Cuoco** (solo
Cucina/KDS). È un filtro di **focus**, non una barriera di sicurezza: stesso
account, nessun PIN — chiunque può cambiare ruolo dallo switch.

## Modello
- Cookie **`mf_ruolo`** (httpOnly, sameSite=lax, path=/, ~180 giorni).
  Valori: `all` | `cameriere` | `cuoco`. Niente localStorage (vincolo progetto).
- Nessuna migrazione DB, nessun nuovo utente auth.

| Ruolo | Path consentiti (prefissi) | Home |
|---|---|---|
| all | tutto `/dashboard/*` | `/dashboard` |
| cameriere | `sala`, `ordini`, `conti`, `prenotazioni`, `stampa`, `ruolo`, `login` | `/dashboard/sala` |
| cuoco | `cucina`, `ruolo`, `login` | `/dashboard/cucina` |
| (nessun cookie) | solo `ruolo`, `login` → forza la schermata di scelta | `/dashboard/ruolo` |

## Componenti
1. **`src/lib/ruoli.ts`** — helper puro: `RUOLI`, `parseRuolo(v)`,
   `homeForRole(r)`, `allowedForRole(pathname, r)`. Test vitest dedicato.
2. **Middleware** (`src/middleware.ts`, ramo `/dashboard`): legge il cookie
   dalla request e applica `allowedForRole` — path non consentito → redirect
   alla home del ruolo; cookie assente → redirect a `/dashboard/ruolo`.
   **Nessuna query DB** (il middleware resta a costo zero).
3. **Picker `/dashboard/ruolo`** (fuori dal gruppo `(app)`, senza sidebar):
   `requireOwner`, 3 card grandi tap-friendly (All view 👁 / Cameriere 🤵 /
   Cuoco 👨‍🍳), ogni card è un form → server action `setRuolo(r)` che valida,
   scrive il cookie e fa redirect alla home del ruolo.
4. **Sidebar** (`DashboardSidebar.tsx`): filtra le voci per ruolo (cameriere
   vede solo le sue 4 sezioni; i filtri feature-flag esistenti restano) +
   switch "Ruolo" in fondo (link a `/dashboard/ruolo`).
5. **KDS** (`cucina/KitchenClient.tsx`): link discreto "Cambia ruolo" nella
   testata → `/dashboard/ruolo`.

## Edge case
- Feature flag off (es. sala disattiva) per un cameriere: la pagina mostra già
  il placeholder "attiva la funzione" — accettabile, nessun check flag nel
  middleware.
- Server action POST: avvengono sempre sulla pagina corrente (consentita), il
  redirect di middleware non le intercetta.
- Login: nessuna modifica — dopo il login il middleware instrada per ruolo.
- Admin (`/admin`) non toccato.
