import type { CSSProperties } from "react";
import { requireOwner } from "@/lib/auth";
import { adminBrandVars } from "@/lib/brand";
import { signOut } from "@/app/dashboard/actions";
import { setRuolo } from "./actions";

export const dynamic = "force-dynamic";

/** Full-screen device-role picker (outside the (app) group: no sidebar).
 *  Shown after login until a role is chosen; reachable any time from the
 *  sidebar ("Cambia ruolo") or the KDS header. */
export default async function RuoloPage() {
  const { restaurant } = await requireOwner();
  const brandVars = adminBrandVars(
    restaurant.colore_primario,
    restaurant.colore_secondario,
  ) as CSSProperties;

  const roles = [
    {
      id: "all",
      emoji: "👁️",
      label: "All view",
      desc: "Tutto il gestionale: menu, ordini, cucina, statistiche, impostazioni.",
    },
    {
      id: "cameriere",
      emoji: "🤵",
      label: "Cameriere",
      desc: "Solo il lavoro di sala: Sala, Ordini, Conti e Prenotazioni.",
    },
    {
      id: "cuoco",
      emoji: "👨‍🍳",
      label: "Cuoco",
      desc: "Solo il display di cucina (KDS) a schermo pieno.",
    },
  ] as const;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-10 text-neutral-900"
      style={brandVars}
    >
      <p className="font-display text-lg font-bold tracking-tight">{restaurant.nome}</p>
      <h1 className="mt-1 text-center font-display text-2xl font-bold sm:text-3xl">
        Come usi questo dispositivo?
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-neutral-500">
        La scelta resta memorizzata su questo dispositivo: potrai cambiarla in ogni momento da
        &ldquo;Cambia ruolo&rdquo;.
      </p>

      <div className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {roles.map((r) => (
          <form key={r.id} action={setRuolo}>
            <input type="hidden" name="ruolo" value={r.id} />
            <button
              className="flex h-full w-full flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              <span aria-hidden className="text-4xl">
                {r.emoji}
              </span>
              <span className="font-display text-lg font-bold">{r.label}</span>
              <span className="text-sm text-neutral-500">{r.desc}</span>
            </button>
          </form>
        ))}
      </div>

      <form action={signOut} className="mt-8">
        <button className="text-sm font-medium text-neutral-400 hover:text-neutral-700 hover:underline">
          Esci dall&apos;account
        </button>
      </form>
    </div>
  );
}
