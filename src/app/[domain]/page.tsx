import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMenuItems,
  getPopularItemIds,
  getPublicIngredients,
  resolveTenant,
} from "@/lib/tenant";
import MenuClient from "./MenuClient";

// ISR: the public menu is statically regenerated so it stays fast and remains
// servable from the CDN even if the backend is momentarily unreachable.
export const revalidate = 60;

type Params = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { domain } = await params;
  const tenant = await resolveTenant(domain);
  return { title: tenant ? `${tenant.nome} — Menu` : "Menu" };
}

export default async function TenantMenuPage({ params }: Params) {
  const { domain } = await params;
  const tenant = await resolveTenant(domain);
  if (!tenant) notFound();

  // Suspended subscription: explicit, neutral message (must NOT read as "closed").
  if (!tenant.attivo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-neutral-800">
          {tenant.nome}
        </h1>
        <p className="mt-3 max-w-md text-neutral-600">
          Servizio temporaneamente non disponibile
        </p>
      </main>
    );
  }

  const items = await getMenuItems(tenant.id);
  const popolari = await getPopularItemIds(tenant.id);
  const ingredienti =
    tenant.funzioni_attive?.componibili || tenant.funzioni_attive?.ingredienti
      ? await getPublicIngredients(tenant.id)
      : [];
  return (
    <MenuClient
      tenant={tenant}
      items={items}
      popolari={popolari}
      ingredienti={ingredienti}
    />
  );
}
