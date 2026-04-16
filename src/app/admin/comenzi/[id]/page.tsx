"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────
type OrderStatus =
  | "PLACED"
  | "PARTIAL_ALLOCATED"
  | "ALLOCATED"
  | "SHIPPED"
  | "CANCELLED";

type OrderItem = {
  id: string;
  productId?: string;
  name: string;
  sku?: string | null;
  uom?: string | null;
  qty: number;
  reserved_qty: number;
  unit_price_net: number;
  tax_rate: number;
  line_net: number;
  line_tax: number;
  line_gross: number;
  stock_on_hand: number;
  stock_reserved: number;
  stock_available: number;
  missing_qty: number;
};

type Order = {
  id: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  notes?: string | null;
  offerId?: string | null;
  customer?: {
    display_name?: string | null;
    email?: string | null;
    phone?: string | null;
    tax_id?: string | null;
    reg_no?: string | null;
  } | null;
  vehicle?: {
    plate_no?: string | null;
    chassis_vin?: string | null;
    make?: string | null;
    model?: string | null;
    year?: number | null;
  } | null;
  totals: { total_net: number; total_tax: number; total_gross: number };
  items: OrderItem[];
  warehouse?: { id: string; code: string; name: string } | null;
};

// ─── Helpers ─────────────────────────────────────────────────
function fmtRON(v: number) {
  return (
    new Intl.NumberFormat("ro-RO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v) + " RON"
  );
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

// ─── Status config ───────────────────────────────────────────
type StatusCfg = {
  label: string;
  pill: string;
  dot: string;
  description: string;
};

const STATUS_CFG: Record<OrderStatus, StatusCfg> = {
  PLACED: {
    label: "Plasată",
    pill: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    description: "Comanda a fost creată. Stocul nu a fost rezervat încă.",
  },
  PARTIAL_ALLOCATED: {
    label: "Parțial Alocat",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
    description:
      "O parte din produse sunt rezervate. Restul se vor aloca automat când intră stoc.",
  },
  ALLOCATED: {
    label: "Alocat Complet",
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    description: "Toate produsele sunt rezervate. Comanda poate fi expediată.",
  },
  SHIPPED: {
    label: "Expediată",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    description: "Comanda a fost expediată și stocul a fost scăzut.",
  },
  CANCELLED: {
    label: "Anulată",
    pill: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-400",
    description:
      "Comanda a fost anulată. Rezervările de stoc au fost eliberate.",
  },
};

// ─── Action config ────────────────────────────────────────────
type Action = {
  label: string;
  endpoint: string;
  style: string;
  confirm?: string;
  icon: string;
};

function getActions(status: OrderStatus): Action[] {
  switch (status) {
    case "PLACED":
      return [
        {
          label: "Rezervă Stoc",
          endpoint: "reserve",
          style: "bg-indigo-600 hover:bg-indigo-700 text-white",
          icon: "📦",
        },
        {
          label: "Anulează",
          endpoint: "cancel",
          style:
            "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
          confirm: "Ești sigur că vrei să anulezi comanda?",
          icon: "✕",
        },
      ];
    case "PARTIAL_ALLOCATED":
      return [
        {
          label: "Rezervă Restul",
          endpoint: "reserve",
          style: "bg-indigo-600 hover:bg-indigo-700 text-white",
          icon: "📦",
        },
        {
          label: "Eliberează Rezervările",
          endpoint: "release",
          style: "bg-slate-100 hover:bg-slate-200 text-slate-700",
          confirm:
            "Eliberezi toate rezervările de stoc pentru această comandă?",
          icon: "↩",
        },
        {
          label: "Anulează",
          endpoint: "cancel",
          style:
            "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
          confirm: "Ești sigur că vrei să anulezi comanda?",
          icon: "✕",
        },
      ];
    case "ALLOCATED":
      return [
        {
          label: "Expediază",
          endpoint: "ship",
          style: "bg-emerald-600 hover:bg-emerald-700 text-white",
          confirm: "Confirmi expedierea? Stocul va fi scăzut definitiv.",
          icon: "🚚",
        },
        {
          label: "Eliberează Rezervările",
          endpoint: "release",
          style: "bg-slate-100 hover:bg-slate-200 text-slate-700",
          confirm:
            "Eliberezi toate rezervările de stoc pentru această comandă?",
          icon: "↩",
        },
        {
          label: "Anulează",
          endpoint: "cancel",
          style:
            "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
          confirm: "Ești sigur că vrei să anulezi comanda?",
          icon: "✕",
        },
      ];
    default:
      return [];
  }
}

// ─── Stock bar ────────────────────────────────────────────────
function StockBar({ item }: { item: OrderItem }) {
  const pct =
    item.qty > 0 ? Math.min(100, (item.reserved_qty / item.qty) * 100) : 0;
  const isFull = item.reserved_qty >= item.qty;
  const isNone = item.reserved_qty === 0;

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
        <span>
          Rezervat:{" "}
          <span className="font-semibold text-slate-700">
            {item.reserved_qty}
          </span>{" "}
          / {item.qty}
        </span>
        {item.missing_qty > 0 && (
          <span className="text-amber-600 font-semibold">
            Lipsă: {item.missing_qty} {item.uom ?? "buc"}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isFull ? "bg-emerald-500" : isNone ? "bg-slate-300" : "bg-amber-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10px] text-slate-400">
        Disponibil în stoc: {item.stock_available} {item.uom ?? "buc"}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Eroare la încărcare.");
      setOrder(data.data ?? data.item ?? null);
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcarea comenzii.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const runAction = async (action: Action) => {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setActionLoading(action.endpoint);
    try {
      const res = await fetch(`/api/admin/orders/${id}/${action.endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Eroare.");
      const successMsg =
        action.endpoint === "reserve"
          ? "Stoc rezervat cu succes."
          : action.endpoint === "release"
            ? "Rezervările au fost eliberate."
            : action.endpoint === "ship"
              ? "Comanda a fost marcată ca expediată."
              : "Comanda a fost anulată.";
      showToast(successMsg, true);
      await load();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        Se încarcă comanda…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!order) return null;

  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.PLACED;
  const actions = getActions(order.status);
  const acc = order.customer;
  const veh = order.vehicle;

  const allAllocated = order.items.every((it) => it.reserved_qty >= it.qty);
  const noneAllocated = order.items.every((it) => it.reserved_qty === 0);
  const missingTotal = order.items.reduce((s, it) => s + it.missing_qty, 0);
  const isTerminal = ["SHIPPED", "CANCELLED"].includes(order.status);

  return (
    <div className="w-full space-y-5 pb-16">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link href="/admin" className="hover:text-slate-800">
          Admin
        </Link>
        <span>/</span>
        <Link href="/admin/comenzi" className="hover:text-slate-800">
          Comenzi
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-700 truncate max-w-[14rem]">
          {id}
        </span>
      </nav>

      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">Comandă</h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${cfg.pill}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-slate-400">{order.id}</p>
            <p className="mt-1 text-xs text-slate-500">
              Creată: {fmtDate(order.created_at)} &middot; Actualizată:{" "}
              {fmtDate(order.updated_at)}
            </p>
            {order.offerId && (
              <Link
                href={`/admin/oferte/${order.offerId}`}
                className="mt-1 inline-block text-xs text-indigo-600 hover:underline"
              >
                ← Vezi oferta originală
              </Link>
            )}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.endpoint}
                  onClick={() => runAction(action)}
                  disabled={actionLoading !== null}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${action.style}`}
                >
                  <span>{action.icon}</span>
                  {actionLoading === action.endpoint
                    ? "Se procesează…"
                    : action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status description */}
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {cfg.description}
          {order.status === "PARTIAL_ALLOCATED" && missingTotal > 0 && (
            <span className="ml-1 font-semibold text-amber-700">
              ({missingTotal}{" "}
              {missingTotal === 1 ? "unitate lipsă" : "unități lipsă"} — se vor
              aloca automat când intră stoc.)
            </span>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
            Client
          </div>
          <div className="font-semibold text-slate-900">
            {acc?.display_name ?? "—"}
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            {acc?.email && <div>{acc.email}</div>}
            {acc?.phone && <div>{acc.phone}</div>}
            {acc?.tax_id && <div className="font-mono">CUI: {acc.tax_id}</div>}
            {acc?.reg_no && <div className="font-mono">Reg: {acc.reg_no}</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
            Vehicul
          </div>
          <div className="font-semibold text-slate-900">
            {veh?.plate_no ?? "—"}
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
            {(veh?.make || veh?.model) && (
              <div>
                {[veh?.make, veh?.model].filter(Boolean).join(" ")}{" "}
                {veh?.year ? `(${veh.year})` : ""}
              </div>
            )}
            {veh?.chassis_vin && (
              <div className="font-mono">VIN: {veh.chassis_vin}</div>
            )}
          </div>
        </div>

        {order.warehouse && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Depozit
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
                {order.warehouse.code}
              </span>
              <span className="font-semibold text-slate-900">
                {order.warehouse.name}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
            Total Comandă
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {fmtRON(order.totals.total_gross)}
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-slate-500">
            <div>Net: {fmtRON(order.totals.total_net)}</div>
            <div>TVA: {fmtRON(order.totals.total_tax)}</div>
          </div>
        </div>
      </div>

      {/* Stock banner */}
      {!isTerminal && (
        <div
          className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
            allAllocated
              ? "border-emerald-200 bg-emerald-50"
              : noneAllocated
                ? "border-slate-200 bg-slate-50"
                : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="text-2xl">
            {allAllocated ? "✅" : noneAllocated ? "📭" : "⏳"}
          </div>
          <div>
            <div
              className={`text-sm font-semibold ${
                allAllocated
                  ? "text-emerald-800"
                  : noneAllocated
                    ? "text-slate-700"
                    : "text-amber-800"
              }`}
            >
              {allAllocated
                ? "Toate produsele sunt rezervate — comanda poate fi expediată."
                : noneAllocated
                  ? "Niciun produs nu este rezervat încă."
                  : `${missingTotal} ${
                      missingTotal === 1 ? "unitate" : "unități"
                    } nu sunt disponibile în stoc.`}
            </div>
            {!allAllocated && !noneAllocated && (
              <div className="mt-0.5 text-xs text-amber-700">
                Produsele lipsă vor fi alocate automat când intră stoc.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="text-sm font-semibold text-slate-900">
            Produse ({order.items.length})
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                  Produs
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">
                  Cant.
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 min-w-[180px]">
                  Stoc / Alocare
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">
                  Preț unit (net)
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">
                  TVA
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">
                  Total (gross)
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-sm text-slate-400 text-center"
                  >
                    Comanda nu are linii.
                  </td>
                </tr>
              ) : (
                order.items.map((it) => {
                  const fullyRes = it.reserved_qty >= it.qty;
                  const noneRes = it.reserved_qty === 0;
                  const taxPct =
                    (it.tax_rate <= 1 ? it.tax_rate : it.tax_rate / 100) * 100;

                  return (
                    <tr
                      key={it.id}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">
                          {it.name}
                        </div>
                        {it.sku && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {it.sku}
                          </div>
                        )}
                        {!isTerminal && (
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              fullyRes
                                ? "bg-emerald-50 text-emerald-700"
                                : noneRes
                                  ? "bg-slate-100 text-slate-500"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {fullyRes
                              ? "✓ Rezervat complet"
                              : noneRes
                                ? "Nerezerv."
                                : `Parțial — lipsă ${it.missing_qty} ${it.uom ?? "buc"}`}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {it.qty} {it.uom ?? "buc"}
                      </td>

                      <td className="px-4 py-3">
                        {isTerminal ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <StockBar item={it} />
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {it.unit_price_net.toFixed(4)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {taxPct.toFixed(0)}%
                      </td>

                      <td className="px-4 py-3 text-right font-semibold font-mono text-slate-900">
                        {fmtRON(it.line_gross)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
            Notițe
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {order.notes}
          </p>
        </div>
      )}
    </div>
  );
}
