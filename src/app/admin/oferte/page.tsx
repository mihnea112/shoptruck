"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import OfferDownloadButton from "@/components/admin/OfferDownloadButton";

// Helper functions for offer item price/qty calculations
function num(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeTaxRate(rate: number): number {
  // supports 0.19 or 19
  return rate <= 1 ? rate : rate / 100;
}

function computeLineGross(it: any): number {
  // Prefer explicit line gross if present
  const lg = num(
    it?.line_gross ?? it?.lineGross ?? it?.line_total_gross ?? it?.total_gross,
  );
  if (lg != null) return lg;

  // Otherwise compute from unit net + qty + tax
  const qty = num(it?.quantity ?? it?.qty) ?? 0;

  // unit net may appear under multiple names
  const unitNet = num(
    it?.unit_price_net ??
      it?.unitPriceNet ??
      it?.unit_net ??
      it?.unitNet ??
      it?.unit_price ??
      it?.unitPrice ??
      it?.price ??
      it?.unitPriceRON,
  );

  // tax may appear under multiple names, or on nested product
  const taxRaw =
    num(it?.tax_rate ?? it?.taxRate ?? it?.tax ?? it?.vat) ??
    num(it?.product?.tax_rate ?? it?.product?.taxRate ?? it?.product?.vat) ??
    null;

  // If we have unit net, use it
  if (unitNet != null) {
    const tax = normalizeTaxRate(taxRaw ?? 0);
    const lineNet = unitNet * qty;
    const gross = lineNet * (1 + tax);
    return Math.round(gross * 100) / 100;
  }

  // Fallback: derive a gross unit price from the linked product (buy + margin + tax)
  // This is only used when the offer_item itself doesn't carry any price fields.
  const buy = num(it?.product?.buy_price_net ?? it?.buy_price_net);
  const mar = num(it?.product?.profit_margin_pct ?? it?.profit_margin_pct);

  // tax may be nested (common shapes)
  const prodTaxRaw =
    taxRaw ??
    num(it?.product?.tax_rate?.rate) ??
    num(it?.product?.tax_rate_rate) ??
    num(it?.product?.tax_rate_value) ??
    null;

  if (buy != null && mar != null) {
    const tax = normalizeTaxRate(prodTaxRaw ?? 0);
    const sellNet = buy * (1 + mar / 100);
    const grossUnit = sellNet * (1 + tax);
    const gross = grossUnit * qty;
    return Math.round(gross * 100) / 100;
  }

  return 0;
}

function computeUnitGross(it: any): number {
  const qty = num(it?.quantity ?? it?.qty) ?? 0;
  if (qty <= 0) return 0;

  // Prefer explicit unit gross if present
  const ug = num(
    it?.unit_price_gross ??
      it?.unitPriceGross ??
      it?.unit_gross ??
      it?.unitGross ??
      it?.unitPriceGrossRON,
  );
  if (ug != null) return Math.round(ug * 100) / 100;

  const lineGross = computeLineGross(it);
  const unit = lineGross / qty;
  return Math.round(unit * 100) / 100;
}

// Icons
const Icons = {
  Plus: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  ),
  Print: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  ),
  Edit: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  ),
  Trash: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  Loading: () => (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  ),
  Cart: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m14-9l2 9m-5-2a2 2 0 11-4 0m-6 0a2 2 0 11-4 0"
      />
    </svg>
  ),
  Check: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
};

