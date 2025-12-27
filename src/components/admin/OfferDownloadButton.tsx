'use client';

import React, { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver'; 
import OfferPDFDocument from './OfferPdfDocument';

export default function OfferDownloadButton({ offerId }: { offerId: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);

      // 1. Facem fetch la datele COMPLETE ale ofertei
      const res = await fetch(`/api/admin/offers/${offerId}`);
      
      if (!res.ok) throw new Error("Eroare la descărcarea datelor");
      
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Date invalide");

      const offerData = json.data;

      // 2. Generăm PDF-ul în memorie
      const blob = await pdf(<OfferPDFDocument offer={offerData} />).toBlob();

      // 3. Salvăm fișierul
      saveAs(blob, `Oferta-${offerId.slice(0, 6).toUpperCase()}.pdf`);

    } catch (error) {
      console.error("Eroare PDF:", error);
      alert("Nu s-a putut genera PDF-ul. Verifică consola.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      // Stilizare Tailwind standard (fără componente externe)
      className={`
        flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium border rounded transition-all
        ${loading 
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-black shadow-sm'}
      `}
    >
      {loading ? (
        // Text simplu când încarcă
        <span>Se generează...</span>
      ) : (
        <>
          {/* Iconiță SVG Download (scrisă manual, nu necesită librărie) */}
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </>
      )}
    </button>
  );
}