"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Panoramica" },
  { href: "/dashboard/cucina", label: "Cucina" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/branding", label: "Aspetto" },
  { href: "/dashboard/ordini", label: "Ordini" },
  { href: "/dashboard/reconciliation", label: "Riconciliazione" },
  { href: "/dashboard/statistiche", label: "Statistiche" },
  { href: "/dashboard/qr", label: "QR" },
  { href: "/dashboard/funzionalita", label: "Funzionalità" },
];

/** Horizontal, scrollable tab bar. Active tab uses the tenant brand accent. */
export default function DashboardNav({ componibiliOn = false }: { componibiliOn?: boolean }) {
  const pathname = usePathname();
  // "Ingredienti & inventario" only when the composable-products add-on is on.
  const items = componibiliOn
    ? [
        ...ITEMS.slice(0, 3),
        { href: "/dashboard/ingredienti", label: "Ingredienti" },
        ...ITEMS.slice(3),
      ]
    : ITEMS;
  return (
    <nav
      aria-label="Sezioni"
      className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1"
    >
      {items.map((it) => {
        const active =
          it.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-[var(--brand-soft)] text-brand"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
