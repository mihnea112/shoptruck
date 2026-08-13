"use client";

import { useCallback, useEffect, useState } from "react";

type UserProfile = {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  is_active: boolean;
  created_at: string;
};

const ALL_ROLES = [
  { key: "ADMIN", label: "Administrator", color: "bg-red-50 text-red-700 border-red-200", desc: "Acces complet" },
  { key: "SALES", label: "Vânzări", color: "bg-indigo-50 text-indigo-700 border-indigo-200", desc: "Oferte, comenzi, facturi" },
  { key: "MARKETING", label: "Marketing", color: "bg-purple-50 text-purple-700 border-purple-200", desc: "Campanii email, contacte" },
  { key: "WAREHOUSE", label: "Depozit", color: "bg-amber-50 text-amber-700 border-amber-200", desc: "Stoc, recepție, transferuri" },
];

function RoleBadge({ role }: { role: string }) {
  const found = ALL_ROLES.find((r) => r.key === role);
  const color = found?.color ?? "bg-slate-50 text-slate-600 border-slate-200";
  const label = found?.label ?? role;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
      {msg}
    </div>
  );
}

export default function AccesPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "staff" | "customers">("all");

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, ok: boolean) => setToast({ msg, ok });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/acces");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare.");
      setUsers(data.items || []);
    } catch (e: any) {
      showToast(e?.message || "Eroare la încărcare.", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(u: UserProfile) {
    setEditId(u.user_id);
    setEditRoles([...u.roles]);
    setEditActive(u.is_active);
  }

  function toggleRole(key: string) {
    setEditRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/acces", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: editId, roles: editRoles, is_active: editActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare.");
      showToast("Roluri salvate.", true);
      setEditId(null);
      await load();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    } finally {
      setSaving(false);
    }
  }

  // Filter and search
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.full_name || "").toLowerCase().includes(q);
    const isStaff = u.roles.length > 0;
    const matchFilter =
      filter === "all" ||
      (filter === "staff" && isStaff) ||
      (filter === "customers" && !isStaff);
    return matchSearch && matchFilter;
  });

  return (
    <div className="w-full pb-16">
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}

      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-900">Gestionare acces</h1>
        <p className="mt-1 text-sm text-slate-500">
          Atribuie roluri utilizatorilor din baza de date. Utilizatorii fără rol au acces doar la magazin.
        </p>
      </div>

      {/* Role legend */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ALL_ROLES.map((r) => (
          <div key={r.key} className={`rounded-xl border px-3 py-2 ${r.color}`}>
            <div className="text-xs font-bold">{r.label}</div>
            <div className="text-[10px] opacity-75">{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Caută după email sau nume…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#feab1f] focus:ring-1 focus:ring-[#feab1f]"
        />
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs">
          {([
            { key: "all", label: "Toți" },
            { key: "staff", label: "Staff" },
            { key: "customers", label: "Clienți" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 font-medium transition ${
                filter === f.key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          {filtered.length} utilizator{filtered.length !== 1 ? "i" : ""}
        </span>
      </div>

      {/* Users table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">Se încarcă…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            {search ? "Niciun rezultat pentru căutare." : "Niciun utilizator."}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500">Utilizator</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Roluri</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isEditing = editId === u.user_id;
                const isStaff = u.roles.length > 0;

                return (
                  <tr key={u.user_id} className={`border-t border-slate-100 align-top ${isEditing ? "bg-[#feab1f]/5" : ""}`}>
                    {/* User info */}
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">
                        {u.full_name || <span className="text-slate-400 font-normal">—</span>}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>

                    {/* Roles */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          {ALL_ROLES.map((r) => (
                            <label key={r.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editRoles.includes(r.key)}
                                onChange={() => toggleRole(r.key)}
                                className="h-3.5 w-3.5 accent-slate-900"
                              />
                              {r.label}
                              <span className="text-[10px] text-slate-400">— {r.desc}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {isStaff ? (
                            u.roles.map((r) => <RoleBadge key={r} role={r} />)
                          ) : (
                            <span className="text-xs text-slate-400">Client (fără rol admin)</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                            className="h-3.5 w-3.5 accent-slate-900"
                          />
                          Activ
                        </label>
                      ) : (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {u.is_active ? "Activ" : "Inactiv"}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {saving ? "…" : "Salvează"}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            Anulează
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                          Editează roluri
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
