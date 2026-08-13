"use client";

import { useCallback, useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import InvoicePdfDocument from "@/components/admin/InvoicePdfDocument";

type Invoice = {
  id: string;
  invoice_type: string;
  series: string;
  number: number;
  invoice_date: string;
  due_date: string | null;
  delivery_method: string;
  payment_method: string;
  total_net: number;
  total_tax: number;
  total_gross: number;
  created_at: string;
  customer_name: string;
  customer_vat: string | null;
  created_by_name: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtNum(v: any) {
  return Number(v ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FacturiPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invoices?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.ok) setInvoices(data.items || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSearch(val: string) {
    setQ(val);
    setTimeout(() => load(val), 300);
  }

  async function downloadPdf(invoiceId: string) {
    setDownloading(invoiceId);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`);
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Eroare"); return; }
      const blob = await pdf(<InvoicePdfDocument data={data.data} />).toBlob();
      saveAs(blob, `Factura-${data.data.series}-${data.data.number}.pdf`);
    } catch (e: any) {
      alert(e.message || "Eroare la generarea PDF-ului.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Facturi</h1>
        <p className="mt-1 text-sm text-slate-700">
          Toate facturile generate. Pentru a crea o factura noua, deschide o oferta.
        </p>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Cauta dupa client, serie, numar..."
        className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-[#feab1f] focus:ring-1 focus:ring-[#feab1f]"
      />

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-600">Se incarca...</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm text-slate-700">
            {q ? "Nicio factura gasita." : "Nu exista facturi generate."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                <th className="px-4 py-3">Serie / Nr.</th>
                <th className="px-4 py-3">Tip</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">TVA</th>
                <th className="px-4 py-3">Plata</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-slate-900">{inv.series}</span>
                    <span className="ml-1 font-mono text-slate-900">/ {inv.number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      inv.invoice_type === "proforma"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-green-50 text-green-700"
                    }`}>
                      {inv.invoice_type === "proforma" ? "Proforma" : "Definitiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{inv.customer_name}</div>
                    {inv.customer_vat && (
                      <div className="text-xs text-slate-600">{inv.customer_vat}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{fmtDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {fmtNum(inv.total_gross)} RON
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {fmtNum(inv.total_tax)} RON
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">{inv.payment_method}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => downloadPdf(inv.id)}
                      disabled={downloading === inv.id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      {downloading === inv.id ? "..." : "PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
