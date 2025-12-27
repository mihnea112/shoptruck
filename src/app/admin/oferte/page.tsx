"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PDFDownloadLink } from "@react-pdf/renderer";
// ✅ IMPORTĂM COMPONENTA DIN FIȘIERUL NOU (Asigură-te că calea e corectă)
import OfferPDFDocument from "@/components/admin/OfferPdfDocument"; 
import OfferDownloadButton from "@/components/admin/OfferDownloadButton";

// Icons
const Icons = {
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>,
  Print: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
  Loading: () => <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
};

export default function OffersListPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  const fetchOffers = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/offers");
    const data = await res.json();
    if (data.ok) setOffers(data.offers);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sigur ștergi această ofertă?")) return;
    await fetch(`/api/admin/offers/${id}`, { method: "DELETE" });
    fetchOffers();
  };

  useEffect(() => { 
    setIsClient(true);
    fetchOffers(); 
  }, []);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-slate-800">Oferte Service</h1>
        <Link href="/admin/oferte/noua" className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 text-sm font-medium">
          <Icons.Plus /> Ofertă Nouă
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Client</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Vehicul</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Data</th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-right">Total (RON)</th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-center">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">Se încarcă...</td></tr>
            ) : offers.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">Nu există oferte.</td></tr>
            ) : (
              offers.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-900">{o.clientName}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{o.vehicle}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(o.date).toLocaleDateString("ro-RO")}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{Number(o.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      
                      {/* Generare PDF */}
                      {isClient && (
                       <OfferDownloadButton offerId={o.id} />
                      )}

                      <Link href={`/admin/oferte/${o.id}`} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded">
                        <Icons.Edit />
                      </Link>
                      <button onClick={() => handleDelete(o.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
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
    </div>
  );
}