"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  code: string;
  email: string;
  pct: number;
  source: string;
  expires_at: string;
  used_at: string | null;
  order_id: string | null;
  created_at: string;
  status: "active" | "used" | "expired";
};

const STATUS_LABEL = { active: "Activ", used: "Folosit", expired: "Expirat" } as const;
const STATUS_CLS = {
  active: "bg-green-100 text-green-800",
  used: "bg-slate-200 text-slate-800",
  expired: "bg-red-100 text-red-800",
} as const;

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("ro-RO") : "-");

export default function DiscountCodesAdmin() {
  const [items, setItems] = useState<Row[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, used: 0, expired: 0 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [pct, setPct] = useState("5");
  const [days, setDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/discount-codes?q=${encodeURIComponent(q)}&status=${status}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare la încărcare.");
      setItems(data.items);
      setStats(data.stats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setCreated("");
    try {
      const res = await fetch("/api/admin/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pct: Number(pct), days: Number(days) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare la creare.");
      setCreated(data.code);
      setEmail("");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Ștergi codul ${r.code}?`)) return;
    const res = await fetch(`/api/admin/discount-codes/${r.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "Nu s-a putut șterge.");
    load();
  };

  const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Coduri de reducere</h1>
        <p className="text-sm text-slate-700">Coduri emise de jocul de pe site și coduri create manual.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total", stats.total],
          ["Active", stats.active],
          ["Folosite", stats.used],
          ["Expirate", stats.expired],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase text-slate-700">{l}</div>
            <div className="text-2xl font-bold text-slate-900">{v}</div>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold text-slate-800">
          Email client
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} mt-1 block w-64`} />
        </label>
        <label className="text-xs font-semibold text-slate-800">
          Reducere %
          <input type="number" min={1} max={100} required value={pct} onChange={(e) => setPct(e.target.value)} className={`${input} mt-1 block w-24`} />
        </label>
        <label className="text-xs font-semibold text-slate-800">
          Valabil (zile)
          <input type="number" min={1} max={365} required value={days} onChange={(e) => setDays(e.target.value)} className={`${input} mt-1 block w-24`} />
        </label>
        <button disabled={creating} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-60">
          {creating ? "Se creează..." : "Creează cod"}
        </button>
        {created && <span className="text-sm font-semibold text-green-800">Cod creat: <span className="select-all font-mono">{created}</span></span>}
      </form>

      <div className="flex flex-wrap gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută cod sau email" className={`${input} w-64`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="">Toate</option>
          <option value="active">Active</option>
          <option value="used">Folosite</option>
          <option value="expired">Expirate</option>
        </select>
      </div>

      {error && <p className="text-sm font-medium text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm text-slate-900">
          <thead className="bg-slate-100 text-xs uppercase text-slate-800">
            <tr>
              {["Cod", "Email", "%", "Sursă", "Creat", "Expiră", "Folosit", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-700">Se încarcă...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-700">Niciun cod.</td></tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono font-semibold">{r.code}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{Number(r.pct)}%</td>
                  <td className="px-3 py-2">{r.source === "welcome_game" ? "Joc" : "Manual"}</td>
                  <td className="px-3 py-2">{fmt(r.created_at)}</td>
                  <td className="px-3 py-2">{fmt(r.expires_at)}</td>
                  <td className="px-3 py-2">{fmt(r.used_at)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status !== "used" && (
                      <button onClick={() => remove(r)} className="text-xs font-semibold text-red-700 hover:underline">Șterge</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
