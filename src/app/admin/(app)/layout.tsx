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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <Container className="flex items-center justify-between gap-3 py-3">
          <span className="font-display font-bold">
            MenuFlow <span className="font-normal text-neutral-400">/ admin</span>
          </span>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={adminSignOut}>
              <button className="rounded-lg px-3 py-1.5 font-medium transition hover:bg-neutral-100 hover:text-neutral-900">
                Esci
              </button>
            </form>
          </div>
        </Container>
      </header>
      <main>
        <Container className="py-6">{children}</Container>
      </main>
    </div>
  );
}
