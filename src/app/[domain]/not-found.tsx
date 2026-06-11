export default function TenantNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold text-neutral-800">
        Locale non trovato
      </h1>
      <p className="mt-3 max-w-md text-neutral-600">
        Controlla l&apos;indirizzo o il QR code.
      </p>
    </main>
  );
}
