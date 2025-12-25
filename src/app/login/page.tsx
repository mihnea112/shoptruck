"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";

export default function LoginClient({ initialNext }: { initialNext: string | null }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Autentificare eșuată. Verifică datele și încearcă din nou.");
        return;
      }

      const redirectTo = initialNext ?? data.redirectTo ?? "/";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("A apărut o eroare la conectare. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-black via-neutral-900 to-neutral-800">
      <MainHeader />

      <main className="flex flex-1 items-center justify-center px-6 py-14 lg:px-10 xl:px-16">
        <div className="w-full max-w-xl">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center rounded-full bg-[#feab1f]/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-[#feab1f]">
              Portal cont · ShopTruck
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Autentificare
            </h1>
            <p className="mt-2 text-sm text-slate-200">
              Adminii și agenții intră în portalul de administrare. Clienții își gestionează comenzile.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-linear-to-br from-black via-neutral-900 to-neutral-800 p-6 shadow-2xl">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="ex: admin@shoptruck.ro"
                  className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Parolă</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                  required
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#feab1f] px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-[#feab1f]/30 transition hover:bg-[#feab1f]/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Se autentifică..." : "Intră în cont"}
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <Link
                  href="/"
                  className="text-xs font-medium text-slate-200 hover:text-[#feab1f] transition"
                >
                  ← Înapoi la magazin
                </Link>

                <span className="text-xs text-slate-400">
                  Ai nevoie de acces? Contactează administratorul.
                </span>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Prin autentificare accepți politica de confidențialitate și termenii de utilizare.
          </div>
        </div>
      </main>

      <MainFooter />
    </div>
  );
}