"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";

type Kind = "individual" | "company";

export default function SignupPage() {
  const router = useRouter();

  const [kind, setKind] = useState<Kind>("individual");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Individual
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Company
  const [companyName, setCompanyName] = useState("");
  const [vatId, setVatId] = useState("");
  const [regNo, setRegNo] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload: any = {
      kind,
      email,
      password,
    };

    if (kind === "individual") {
      payload.firstName = firstName;
      payload.lastName = lastName;
      payload.phone = phone || undefined;
    } else {
      payload.companyName = companyName;
      payload.vatId = vatId || undefined;
      payload.regNo = regNo || undefined;
      payload.contactName = contactName || undefined;
      payload.contactPhone = contactPhone || undefined;
      payload.contactEmail = contactEmail || undefined;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Înregistrare eșuată. Încearcă din nou.");
        return;
      }

      router.push(data.redirectTo ?? "/account");
    } catch {
      setError("A apărut o eroare. Încearcă din nou.");
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
              Cont nou · ShopTruck
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Creează cont
            </h1>
            <p className="mt-2 text-sm text-slate-200">
              Alege tipul de client și completează datele necesare.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-linear-to-br from-black via-neutral-900 to-neutral-800 p-6 shadow-2xl">
            <form onSubmit={onSubmit} className="space-y-4">
              {/* Kind switch */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind("individual")}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    kind === "individual"
                      ? "border-[#feab1f] bg-[#feab1f]/10 text-[#feab1f]"
                      : "border-slate-700 text-slate-200 hover:border-slate-500"
                  }`}
                >
                  Persoană fizică
                </button>
                <button
                  type="button"
                  onClick={() => setKind("company")}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    kind === "company"
                      ? "border-[#feab1f] bg-[#feab1f]/10 text-[#feab1f]"
                      : "border-slate-700 text-slate-200 hover:border-slate-500"
                  }`}
                >
                  Firmă
                </button>
              </div>

              {/* Common */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="ex: nume@email.ro"
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
                  autoComplete="new-password"
                  placeholder="minim 8 caractere"
                  className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                  required
                />
              </div>

              {/* Individual fields */}
              {kind === "individual" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Nume</label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#feab1f]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Prenume</label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#feab1f]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Telefon (opțional)</label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="ex: 07xx xxx xxx"
                      className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Company fields */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Nume firmă</label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#feab1f]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">CUI (opțional)</label>
                      <input
                        value={vatId}
                        onChange={(e) => setVatId(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#feab1f]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Nr. Reg. Com. (opțional)</label>
                      <input
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#feab1f]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Persoană contact (opțional)</label>
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#feab1f]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400">Telefon contact (opțional)</label>
                      <input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#feab1f]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Email contact (opțional)</label>
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      type="email"
                      placeholder="Dacă e gol, folosim emailul contului"
                      className="w-full rounded-xl border border-slate-700 bg-linear-to-br from-black via-neutral-900 to-neutral-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                    />
                  </div>
                </>
              )}

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
                {loading ? "Se creează contul..." : "Creează cont"}
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <Link
                  href="/login"
                  className="text-xs font-medium text-slate-200 hover:text-[#feab1f] transition"
                >
                  Ai deja cont? Autentifică-te →
                </Link>

                <Link
                  href="/"
                  className="text-xs font-medium text-slate-200 hover:text-[#feab1f] transition"
                >
                  ← Înapoi la magazin
                </Link>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center text-xs text-slate-400">
            Prin creare cont accepți politica de confidențialitate și termenii de utilizare.
          </div>
        </div>
      </main>

      <MainFooter />
    </div>
  );
}