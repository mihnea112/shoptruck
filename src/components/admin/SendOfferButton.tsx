'use client';

import React, { useState } from 'react';

export default function SendOfferButton({ offerId }: { offerId: string }) {
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    try {
      setLoading(true);

      const res = await fetch(`/api/admin/offers/${offerId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        alert(`Eroare: ${json.error || 'Nu s-a putut trimite oferta'}`);
        return;
      }

      alert('Oferta a fost trimisă cu succes!');
    } catch (error) {
      console.error('Eroare la trimitere:', error);
      alert('Nu s-a putut trimite oferta. Verifică consola.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className={`
        flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium border rounded transition-all
        ${loading
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-black shadow-sm'}
      `}
      title="Trimite oferta clientului prin email (PDF-ul va fi generat la trimitere)"
    >
      {loading ? (
        <span>Se trimite...</span>
      ) : (
        <>
          {/* Mail icon */}
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
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          <span>Trimite</span>
        </>
      )}
    </button>
  );
}
