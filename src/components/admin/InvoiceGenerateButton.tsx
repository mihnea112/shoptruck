"use client";

import React, { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import InvoicePdfDocument from "./InvoicePdfDocument";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#feab1f] focus:ring-1 focus:ring-[#feab1f]";

const DELIVERY_OPTIONS = [
  "Ridicare personala din depozit",
  "Livrare prin curier",
  "Transport propriu",
];

const PAYMENT_OPTIONS = [
  "SE ACHITA CU OP LA 15 ZILE",
  "SE ACHITA CU OP LA 30 ZILE",
  "NUMERAR",
  "CARD BANCAR",
  "PLATA LA LIVRARE",
];

export default function InvoiceGenerateButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoiceType, setInvoiceType] = useState<"definitiva" | "proforma">("definitiva");
  const [deliveryMethod, setDeliveryMethod] = useState(DELIVERY_OPTIONS[0]);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_OPTIONS[0]);
  const [dueDays, setDueDays] = useState(15);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      // 1. Create invoice in DB
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          invoiceType,
          deliveryMethod,
          paymentMethod,
          dueDays,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Eroare la generarea facturii.");
        return;
      }

      const invoiceId = data.invoice.id;

      // 2. Fetch full invoice data
      const detailRes = await fetch(`/api/admin/invoices/${invoiceId}`);
      const detailData = await detailRes.json();
      if (!detailRes.ok || !detailData.ok) {
        setError("Factura a fost creata dar nu s-au putut incarca datele pentru PDF.");
        return;
      }

      // 3. Generate PDF
      const blob = await pdf(<InvoicePdfDocument data={detailData.data} />).toBlob();
      const fileName = `Factura-${data.invoice.series}-${data.invoice.number}.pdf`;
      saveAs(blob, fileName);

      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Eroare neasteptata.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-[#feab1f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e89a10]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
        Genereaza factura
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">Genereaza factura</h2>
              <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-900 text-xl leading-none">
                ✕
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {/* Invoice type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Tip factura <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setInvoiceType("definitiva")}
                    className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition ${
                      invoiceType === "definitiva"
                        ? "border-[#feab1f] bg-[#feab1f]/10 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Definitiva
                  </button>
                  <button
                    onClick={() => setInvoiceType("proforma")}
                    className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition ${
                      invoiceType === "proforma"
                        ? "border-[#feab1f] bg-[#feab1f]/10 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Proforma
                  </button>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Modalitate de plata <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputCls}
                >
                  {PAYMENT_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Delivery method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Modalitate de livrare <span className="text-red-500">*</span>
                </label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className={inputCls}
                >
                  {DELIVERY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Due days */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Termen scadenta (zile)
                </label>
                <input
                  type="number"
                  min="0"
                  value={dueDays}
                  onChange={(e) => setDueDays(Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Anuleaza
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="rounded-lg bg-[#feab1f] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e89a10] disabled:opacity-50"
              >
                {loading ? "Se genereaza..." : "Genereaza & Descarca PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
