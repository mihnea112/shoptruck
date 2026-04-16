"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Agent = {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  is_active: boolean;
  created_at: string;
};

const ALL_ROLES = [
  { key: "ADMIN", label: "Administrator" },
  { key: "SALES_REP", label: "Agent Vânzări" },
  { key: "WAREHOUSE_OP", label: "Operator Depozit" },
];

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !(data as any)?.ok)
    throw new Error((data as any)?.error || "Eroare.");
  return data as T;
}

function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, string> = {
    ADMIN: "bg-red-50 text-red-700 border-red-200",
    SALES_REP: "bg-indigo-50 text-indigo-700 border-indigo-200",
    WAREHOUSE_OP: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const label: Record<string, string> = {
    ADMIN: "Admin",
    SALES_REP: "Agent",
    WAREHOUSE_OP: "Depozit",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg[role] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
    >
      {label[role] ?? role}
    </span>
  );
}

function Toast({
  msg,
  ok,
  onDone,
}: {
  msg: string;
  ok: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
    >
      {msg}
    </div>
  );
}

export default function AgentiPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, ok: boolean) => setToast({ msg, ok });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ ok: true; items: Agent[] }>(
        "/api/admin/sales-reps",
      );
      setAgents(data.items || []);
    } catch (e: any) {
      showToast(e?.message || "Eroare la încărcare.", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(a: Agent) {
    setEditId(a.user_id);
    setEditName(a.full_name);
    setEditRoles([...a.roles]);
    setEditActive(a.is_active);
  }

  function toggleRole(key: string) {
    setEditRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    );
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      await apiJson("/api/admin/sales-reps", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: editId,
          fullName: editName,
          roles: editRoles,
          is_active: editActive,
        }),
      });
      showToast("Modificări salvate.", true);
      setEditId(null);
      await load();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent(userId: string, email: string) {
    if (
      !confirm(
        `Ștergi definitiv contul ${email}? Acțiunea nu poate fi anulată.`,
      )
    )
      return;
    try {
      await apiJson("/api/admin/sales-reps", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      showToast("Cont șters.", true);
      await load();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    }
  }

  return (
    <div className="w-full pb-16">
      {toast && (
        <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
      )}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Agenți & Personal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestionează conturile de staff și rolurile acestora.
          </p>
        </div>
        <Link
          href="/admin/agenti/nou"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
        >
          + Adaugă agent
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            Se încarcă…
          </div>
        ) : agents.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            Niciun agent creat. Apasă „+ Adaugă agent" pentru a începe.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                  Nume
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Roluri
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const isEditing = editId === a.user_id;
                return (
                  <tr
                    key={a.user_id}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-[#feab1f]"
                          placeholder="Nume complet"
                        />
                      ) : (
                        <span className="font-semibold text-slate-900">
                          {a.full_name || (
                            <span className="text-slate-400 font-normal">
                              —
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">{a.email}</td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          {ALL_ROLES.map((r) => (
                            <label
                              key={r.key}
                              className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={editRoles.includes(r.key)}
                                onChange={() => toggleRole(r.key)}
                                className="h-3.5 w-3.5 accent-slate-900"
                              />
                              {r.label}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(a.roles || []).length > 0 ? (
                            a.roles.map((r) => <RoleBadge key={r} role={r} />)
                          ) : (
                            <span className="text-xs text-slate-400">
                              fără rol
                            </span>
                          )}
                        </div>
                      )}
                    </td>

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
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            a.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {a.is_active ? "Activ" : "Inactiv"}
                        </span>
                      )}
                    </td>

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
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => startEdit(a)}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                          >
                            Editează
                          </button>
                          <button
                            onClick={() => deleteAgent(a.user_id, a.email)}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                          >
                            Șterge
                          </button>
                        </div>
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
