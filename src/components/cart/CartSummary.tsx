"use client";

import Link from "next/link";

interface CartSummaryProps {
  subtotalNet: number;
  tax: number;
  totalGross: number;
  itemCount: number;
}

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CartSummary({
  subtotalNet,
  tax,
  totalGross,
  itemCount,
}: CartSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">
        Rezumat coș
      </h3>

      <div className="space-y-3 mb-6 pb-6 border-b border-slate-200">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal (net):</span>
          <span className="font-medium">{formatRON(subtotalNet)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>TVA:</span>
          <span className="font-medium">{formatRON(tax)}</span>
        </div>
      </div>

      <div className="mb-6 flex justify-between">
        <span className="text-lg font-semibold text-slate-900">Total:</span>
        <span className="text-2xl font-bold text-amber-400">
          {formatRON(totalGross)}
        </span>
      </div>

      <Link
        href={itemCount > 0 ? "/checkout" : "/catalog"}
        className={`
          block w-full py-3 rounded-full font-semibold text-center
          transition
          ${itemCount > 0
            ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
            : "bg-slate-300 text-slate-500 cursor-not-allowed"
          }
        `}
        onClick={(e) => {
          if (itemCount === 0) e.preventDefault();
        }}
      >
        {itemCount > 0 ? "Continuă cu plata" : "Coșul este gol"}
      </Link>

      <p className="mt-4 text-xs text-slate-500 text-center">
        {itemCount} produs{itemCount !== 1 ? "e" : ""} în coș
      </p>
    </div>
  );
}
