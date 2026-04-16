"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ALL_ROLES = [
  {
    key: "SALES_REP",
    label: "Agent Vânzări",
    description: "Poate crea oferte și comenzi",
  },
  {
    key: "WAREHOUSE_OP",
    label: "Operator Depozit",
    description: "Poate gestiona stocul depozitului",
  },
  {
    key: "ADMIN",
    label: "Administrator",
    description: "Acces complet la toate funcțiile",
  },
];

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 " +
  "outline-none focus:border-[#feab1f] focus:ring-2 focus:ring-[#feab1f]/20 transition";

export default function AgentNouPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [roles, setRoles] = useState<string[]>(["SALES_REP"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRole(key: string) {
    setRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    );
  }

  async function handleSubmit() {
    setError(null);

    if (!email.trim()) return setError("Email-ul este obligatoriu.");
    if (!password || password.length < 8)
      return setError("Parola trebuie să aibă minim 8 caractere.");
    if (roles.length === 0) return setError("Selectează cel puțin un rol.");

    setLoading(true);
    try {
      const res = await fetch("/api/admin/sales-reps", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          roles,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "Eroare la creare.");

      router.push("/admin/agenti");
    } catch (e: any) {
      setError(e?.message || "Eroare internă.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/agenti"
          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          ← Înapoi
        </Link>
        <h1 className="text-lg font-bold text-slate-900">Agent nou</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        {/* Full name */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Nume complet
          </label>
          <input
            className={inputCls}
            placeholder="ex: Ion Popescu"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            className={inputCls}
            placeholder="agent@firma.ro"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">
            Parolă temporară <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className={inputCls}
              placeholder="minim 8 caractere"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              {showPw ? "Ascunde" : "Arată"}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Agentul se poate loga imediat cu aceste date.
          </p>
        </div>

        {/* Roles */}
        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-500">
            Roluri <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {ALL_ROLES.map((r) => (
              <label
                key={r.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition
                  ${
                    roles.includes(r.key)
                      ? "border-[#feab1f] bg-amber-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                <input
                  type="checkbox"
                  checked={roles.includes(r.key)}
                  onChange={() => toggleRole(r.key)}
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {r.label}
                  </div>
                  <div className="text-xs text-slate-500">{r.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition"
        >
          {loading ? "Se creează contul…" : "Creează agent"}
        </button>
      </div>
    </div>
  );
}
