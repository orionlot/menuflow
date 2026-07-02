import { requireAdmin } from "@/lib/auth";
import { adminSignOut } from "@/app/admin/actions";
import { Container } from "@/components/ui/Container";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      {/* Soft cyan/magenta atmosphere behind the content */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-fuchsia-400/15 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <Container className="flex items-center justify-between gap-3 py-3">
          <span className="flex items-center gap-2 font-display font-bold">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-fuchsia-500 text-sm font-bold text-white"
            >
              M
            </span>
            <span className="bg-gradient-to-r from-cyan-600 to-fuchsia-600 bg-clip-text text-transparent">
              MenuFlow
            </span>
            <span className="font-normal text-slate-400">/ admin</span>
          </span>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={adminSignOut}>
              <button className="rounded-lg px-3 py-1.5 font-medium transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
                Esci
              </button>
            </form>
          </div>
        </Container>
        <div aria-hidden className="h-0.5 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500" />
      </header>
      <main className="relative z-10">
        <Container className="py-6">{children}</Container>
      </main>
    </div>
  );
}
