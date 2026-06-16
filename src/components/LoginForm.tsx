"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginForm({
  title,
  redirectTo,
  hint,
}: {
  title: string;
  redirectTo: string;
  hint?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Full navigation so the server picks up the new session cookie.
    window.location.assign(redirectTo);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-bold">{title}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-neutral-500">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Email"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
            autoComplete="email"
          />
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="mb-1 block text-xs font-medium text-neutral-500"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Password"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-16 text-sm focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-brand"
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            >
              {showPassword ? "Nascondi" : "Mostra"}
            </button>
          </div>
        </div>
        {error && (
          <p className="block rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "Accesso…" : "Accedi"}
        </button>
      </form>
      {hint && <p className="mt-4 text-sm text-neutral-500">{hint}</p>}
    </main>
  );
}
