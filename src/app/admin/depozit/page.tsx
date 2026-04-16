"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────
type Warehouse = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  products_count: number;
  total_on_hand: number;
  total_reserved: number;
  users_count: number;
};

type StockRow = {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_uom: string;
  brand_name: string;
  stock_on_hand: number;
  stock_reserved: number;
  stock_available: number;
  updated_at: string;
};

type WarehouseUser = {
  user_id: string;
  full_name: string;
  email: string;
  role: "MANAGER" | "OPERATOR";
};

type Profile = {
  user_id: string;
  full_name: string;
  email: string;
};

// ─── Helpers ──────────────────────────────────────────────────
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

function fmtNum(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("ro-RO") : "0";
}

// ─── Sub-components ───────────────────────────────────────────

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
      className={`fixed bottom-6 right-6 z-[999] rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl
      ${ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
    >
      {msg}
    </div>
  );
}

// ─── Warehouse card ───────────────────────────────────────────
function WarehouseCard({
  wh,
  selected,
  onSelect,
}: {
  wh: Warehouse;
  selected: boolean;
  onSelect: () => void;
}) {
  const available = wh.total_on_hand - wh.total_reserved;
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition
        ${
          selected
            ? "border-[#feab1f] bg-amber-50 shadow-md"
            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
              {wh.code}
            </span>
            {!wh.is_active && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                Inactiv
              </span>
            )}
          </div>
          <div className="mt-1 truncate font-semibold text-slate-900">
            {wh.name}
          </div>
          {wh.address && (
            <div className="mt-0.5 truncate text-xs text-slate-400">
              {wh.address}
            </div>
          )}
        </div>
        <div
          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1 ${selected ? "bg-[#feab1f]" : "bg-slate-200"}`}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-base font-bold text-slate-900">
            {fmtNum(wh.total_on_hand)}
          </div>
          <div className="text-[10px] text-slate-400">Fizic</div>
        </div>
        <div>
          <div className="text-base font-bold text-amber-600">
            {fmtNum(wh.total_reserved)}
          </div>
          <div className="text-[10px] text-slate-400">Rezervat</div>
        </div>
        <div>
          <div className="text-base font-bold text-emerald-600">
            {fmtNum(available)}
          </div>
          <div className="text-[10px] text-slate-400">Disponibil</div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
        <span>{wh.products_count} produse</span>
        <span>·</span>
        <span>{wh.users_count} utilizatori</span>
      </div>
    </button>
  );
}

