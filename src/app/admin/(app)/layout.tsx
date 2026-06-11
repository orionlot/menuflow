import { requireAdmin } from "@/lib/auth";
import { adminSignOut } from "@/app/admin/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="font-bold">
            MenuFlow <span className="text-neutral-400">/ admin</span>
          </span>
          <div className="flex items-center gap-3 text-sm text-neutral-500">
            <span>{user.email}</span>
            <form action={adminSignOut}>
              <button className="hover:text-black">Esci</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6">{children}</main>
    </div>
  );
}
