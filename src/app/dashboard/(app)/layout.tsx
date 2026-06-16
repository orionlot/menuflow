import type { CSSProperties } from "react";
import { requireOwner } from "@/lib/auth";
import { signOut } from "@/app/dashboard/actions";
import { adminBrandVars } from "@/lib/brand";
import DashboardSidebar from "./DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurant } = await requireOwner();
  const brandVars = adminBrandVars(
    restaurant.colore_primario,
    restaurant.colore_secondario,
  ) as CSSProperties;

  const esci = (
    <form action={signOut}>
      <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </svg>
        Esci
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900" style={brandVars}>
      <DashboardSidebar nome={restaurant.nome} esci={esci} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