export default function OffersListPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  // Convert offer -> order UI
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertOfferId, setConvertOfferId] = useState<string | null>(null);
  const [convertOffer, setConvertOffer] = useState<any | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<
    { id: string; code: string; name: string }[]
  >([]);
  const [convertWarehouseId, setConvertWarehouseId] = useState<string>("");

  const offerItems = useMemo(() => {
    const items =
      convertOffer?.items ??
      convertOffer?.offer_items ??
      convertOffer?.offerItems ??
      [];
    return Array.isArray(items) ? items : [];
  }, [convertOffer]);

  const allSelected = useMemo(() => {
    if (!offerItems.length) return false;
    const s = new Set(selectedItemIds);
    return offerItems.every((it: any) => s.has(String(it.id)));
  }, [offerItems, selectedItemIds]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/offers", {
        headers: { accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}) as any);

      if (res.ok && data?.ok) {
        // Support multiple response shapes: { offers: [] } or { items: [] }
        const list = Array.isArray(data.offers)
          ? data.offers
          : Array.isArray(data.items)
            ? data.items
            : [];
        setOffers(list);
      } else {
        setOffers([]);
      }
    } catch {
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sigur ștergi această ofertă?")) return;
    await fetch(`/api/admin/offers/${id}`, { method: "DELETE" });
    fetchOffers();
  };

  const openConvert = async (offerId: string) => {
    setConvertError(null);
    setConvertOffer(null);
    setSelectedItemIds([]);
    setConvertOfferId(offerId);
    setConvertOpen(true);
    setConvertLoading(true);

    try {
      const res = await fetch(`/api/admin/offers/${offerId}`, {
        headers: { accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Nu pot încărca oferta.");
      }

      // Support multiple shapes: { item }, { offer }, { data }
      const offer = data.item ?? data.offer ?? data.data ?? null;
      setConvertOffer(offer);

      const items =
        offer?.items ?? offer?.offer_items ?? offer?.offerItems ?? [];
      const list = Array.isArray(items) ? items : [];
      // Default: select all items
      setSelectedItemIds(list.map((x: any) => String(x.id)));
    } catch (e: any) {
      setConvertError(e?.message || "Eroare la încărcarea ofertei.");
    } finally {
      setConvertLoading(false);
    }
  };

  const closeConvert = () => {
    if (convertSubmitting) return;
    setConvertOpen(false);
    setConvertOfferId(null);
    setConvertOffer(null);
    setSelectedItemIds([]);
    setConvertError(null);
    setConvertLoading(false);
    setConvertSubmitting(false);
    // Reset warehouse to first available
    if (warehouses.length > 0) setConvertWarehouseId(warehouses[0].id);
  };

  const toggleItem = (id: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const s = new Set(prev);
      if (checked) s.add(id);
      else s.delete(id);
      return Array.from(s);
    });
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(offerItems.map((x: any) => String(x.id)));
  };

  const convertToOrder = async () => {
    if (!convertOfferId) return;
    if (selectedItemIds.length === 0) {
      setConvertError("Selectează cel puțin un produs pentru comandă.");
      return;
    }

    setConvertSubmitting(true);
    setConvertError(null);
    try {
      // Expected API (you already plan to implement it):
      // POST /api/admin/orders
      // body: { offer_id, item_ids }
      const res = await fetch(`/api/admin/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          offer_id: convertOfferId,
          item_ids: selectedItemIds,
          warehouse_id: convertWarehouseId || null,
        }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Conversia la comandă a eșuat.");
      }

      // Support: { id } or { order_id } or { order: { id } }
      const orderId = data.id ?? data.order_id ?? data.order?.id ?? null;
      closeConvert();

      // Redirect to order page if you have it, otherwise refresh list.
      if (orderId) {
        window.location.href = `/admin/comenzi/${orderId}`;
      } else {
        await fetchOffers();
      }
    } catch (e: any) {
      setConvertError(e?.message || "Eroare la conversie.");
    } finally {
      setConvertSubmitting(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    fetchOffers();
    // Load warehouses for order creation picker
    fetch("/api/admin/warehouses", { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.items)) {
          const active = d.items.filter((w: any) => w.is_active);
          setWarehouses(active);
          if (active.length > 0) setConvertWarehouseId(active[0].id);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-slate-800">Oferte</h1>
        <Link
          href="/admin/oferte/noua"
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 text-sm font-medium"
        >
          <Icons.Plus /> Ofertă Nouă
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Client</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Vehicul
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">Data</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Creat de
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-right">
                Total (RON)
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-center">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  Se încarcă...
                </td>
              </tr>
            ) : (offers?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  Nu există oferte.
                </td>
              </tr>
            ) : (
              (offers ?? []).map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {o?.account?.name ??
                      o?.customer?.display_name ??
                      o?.account_display_name ??
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                    {o?.vehicle?.label ?? o?.vehicle?.plate_no ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {o?.created_at
                      ? new Date(o.created_at).toLocaleDateString("ro-RO")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {o?.created_by?.name ?? o?.created_by?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">
                    {Number(
                      o?.total_gross ?? o?.totals?.total_gross ?? 0,
                    ).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      {/* Generare PDF */}
                      {isClient && <OfferDownloadButton offerId={o.id} />}

                      <button
                        onClick={() => openConvert(o.id)}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                        title="Transformă oferta în comandă"
                        type="button"
                      >
                        <Icons.Cart />
                      </button>

                      <Link
                        href={`/admin/oferte/${o.id}`}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                      >
                        <Icons.Edit />
                      </Link>
                      <button
                        onClick={() => handleDelete(o.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {convertOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Conversie ofertă → comandă
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Selectează produsele care intră în comandă. Implicit sunt
                  selectate toate.
                </div>
              </div>
              <button
                onClick={closeConvert}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                type="button"
              >
                Închide
              </button>
            </div>

            <div className="px-5 py-4">
              {convertLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Icons.Loading /> Se încarcă oferta…
                </div>
              ) : convertError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {convertError}
                </div>
              ) : !convertOffer ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Nu am putut încărca oferta.
                </div>
              ) : (
                <>
                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Client
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {convertOffer?.customer?.display_name ??
                          convertOffer?.customer?.name ??
                          "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Vehicul
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {convertOffer?.vehicle?.label ??
                          convertOffer?.vehicle?.plate_no ??
                          convertOffer?.vehicle?.plate_number ??
                          "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Total ofertă
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {(() => {
                          const raw = num(
                            convertOffer?.totals?.total_gross ??
                              convertOffer?.totals?.totalGross ??
                              convertOffer?.total_gross ??
                              convertOffer?.totalGross,
                          );
                          if (raw != null && raw > 0) return raw.toFixed(2);
                          const sum = offerItems.reduce(
                            (acc: number, it: any) =>
                              acc + computeLineGross(it),
                            0,
                          );
                          return sum.toFixed(2);
                        })()}{" "}
                        RON
                      </div>
                    </div>
                  </div>

                  {/* Warehouse picker */}
                  {warehouses.length > 0 && (
                    <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <svg
                        className="h-4 w-4 flex-shrink-0 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 10l9-7 9 7v11H3V10z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 20V14h6v6"
                        />
                      </svg>
                      <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                        Depozit expediere:
                      </label>
                      <select
                        value={convertWarehouseId}
                        onChange={(e) => setConvertWarehouseId(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#feab1f]"
                      >
                        <option value="">
                          -- Fara depozit (alocare manuala) --
                        </option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} -- {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">
                        Produse în ofertă
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleAll(e.target.checked)}
                        />
                        Selectează tot
                      </label>
                    </div>

                    <div className="max-h-[45vh] overflow-y-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white sticky top-0">
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2 w-10"></th>
                            <th className="px-4 py-2 font-semibold text-slate-700">
                              Produs
                            </th>
                            <th className="px-4 py-2 font-semibold text-slate-700 text-right">
                              Cant.
                            </th>
                            <th className="px-4 py-2 font-semibold text-slate-700 text-right">
                              Preț (RON)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {offerItems.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-4 text-sm text-slate-600"
                              >
                                Oferta nu are produse.
                              </td>
                            </tr>
                          ) : (
                            offerItems.map((it: any) => {
                              const id = String(it.id);
                              const checked = selectedItemIds.includes(id);
                              const name = it?.name ?? it?.product?.name ?? "—";
                              const qty = num(it?.quantity ?? it?.qty) ?? 0;
                              const lineGross = computeLineGross(it);
                              const unitGross = computeUnitGross(it);
                              return (
                                <tr key={id} className="hover:bg-slate-50">
                                  <td className="px-4 py-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        toggleItem(id, e.target.checked)
                                      }
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="font-medium text-slate-900">
                                      {name}
                                    </div>
                                    {it?.product?.sku ? (
                                      <div className="text-xs text-slate-500 font-mono">
                                        {it.product.sku}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-700">
                                    {qty.toFixed(3)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-slate-900">
                                    {lineGross.toFixed(2)}
                                    <div className="text-[11px] font-normal text-slate-500">
                                      {unitGross.toFixed(2)} / buc
                                    </div>
                                    {(() => {
                                      const unitNet = num(
                                        it?.unit_price_net ??
                                          it?.unitPriceNet ??
                                          it?.unit_net ??
                                          it?.unitNet ??
                                          it?.price,
                                      );
                                      if (unitNet == null) return null;
                                      return (
                                        <div className="text-[11px] font-normal text-slate-400">
                                          net: {unitNet.toFixed(4)} / buc
                                        </div>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {convertError ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {convertError}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={closeConvert}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                      disabled={convertSubmitting}
                      type="button"
                    >
                      Renunță
                    </button>
                    <button
                      onClick={convertToOrder}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-60"
                      disabled={
                        convertSubmitting || selectedItemIds.length === 0
                      }
                      type="button"
                    >
                      {convertSubmitting ? <Icons.Loading /> : <Icons.Check />}
                      Creează comandă
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
