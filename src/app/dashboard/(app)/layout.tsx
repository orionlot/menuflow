import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOut } from "@/app/dashboard/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { restaurant } = await requireOwner();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <span className="font-bold">{restaurant.nome}</span>
            <nav className="flex gap-3 text-sm">
              <Link href="/dashboard" className="text-neutral-600 hover:text-black">
                Panoramica
              </Link>
              <Link
                href="/dashboard/cucina"
                className="font-semibold text-orange-600 hover:text-orange-700"
              >
                Cucina
              </Link>
              <Link
                href="/dashboard/menu"
                className="text-neutral-600 hover:text-black"
              >
                Menu
              </Link>
              <Link
                href="/dashboard/branding"
                className="text-neutral-600 hover:text-black"
              >
                Aspetto
              </Link>
              <Link
                href="/dashboard/ordini"
                className="text-neutral-600 hover:text-black"
              >
                Ordini
              </Link>
              <Link
                href="/dashboard/reconciliation"
                className="text-neutral-600 hover:text-black"
              >
                Riconciliazione
              </Link>
              <Link
                href="/dashboard/statistiche"
                className="text-neutral-600 hover:text-black"
              >
                Statistiche
              </Link>
              <Link
                href="/dashboard/qr"
                className="text-neutral-600 hover:text-black"
              >
                QR
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <button className="text-sm text-neutral-500 hover:text-black">
              Esci
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-6">{children}</main>
    </div>
  );
}
