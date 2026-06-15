import type { CSSProperties } from "react";
import { requireOwner } from "@/lib/auth";
import { signOut } from "@/app/dashboard/actions";
import { adminBrandVars } from "@/lib/brand";
import { isFeatureOn } from "@/lib/config/features";
import { Container } from "@/components/ui/Container";
import DashboardNav from "./DashboardNav";

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

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900" style={brandVars}>
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <Container className="flex items-center justify-between gap-3 py-2.5">
          <span className="truncate font-display text-base font-bold">
            {restaurant.nome}
          </span>
          <form action={signOut}>
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900">
              Esci
            </button>
          </form>
        </Container>
        <Container className="pb-2">
          <DashboardNav componibiliOn={isFeatureOn(restaurant, "componibili")} />
        </Container>
      </header>
      <main>
        <Container className="py-6">{children}</Container>
      </main>
    </div>
  );
}
