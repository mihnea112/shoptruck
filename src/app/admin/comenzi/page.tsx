"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OrderStatus =
  | "PLACED"
  | "PARTIAL_ALLOCATED"
  | "ALLOCATED"
  | "SHIPPED"
  | "CANCELLED";

type OrderRow = {
  id: string;
  status: OrderStatus;
  created_at: string;
  updated_at?: string | null;

  // NEW: list endpoint commonly returns flattened account/vehicle fields
  account_display_name?: string | null;
  account_name?: string | null;

  plate_no?: string | null;
  plate_number?: string | null;

  // totals may come either flattened or nested
  total_gross?: number | string | null;
  totals?: { total_gross?: number | string | null } | null;

  // Back-compat: some endpoints may still send nested objects
  account?: { display_name?: string | null; name?: string | null } | null;
  customer?: { display_name?: string | null; name?: string | null } | null;
  vehicle?: {
    plate_no?: string | null;
    plate_number?: string | null;
    label?: string | null;
  } | null;
};

type ApiList<T> = { ok: true; items: T[]; limit?: number; offset?: number };
type ApiErr = { ok: false; error?: string };

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Eroare.");
  return data as T;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("ro-RO");
  } catch {
    return "—";
  }
}

function fmtRON(v: any) {
  const n = Number(v ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toFixed(2)} RON`;
}

function statusBadge(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "SHIPPED")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "CANCELLED") return "bg-red-50 text-red-700 border-red-200";
  if (s === "ALLOCATED")
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (s === "PARTIAL_ALLOCATED")
    return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export default function OrdersListPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const filteredUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("limit", "100");
    sp.set("offset", "0");
    if (q.trim()) sp.set("q", q.trim());
    if (status) sp.set("status", status);
    return `/api/admin/orders?${sp.toString()}`;
  }, [q, status]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiJson<ApiList<OrderRow>>(filteredUrl);
      setItems(data.items || []);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Eroare la încărcare comenzi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Comenzi</h1>
          <p className="mt-2 text-sm text-slate-600">
            Listă comenzi din sistem (din oferte convertite).
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută (client / plăcuță / id)…"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f] sm:w-80"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f] sm:w-56"
          >
            <option value="">Toate statusurile</option>
            <option value="PLACED">PLACED</option>
            <option value="PARTIAL_ALLOCATED">PARTIAL_ALLOCATED</option>
            <option value="ALLOCATED">ALLOCATED</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <button
            onClick={load}
            className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Filtrează
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">
            Listă comenzi {loading ? "— se încarcă…" : `(${items.length})`}
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Client</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Vehicul
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Data</th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-right">
                Total
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-center">
                Acțiuni
              </th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-600" colSpan={6}>
                  Nu există comenzi.
                </td>
              </tr>
            ) : (
              items.map((o) => {
                const client =
                  o?.account_display_name ||
                  o?.account_name ||
                  o?.account?.display_name ||
                  o?.customer?.display_name ||
                  o?.account?.name ||
                  o?.customer?.name ||
                  "—";

                const plate =
                  o?.plate_no ||
                  o?.plate_number ||
                  o?.vehicle?.plate_no ||
                  o?.vehicle?.plate_number ||
                  o?.vehicle?.label ||
                  "—";

                const total =
                  o?.totals?.total_gross ??
                  o?.total_gross ??
                  0;

                return (
                  <tr key={o.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {client}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {o.id}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                      {plate}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${statusBadge(
                          o.status,
                        )}`}
                      >
                        {o.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {fmtDate(o.created_at)}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {fmtRON(total)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/admin/comenzi/${o.id}`}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Deschide
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