// ─── Stock table ──────────────────────────────────────────────
function StockTable({
  warehouseId,
  showToast,
}: {
  warehouseId: string;
  showToast: (msg: string, ok: boolean) => void;
}) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query = q) => {
      setLoading(true);
      try {
        const data = await apiJson<any>(
          `/api/admin/warehouses/${warehouseId}?q=${encodeURIComponent(query)}&limit=100`,
        );
        setRows(data.stock || []);
      } catch (e: any) {
        showToast(e?.message || "Eroare la încărcare stoc.", false);
      } finally {
        setLoading(false);
      }
    },
    [warehouseId, q, showToast],
  );

  useEffect(() => {
    load("");
  }, [warehouseId]);

  function handleSearch(val: string) {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val), 300);
  }

  async function saveStock(productId: string) {
    const qty = Number(String(editVal).replace(",", "."));
    if (!Number.isFinite(qty) || qty < 0) {
      showToast("Valoare invalidă.", false);
      return;
    }
    setSaving(true);
    try {
      await apiJson(`/api/admin/warehouses/${warehouseId}/stock`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: productId, stock_on_hand: qty }),
      });
      showToast("Stoc actualizat.", true);
      setEditId(null);
      await load(q);
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Caută produs, SKU…"
          className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-[#feab1f]"
        />
        <div className="text-xs text-slate-400">{rows.length} produse</div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Produs
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">
                  Fizic
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">
                  Rezervat
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">
                  Disponibil
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center w-32">
                  Editează
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    Se încarcă…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    {q
                      ? "Niciun produs găsit."
                      : "Niciun produs în acest depozit."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isEditing = editId === r.product_id;
                  return (
                    <tr
                      key={r.product_id}
                      className="border-t border-slate-100 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {r.product_name}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {r.product_sku}
                          {r.brand_name ? ` · ${r.brand_name}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="1"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveStock(r.product_id);
                              if (e.key === "Escape") setEditId(null);
                            }}
                            className="w-24 rounded-lg border border-[#feab1f] bg-white px-2 py-1 text-right text-sm outline-none"
                          />
                        ) : (
                          <span
                            className={
                              Number(r.stock_on_hand) === 0
                                ? "text-slate-300"
                                : ""
                            }
                          >
                            {fmtNum(r.stock_on_hand)} {r.product_uom}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">
                        {fmtNum(r.stock_reserved)} {r.product_uom}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={
                            Number(r.stock_available) > 0
                              ? "text-emerald-600"
                              : "text-red-400"
                          }
                        >
                          {fmtNum(r.stock_available)} {r.product_uom}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => saveStock(r.product_id)}
                              disabled={saving}
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {saving ? "…" : "Salvează"}
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditId(r.product_id);
                              setEditVal(String(r.stock_on_hand));
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-[#feab1f] transition"
                          >
                            Editează
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Users tab ────────────────────────────────────────────────
function UsersTab({
  warehouseId,
  showToast,
}: {
  warehouseId: string;
  showToast: (msg: string, ok: boolean) => void;
}) {
  const [users, setUsers] = useState<WarehouseUser[]>([]);
  const [allProfiles, setAll] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"MANAGER" | "OPERATOR">("OPERATOR");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [whData, profData] = await Promise.all([
        apiJson<any>(`/api/admin/warehouses/${warehouseId}`),
        apiJson<any>(`/api/admin/sales-reps`),
      ]);
      setUsers(whData.users || []);
      setAll(profData.items || []);
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const assignedIds = new Set(users.map((u) => u.user_id));
  const available = allProfiles.filter((p) => !assignedIds.has(p.user_id));

  async function addUser() {
    if (!addUserId) return showToast("Selectează un utilizator.", false);
    setSaving(true);
    try {
      await apiJson(`/api/admin/warehouses/${warehouseId}/users`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: addUserId, role: addRole }),
      });
      showToast("Utilizator adăugat.", true);
      setAddUserId("");
      await load();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(userId: string) {
    if (!confirm("Elimini accesul acestui utilizator la depozit?")) return;
    try {
      await apiJson(
        `/api/admin/warehouses/${warehouseId}/users?user_id=${userId}`,
        {
          method: "DELETE",
        },
      );
      showToast("Utilizator eliminat.", true);
      await load();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add user form */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Adaugă utilizator
          </label>
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#feab1f]"
          >
            <option value="">— Selectează —</option>
            {available.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            Rol
          </label>
          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#feab1f]"
          >
            <option value="OPERATOR">Operator</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
        <button
          onClick={addUser}
          disabled={saving || !addUserId}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition"
        >
          {saving ? "Se adaugă…" : "Adaugă"}
        </button>
      </div>

      {/* Users list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Se încarcă…
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Niciun utilizator asignat acestui depozit.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Utilizator
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                  Rol
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.user_id}
                  className="border-t border-slate-100 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {u.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold
                      ${
                        u.role === "MANAGER"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {u.role === "MANAGER" ? "Manager" : "Operator"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removeUser(u.user_id)}
                      className="text-xs text-red-400 hover:text-red-600 transition"
                    >
                      Elimină
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Warehouse form modal ─────────────────────────────────────
function WarehouseModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Warehouse>;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = !!initial?.id;

  async function handleSave() {
    setErr(null);
    setSaving(true);
    try {
      await onSave({
        code: code.toUpperCase(),
        name,
        address: address || null,
        is_active: isActive,
      });
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Eroare.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#feab1f] focus:ring-2 focus:ring-[#feab1f]/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            {isEdit ? "Editează depozit" : "Depozit nou"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {!isEdit && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Cod <span className="text-red-500">*</span>
              </label>
              <input
                className={`${inputCls} uppercase font-mono`}
                placeholder="ex: CLUJ, BUC1"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={10}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Nume <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls}
              placeholder="ex: Depozit Cluj"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              Adresă
            </label>
            <input
              className={inputCls}
              placeholder="Str. Depozitului 1, Cluj-Napoca"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded accent-slate-900"
            />
            <span className="text-sm text-slate-700">Depozit activ</span>
          </label>

          {err && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Se salvează…" : isEdit ? "Salvează" : "Creează"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function DepozitePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Warehouse | null>(null);
  const [tab, setTab] = useState<"stock" | "users">("stock");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
  }, []);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ ok: true; items: Warehouse[] }>(
        "/api/admin/warehouses",
      );
      setWarehouses(data.items || []);
      // Keep selected in sync
      if (selected) {
        const fresh = (data.items || []).find((w) => w.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e: any) {
      showToast(e?.message || "Eroare la încărcare depozite.", false);
    } finally {
      setLoading(false);
    }
  }, [selected, showToast]);

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function handleCreate(data: any) {
    await apiJson("/api/admin/warehouses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Depozit creat.", true);
    await loadWarehouses();
  }

  async function handleEdit(data: any) {
    if (!selected) return;
    await apiJson(`/api/admin/warehouses/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    showToast("Depozit actualizat.", true);
    await loadWarehouses();
  }

  const totalOnHand = warehouses.reduce(
    (s, w) => s + Number(w.total_on_hand ?? 0),
    0,
  );
  const totalReserved = warehouses.reduce(
    (s, w) => s + Number(w.total_reserved ?? 0),
    0,
  );

  return (
    <div className="w-full pb-16">
      {toast && (
        <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
      )}

      {modal === "create" && (
        <WarehouseModal onSave={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal === "edit" && selected && (
        <WarehouseModal
          initial={selected}
          onSave={handleEdit}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Depozite</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestionare locații, stoc per depozit și acces utilizatori.
          </p>
        </div>
        <button
          onClick={() => setModal("create")}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
        >
          + Depozit nou
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Total depozite
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {warehouses.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Stoc total fizic
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {fmtNum(totalOnHand)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Total disponibil
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            {fmtNum(totalOnHand - totalReserved)}
          </div>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: warehouse list */}
        <div className="w-72 flex-shrink-0 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              Se încarcă…
            </div>
          ) : warehouses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Niciun depozit creat.
            </div>
          ) : (
            warehouses.map((wh) => (
              <WarehouseCard
                key={wh.id}
                wh={wh}
                selected={selected?.id === wh.id}
                onSelect={() => {
                  setSelected(wh);
                  setTab("stock");
                }}
              />
            ))
          )}
        </div>

        {/* Right: detail panel */}
        {selected ? (
          <div className="flex-1 min-w-0">
            {/* Panel header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-700">
                  {selected.code}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  {selected.name}
                </h2>
                {!selected.is_active && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                    Inactiv
                  </span>
                )}
              </div>
              <button
                onClick={() => setModal("edit")}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                ✎ Editează
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
              {(["stock", "users"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition
                    ${
                      tab === t
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  {t === "stock" ? "Stoc" : "Utilizatori"}
                </button>
              ))}
            </div>

            {tab === "stock" && (
              <StockTable warehouseId={selected.id} showToast={showToast} />
            )}
            {tab === "users" && (
              <UsersTab warehouseId={selected.id} showToast={showToast} />
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-slate-200 py-24">
            <div className="text-center">
              <div className="text-4xl mb-3">🏭</div>
              <div className="text-sm font-semibold text-slate-500">
                Selectează un depozit din stânga
              </div>
              <div className="text-xs text-slate-400 mt-1">
                pentru a vedea stocul și utilizatorii
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
