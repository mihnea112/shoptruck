"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────
type Warehouse = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  is_active: boolean;
};

type StockRow = {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_uom: string;
  brand_name: string;
  category_name?: string | null;
  stock_on_hand: number;
  stock_reserved: number;
  stock_available: number;
  updated_at: string;
};

type Stats = {
  total_products: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  out_of_stock_count: number;
};

type WarehouseOption = { id: string; code: string; name: string };

type ProductSearchResult = {
  id: string;
  name: string;
  sku: string;
  brand_name: string;
  uom: string;
  stock_on_hand: number;
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

function fmtNum(v: any, decimals = 0) {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("ro-RO", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : "0";
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Toast ────────────────────────────────────────────────────
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
      className={`fixed bottom-6 right-6 z-[60] rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl
      ${ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
    >
      {msg}
    </div>
  );
}

// ─── Add Stock Modal ──────────────────────────────────────────
function AddStockModal({
  warehouseId,
  warehouseName,
  onSaved,
  onClose,
}: {
  warehouseId: string;
  warehouseName: string;
  onSaved: (productId: string, productName: string, qty: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [selected, setSelected] = useState<ProductSearchResult | null>(null);
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"set" | "add">("add");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  // Search products
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiJson<any>(
          `/api/admin/products/search?q=${encodeURIComponent(q.trim())}&limit=30`,
        );
        setResults(
          (data.items || []).map((x: any) => ({
            id: String(x.id),
            name: String(x.name),
            sku: x.sku ?? "",
            brand_name: x.brand_name ?? "",
            uom: x.uom ?? "buc",
            stock_on_hand: Number(x.stock_on_hand ?? 0),
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, [q]);

  function pickProduct(p: ProductSearchResult) {
    setSelected(p);
    setQ(p.name);
    setResults([]);
    setErr(null);
    setTimeout(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }, 50);
  }

  async function handleSave() {
    setErr(null);
    if (!selected) return setErr("Selectează un produs.");
    const n = Number(String(qty).replace(",", "."));
    if (!Number.isFinite(n) || n < 0)
      return setErr("Cantitate invalidă (număr >= 0).");

    // For "add" mode, final qty = current stock + n
    const finalQty = mode === "add" ? selected.stock_on_hand + n : n;

    setSaving(true);
    try {
      await apiJson("/api/admin/warehouses/stoc", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_id: selected.id,
          warehouse_id: warehouseId,
          stock_on_hand: finalQty,
        }),
      });
      onSaved(selected.id, selected.name, finalQty);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm " +
    "outline-none focus:border-[#feab1f] focus:ring-2 focus:ring-[#feab1f]/20 transition";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900">Adaugă stoc manual</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Depozit:{" "}
              <span className="font-semibold text-slate-600">
                {warehouseName}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-5 space-y-4">
          {/* Product search */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">
              Produs <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                className={inputCls}
                placeholder="Caută după nume, SKU, cod…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSelected(null);
                }}
                autoFocus
              />
              {/* Search spinner */}
              {searching && (
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="h-4 w-4 animate-spin text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
              )}

              {/* Dropdown results */}
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => pickProduct(p)}
                          className="w-full px-4 py-3 text-left hover:bg-amber-50 transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {p.name}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                                {p.brand_name && (
                                  <span className="font-medium text-slate-500">
                                    {p.brand_name}
                                  </span>
                                )}
                                {p.brand_name && p.sku && <span>·</span>}
                                {p.sku && (
                                  <span className="font-mono">{p.sku}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div
                                className={`text-xs font-semibold ${p.stock_on_hand > 0 ? "text-emerald-600" : "text-slate-400"}`}
                              >
                                {fmtNum(p.stock_on_hand)} {p.uom}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                în total
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Selected product chip */}
            {selected && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="text-sm font-semibold text-emerald-900 truncate">
                  {selected.name}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className="text-xs text-emerald-700">
                    Stoc actual:{" "}
                    <strong>
                      {fmtNum(selected.stock_on_hand)} {selected.uom}
                    </strong>
                  </span>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setQ("");
                    }}
                    className="text-emerald-400 hover:text-emerald-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">
              Tip operațiune
            </label>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              <button
                onClick={() => setMode("add")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition
                  ${mode === "add" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                + Adaugă la stoc
              </button>
              <button
                onClick={() => setMode("set")}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition
                  ${mode === "set" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                = Setează stoc
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {mode === "add"
                ? "Cantitatea introdusă se adaugă peste stocul existent."
                : "Stocul fizic va fi setat exact la valoarea introdusă."}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">
              {mode === "add"
                ? "Cantitate de adăugat"
                : "Cantitate nouă (stoc fizic)"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={qtyRef}
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                className={`${inputCls} text-right font-mono text-lg`}
              />
              {selected && (
                <span className="text-sm text-slate-400 whitespace-nowrap">
                  {selected.uom}
                </span>
              )}
            </div>

            {/* Preview of result */}
            {selected &&
              qty !== "" &&
              Number.isFinite(Number(String(qty).replace(",", "."))) && (
                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
                  {mode === "add" ? (
                    <>
                      <span className="text-slate-400">
                        {fmtNum(selected.stock_on_hand)}
                      </span>
                      {" + "}
                      <span className="font-semibold text-slate-700">
                        {fmtNum(Number(String(qty).replace(",", ".")) || 0)}
                      </span>
                      {" = "}
                      <span className="font-bold text-emerald-700">
                        {fmtNum(
                          selected.stock_on_hand +
                            (Number(String(qty).replace(",", ".")) || 0),
                        )}{" "}
                        {selected.uom}
                      </span>
                      {" stoc final"}
                    </>
                  ) : (
                    <>
                      Stoc setat la{" "}
                      <span className="font-bold text-emerald-700">
                        {fmtNum(Number(String(qty).replace(",", ".")) || 0)}{" "}
                        {selected.uom}
                      </span>
                    </>
                  )}
                </div>
              )}
          </div>

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selected}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition"
          >
            {saving
              ? "Se salvează…"
              : mode === "add"
                ? "Adaugă stoc"
                : "Setează stoc"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Stock row with inline edit ───────────────────────────────
function StockRowItem({
  row,
  warehouseId,
  onSaved,
  onError,
}: {
  row: StockRow;
  warehouseId: string;
  onSaved: (productId: string, newQty: number) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setVal(String(row.stock_on_hand));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  }

  async function save() {
    const qty = Number(String(val).replace(",", "."));
    if (!Number.isFinite(qty) || qty < 0) {
      onError("Valoare invalidă — introduci un număr >= 0.");
      return;
    }
    setSaving(true);
    try {
      await apiJson("/api/admin/warehouses/stoc", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_id: row.product_id,
          warehouse_id: warehouseId,
          stock_on_hand: qty,
        }),
      });
      onSaved(row.product_id, qty);
      setEditing(false);
    } catch (e: any) {
      onError(e?.message || "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  const available = Number(row.stock_available);
  const isOutOfStock = available <= 0;
  const isLow = available > 0 && available < 5;

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="px-5 py-3">
        <div className="font-semibold text-slate-900 leading-snug">
          {row.product_name}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono">{row.product_sku}</span>
          {row.brand_name && (
            <>
              <span>·</span>
              <span>{row.brand_name}</span>
            </>
          )}
          {row.category_name && (
            <>
              <span>·</span>
              <span>{row.category_name}</span>
            </>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="1"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-24 rounded-lg border border-[#feab1f] bg-white px-2 py-1.5 text-right text-sm outline-none shadow-sm"
          />
        ) : (
          <span className="font-mono font-semibold text-slate-800">
            {fmtNum(row.stock_on_hand)}{" "}
            <span className="text-xs font-normal text-slate-400">
              {row.product_uom}
            </span>
          </span>
        )}
      </td>

      <td className="px-4 py-3 text-right font-mono text-slate-500">
        {fmtNum(row.stock_reserved)}{" "}
        <span className="text-xs text-slate-400">{row.product_uom}</span>
      </td>

      <td className="px-4 py-3 text-right">
        <span
          className={`font-mono font-semibold ${
            isOutOfStock
              ? "text-red-500"
              : isLow
                ? "text-amber-500"
                : "text-emerald-600"
          }`}
        >
          {fmtNum(available)}{" "}
          <span className="text-xs font-normal">{row.product_uom}</span>
        </span>
        {isOutOfStock && (
          <div className="text-[10px] font-semibold text-red-400 mt-0.5">
            Epuizat
          </div>
        )}
        {isLow && (
          <div className="text-[10px] font-semibold text-amber-500 mt-0.5">
            Stoc mic
          </div>
        )}
      </td>

      <td className="px-4 py-3 text-xs text-slate-400">
        {fmtDate(row.updated_at)}
      </td>

      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {saving ? "…" : "✓ Salvează"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              Anulează
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#feab1f] hover:bg-amber-50 hover:text-slate-900 transition"
          >
            Modifică
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function DepozitStocPage() {
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [allWarehouses, setAllWarehouses] = useState<WarehouseOption[]>([]);
  const [selectedWhId, setSelectedWhId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, ok: boolean) => setToast({ msg, ok });

  useEffect(() => {
    fetch("/api/admin/warehouses", { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.items) && d.items.length > 0) {
          setIsAdmin(true);
          setAllWarehouses(d.items);
          setSelectedWhId(d.items[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const buildUrl = useCallback(
    (query: string, low: boolean, whId: string) => {
      const sp = new URLSearchParams();
      sp.set("limit", "200");
      if (query) sp.set("q", query);
      if (low) sp.set("low_stock", "1");
      if (isAdmin && whId) sp.set("warehouse_id", whId);
      return `/api/admin/warehouses/stoc?${sp.toString()}`;
    },
    [isAdmin],
  );

  const load = useCallback(
    async (query = q, low = onlyLow, whId = selectedWhId) => {
      setLoading(true);
      try {
        const data = await apiJson<any>(buildUrl(query, low, whId));
        setWarehouse(data.warehouse ?? null);
        setStock(data.stock ?? []);
        setStats(data.stats ?? null);
      } catch (e: any) {
        showToast(e?.message || "Eroare la încărcare.", false);
        setStock([]);
      } finally {
        setLoading(false);
      }
    },
    [q, onlyLow, selectedWhId, buildUrl],
  );

  useEffect(() => {
    load("", false, selectedWhId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWhId]);

  function handleSearch(val: string) {
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => load(val, onlyLow, selectedWhId),
      300,
    );
  }

  function handleLowToggle(val: boolean) {
    setOnlyLow(val);
    load(q, val, selectedWhId);
  }

  function handleSaved(productId: string, newQty: number) {
    setStock((prev) =>
      prev.map((r) =>
        r.product_id === productId
          ? {
              ...r,
              stock_on_hand: newQty,
              stock_available: newQty - r.stock_reserved,
              updated_at: new Date().toISOString(),
            }
          : r,
      ),
    );
    setStats((prev) => {
      if (!prev) return prev;
      const old = stock.find((r) => r.product_id === productId);
      if (!old) return prev;
      const diff = newQty - old.stock_on_hand;
      return {
        ...prev,
        total_on_hand: prev.total_on_hand + diff,
        total_available: prev.total_available + diff,
        out_of_stock_count:
          newQty - old.stock_reserved <= 0
            ? prev.out_of_stock_count + (old.stock_available > 0 ? 1 : 0)
            : prev.out_of_stock_count - (old.stock_available <= 0 ? 1 : 0),
      };
    });
    showToast("Stoc actualizat.", true);
  }

  // Called from AddStockModal when a product is saved
  // If the product is already in the list update it, otherwise reload
  function handleAddSaved(
    productId: string,
    _productName: string,
    newQty: number,
  ) {
    const exists = stock.some((r) => r.product_id === productId);
    if (exists) {
      handleSaved(productId, newQty);
    } else {
      // New product added to this warehouse — reload to get full row data
      load(q, onlyLow, selectedWhId);
      showToast("Produs adăugat în depozit.", true);
    }
  }

  return (
    <div className="w-full pb-16">
      {toast && (
        <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
      )}

      {addModalOpen && warehouse && (
        <AddStockModal
          warehouseId={warehouse.id}
          warehouseName={`${warehouse.code} — ${warehouse.name}`}
          onSaved={handleAddSaved}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Stoc Depozit</h1>
          {warehouse && (
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
                {warehouse.code}
              </span>
              <span className="text-sm text-slate-600">{warehouse.name}</span>
              {warehouse.address && (
                <span className="text-xs text-slate-400">
                  · {warehouse.address}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Admin warehouse switcher */}
          {isAdmin && allWarehouses.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">
                Depozit:
              </label>
              <select
                value={selectedWhId}
                onChange={(e) => setSelectedWhId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#feab1f]"
              >
                {allWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Add stock button */}
          <button
            onClick={() => setAddModalOpen(true)}
            disabled={!warehouse}
            className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Adaugă stoc
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Produse
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {fmtNum(stats.total_products)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Fizic total
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {fmtNum(stats.total_on_hand)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Disponibil
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">
              {fmtNum(stats.total_available)}
            </div>
          </div>
          <div
            className={`rounded-2xl border px-4 py-3 cursor-pointer transition
              ${
                onlyLow
                  ? "border-red-300 bg-red-50"
                  : stats.out_of_stock_count > 0
                    ? "border-red-200 bg-red-50/50 hover:border-red-300"
                    : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            onClick={() => handleLowToggle(!onlyLow)}
            title="Click pentru a filtra produsele epuizate"
          >
            <div className="text-[10px] font-semibold uppercase tracking-widest text-red-400">
              Epuizate {onlyLow ? "· filtrat" : ""}
            </div>
            <div
              className={`mt-1 text-2xl font-bold ${stats.out_of_stock_count > 0 ? "text-red-600" : "text-slate-300"}`}
            >
              {fmtNum(stats.out_of_stock_count)}
            </div>
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Caută produs, SKU, marcă…"
          className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#feab1f] transition"
        />
        <button
          onClick={() => handleLowToggle(!onlyLow)}
          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition
            ${onlyLow ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${onlyLow ? "bg-red-500" : "bg-slate-300"}`}
          />
          Doar epuizate
        </button>
        <button
          onClick={() => load(q, onlyLow, selectedWhId)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          ↻ Reîncarcă
        </button>
        <div className="ml-auto text-xs text-slate-400">
          {loading ? "Se încarcă…" : `${stock.length} produse`}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading && stock.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-slate-400">
            Se încarcă stocul…
          </div>
        ) : stock.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="text-3xl mb-3">📦</div>
            <div className="text-sm font-semibold text-slate-500">
              {q || onlyLow
                ? "Niciun produs găsit."
                : "Niciun produs în stoc pentru acest depozit."}
            </div>
            {(q || onlyLow) && (
              <button
                onClick={() => {
                  setQ("");
                  setOnlyLow(false);
                  load("", false, selectedWhId);
                }}
                className="mt-3 text-xs text-indigo-600 hover:underline"
              >
                Șterge filtrele
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
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
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">
                    Actualizat
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right w-40"></th>
                </tr>
              </thead>
              <tbody>
                {stock.map((row) => (
                  <StockRowItem
                    key={row.product_id}
                    row={row}
                    warehouseId={warehouse?.id ?? ""}
                    onSaved={handleSaved}
                    onError={(msg) => showToast(msg, false)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400 text-center">
        Modificările de stoc fizic sunt salvate imediat și actualizează automat
        stocul total al produsului. Cantitățile rezervate nu pot fi modificate
        manual.
      </p>
    </div>
  );
}
