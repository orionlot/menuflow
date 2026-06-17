"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: IconName; exact?: boolean };

const PRIMARY: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid", exact: true },
  { href: "/dashboard/ordini", label: "Ordini", icon: "receipt" },
  { href: "/dashboard/conti", label: "Conti", icon: "wallet" },
  { href: "/dashboard/cucina", label: "Cucina", icon: "chef" },
  { href: "/dashboard/sala", label: "Sala", icon: "tables" },
  { href: "/dashboard/menu", label: "Menu", icon: "book" },
  { href: "/dashboard/ingredienti", label: "Inventario", icon: "box" },
  { href: "/dashboard/clienti", label: "Clienti", icon: "users" },
  { href: "/dashboard/statistiche", label: "Analytics", icon: "chart" },
  { href: "/dashboard/qr", label: "QR Menu", icon: "qr" },
];
const SETTINGS: Item[] = [
  { href: "/dashboard/branding", label: "Aspetto", icon: "palette" },
  { href: "/dashboard/reconciliation", label: "Riconciliazione", icon: "scale" },
  { href: "/dashboard/funzionalita", label: "Impostazioni", icon: "gear" },
];

export default function DashboardSidebar({
  nome,
  esci,
  salaOn = false,
  contiOn = false,
  dark = false,
  setTema,
}: {
  nome: string;
  esci: ReactNode;
  salaOn?: boolean;
  contiOn?: boolean;
  dark?: boolean;
  setTema?: (t: "light" | "dark") => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const primary = PRIMARY.filter(
    (i) =>
      (salaOn || i.href !== "/dashboard/sala") &&
      (contiOn || i.href !== "/dashboard/conti"),
  );
  const temaToggle = setTema ? (
    <button
      onClick={() => void setTema(dark ? "light" : "dark")}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <span className="text-neutral-400">{dark ? "☀️" : "🌙"}</span>
      {dark ? "Tema chiaro" : "Tema scuro"}
    </button>
  ) : null;
  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Apri menu"
          className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
        >
          <Icon name="menu" />
        </button>
        <span className="truncate font-display text-base font-bold">{nome}</span>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 w-64 bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <Nav nome={nome} esci={esci} primary={primary} temaToggle={temaToggle} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-neutral-200 bg-white lg:block">
        <Nav nome={nome} esci={esci} primary={primary} temaToggle={temaToggle} />
      </aside>
    </>
  );
}

function Nav({
  nome,
  esci,
  primary,
  temaToggle,
  onNavigate,
}: {
  nome: string;
  esci: ReactNode;
  primary: Item[];
  temaToggle?: ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (it: Item) =>
    it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");

  const link = (it: Item) => {
    const active = isActive(it);
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active
            ? "bg-[var(--brand-soft)] text-brand"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        }`}
      >
        <span className={active ? "text-brand" : "text-neutral-400"}>
          <Icon name={it.icon} />
        </span>
        {it.label}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-brand">
          <Icon name="logo" />
        </span>
        <span className="truncate font-display text-base font-bold tracking-tight">{nome}</span>
      </div>
      <nav aria-label="Sezioni" className="flex-1 space-y-1 overflow-y-auto">
        {primary.map(link)}
        <div className="my-2 border-t border-neutral-100" />
        {SETTINGS.map(link)}
      </nav>
      <div className="mt-3 border-t border-neutral-100 pt-3">
        {temaToggle}
        {esci}
      </div>
    </div>
  );
}

type IconName =
  | "grid" | "receipt" | "chef" | "book" | "box" | "users" | "chart" | "qr"
  | "palette" | "scale" | "gear" | "menu" | "logo" | "tables" | "wallet";

function Icon({ name }: { name: IconName }) {
  const p: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-3-2V3z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    chef: <><path d="M6 14h12v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5z" /><path d="M7 14a4 4 0 0 1-1-7.9A4 4 0 0 1 12 4a4 4 0 0 1 6 2.1A4 4 0 0 1 17 14" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>,
    box: <><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 7a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-4.9" /></>,
    chart: <><path d="M4 20V4" /><path d="M4 20h16" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v7M14 20h3" /></>,
    palette: <><circle cx="12" cy="12" r="9" /><circle cx="8" cy="10" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="16" cy="10" r="1" /><path d="M12 21a3 3 0 0 1 0-6h1a2 2 0 0 0 0-4" /></>,
    scale: <><path d="M12 3v18M5 7h14" /><path d="M5 7l-2 6a3 3 0 0 0 6 0L7 7M19 7l-2 6a3 3 0 0 0 6 0l-2-6" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 12 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.5l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.5.9z" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    logo: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></>,
    tables: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><circle cx="17" cy="17" r="3" /></>,
    wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
}
