"use client";

import { useFormStatus } from "react-dom";
import type { DatiLegali } from "@/types/db";

const FIELDS: { name: keyof DatiLegali; label: string; type?: string; full?: boolean; placeholder?: string }[] = [
  { name: "titolare", label: "Titolare del trattamento (ragione sociale / nome)", full: true, placeholder: "Es. Mario Rossi / Trattoria da Mario S.r.l." },
  { name: "piva", label: "P.IVA / Codice Fiscale", placeholder: "Es. 01234567890" },
  { name: "telefono", label: "Telefono", placeholder: "Es. 0975 123456" },
  { name: "indirizzo", label: "Indirizzo (locale)", full: true, placeholder: "Via …, CAP Città (Prov.)" },
  { name: "sede_legale", label: "Sede legale (se diversa)", full: true, placeholder: "Via …, CAP Città (Prov.)" },
  { name: "email", label: "Email per richieste privacy", type: "email", placeholder: "privacy@…" },
  { name: "pec", label: "PEC (facoltativa)", type: "email" },
  { name: "dominio", label: "Dominio del sito", placeholder: "www.esempio.it" },
  { name: "aggiornato_il", label: "Ultimo aggiornamento", type: "date" },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Salvataggio…" : "Salva dati legali"}
    </button>
  );
}

/** Shared editor for a tenant's legal/privacy data. Used by the restaurateur
 *  (own restaurant) and by the platform admin (any restaurant, via a hidden id).
 *  `action` is a server action that reads these fields from FormData. */
export default function LegalDataForm({
  initial,
  action,
  restaurantId,
}: {
  initial: DatiLegali;
  action: (formData: FormData) => Promise<void>;
  restaurantId?: string;
}) {
  const incompleto = !initial.titolare || !initial.email;
  return (
    <form action={action} className="space-y-3">
      {restaurantId && <input type="hidden" name="id" value={restaurantId} />}
      {incompleto && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          ⚠️ Compila almeno <strong>Titolare</strong> ed <strong>Email</strong>: senza questi dati
          l&apos;informativa pubblica non indica un titolare e un contatto validi.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.name} className={`block text-sm ${f.full ? "sm:col-span-2" : ""}`}>
            <span className="mb-1 block font-medium text-neutral-600">{f.label}</span>
            <input
              name={f.name}
              type={f.type ?? "text"}
              defaultValue={initial[f.name] ?? ""}
              placeholder={f.placeholder}
              maxLength={200}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <SaveButton />
        <span className="text-xs text-neutral-400">
          Questi dati compilano le pagine Cookie & Privacy Policy. Modello da far validare a un
          professionista privacy.
        </span>
      </div>
    </form>
  );
}
