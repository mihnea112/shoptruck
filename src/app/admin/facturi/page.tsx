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
  is_b2c: boolean;
  anaf_status: string | null;
  anaf_status_detail: string | null;
  anaf_upload_id: string | null;
};

const ANAF_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  trimisa: { label: "Trimisa la ANAF", className: "bg-amber-50 text-amber-700" },
  ok: { label: "Acceptata ANAF", className: "bg-green-50 text-green-700" },
  nok: { label: "Respinsa ANAF", className: "bg-red-50 text-red-700" },
  eroare: { label: "Eroare trimitere", className: "bg-red-50 text-red-700" },
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sendingAnaf, setSendingAnaf] = useState<string | null>(null);
  const [anafConnected, setAnafConnected] = useState<boolean | null>(null);

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

  useEffect(() => {
    fetch("/api/admin/efactura/status")
      .then((r) => r.json())
      .then((d) => setAnafConnected(Boolean(d?.connected)))
      .catch(() => setAnafConnected(null));
  }, []);

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

  async function sendToAnaf(inv: Invoice) {
    if (!confirm(`Trimiti factura ${inv.series}/${inv.number} la e-Factura ANAF?`)) return;
    setSendingAnaf(inv.id);
    try {
      const res = await fetch(`/api/admin/invoices/${inv.id}/efactura`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Eroare la trimiterea catre ANAF."); return; }
      setInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, anaf_status: "trimisa", anaf_upload_id: data.uploadId } : i))
      );
    } catch (e: any) {
      alert(e.message || "Eroare la trimiterea catre ANAF.");
    } finally {
      setSendingAnaf(null);
    }
  }

  async function checkAnafStatus(inv: Invoice) {
    setSendingAnaf(inv.id);
    try {
      const res = await fetch(`/api/admin/invoices/${inv.id}/efactura`);
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Eroare la verificarea statusului."); return; }
      setInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, anaf_status: data.status ?? i.anaf_status } : i))
      );
    } catch (e: any) {
      alert(e.message || "Eroare la verificarea statusului.");
    } finally {
      setSendingAnaf(null);
    }
  }

  async function deleteInvoice(inv: Invoice) {
    if (!confirm(`Stergi factura ${inv.series}/${inv.number}?`)) return;
    setDeleting(inv.id);
    try {
      const res = await fetch(`/api/admin/invoices?id=${inv.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Eroare"); return; }
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (e: any) {
      alert(e.message || "Eroare la stergere.");
    } finally {
      setDeleting(null);
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

      {anafConnected === false && (
        <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <span className="text-amber-800">
            e-Factura ANAF nu este conectata. Trimiterea facturilor catre ANAF necesita autorizare cu certificatul digital.
          </span>
          <a
            href="/api/admin/efactura/connect"
            className="ml-4 shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
          >
            Conecteaza ANAF
          </a>
        </div>
      )}

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
                <th className="px-4 py-3">e-Factura</th>
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
                    {inv.invoice_type === "proforma" ? (
                      <span className="text-xs text-slate-600">-</span>
                    ) : inv.anaf_status ? (
                      <div className="flex flex-col gap-1">
                        <span
                          className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            ANAF_STATUS_LABEL[inv.anaf_status]?.className || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ANAF_STATUS_LABEL[inv.anaf_status]?.label || inv.anaf_status}
                        </span>
                        {inv.anaf_status === "trimisa" && (
                          <button
                            onClick={() => checkAnafStatus(inv)}
                            disabled={sendingAnaf === inv.id}
                            className="w-fit text-xs font-semibold text-[#feab1f] hover:underline disabled:opacity-50"
                          >
                            {sendingAnaf === inv.id ? "..." : "Verifica status"}
                          </button>
                        )}
                        {inv.anaf_status === "nok" && inv.anaf_status_detail && (
                          <span className="text-xs text-red-700">{inv.anaf_status_detail}</span>
                        )}
                        {inv.anaf_status === "eroare" && (
                          <button
                            onClick={() => sendToAnaf(inv)}
                            disabled={sendingAnaf === inv.id}
                            className="w-fit text-xs font-semibold text-[#feab1f] hover:underline disabled:opacity-50"
                          >
                            {sendingAnaf === inv.id ? "..." : "Retrimite"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => sendToAnaf(inv)}
                        disabled={sendingAnaf === inv.id || anafConnected === false}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
                        title={anafConnected === false ? "Conecteaza ANAF mai intai" : undefined}
                      >
                        {sendingAnaf === inv.id ? "..." : "Trimite la ANAF"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadPdf(inv.id)}
                        disabled={downloading === inv.id}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
                      >
                        {downloading === inv.id ? "..." : "PDF"}
                      </button>
                      <button
                        onClick={() => deleteInvoice(inv)}
                        disabled={deleting === inv.id}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      >
                        {deleting === inv.id ? "..." : "Sterge"}
                      </button>
                    </div>
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
