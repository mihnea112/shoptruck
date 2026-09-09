"use client";

import React, { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import ChitantaPdfDocument from "./ChitantaPdfDocument";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#feab1f] focus:ring-1 focus:ring-[#feab1f]";

export default function ChitantaGenerateButton({ orderId, totalGross }: { orderId: string; totalGross?: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState(totalGross ?? 0);
  const [invoiceRef, setInvoiceRef] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/chitante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          amount: amount || undefined,
          invoiceRef: invoiceRef || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Eroare la generarea chitantei.");
        return;
      }

      const chitanta = data.chitanta;

      // Generate PDF directly from response data
      const blob = await pdf(
        <ChitantaPdfDocument data={{
          series: chitanta.series,
          number: chitanta.number,
          chitantaDate: new Date(chitanta.chitantaDate).toLocaleDateString("ro-RO", {
            day: "2-digit", month: "2-digit", year: "numeric"
          }),
          amount: chitanta.amount,
          amountWords: chitanta.amountWords,
          representing: chitanta.representing,
          customer: chitanta.customer,
        }} />
      ).toBlob();

      const fileName = `Chitanta-${chitanta.series}-${chitanta.number}.pdf`;
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
        onClick={() => { setAmount(totalGross ?? 0); setOpen(true); }}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M12 9v6" />
          <path d="M9 12h6" />
        </svg>
        Chitanta
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">Genereaza chitanta</h2>
              <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-900 text-xl leading-none">
                ✕
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Suma (LEI) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </div>

              {/* Invoice reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reprezentand (optional)
                </label>
                <input
                  type="text"
                  placeholder="ex: cvf CCATR2026 15"
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Daca lasi gol, se completeaza automat cu factura asociata.
                </p>
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
                disabled={loading || amount <= 0}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
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
