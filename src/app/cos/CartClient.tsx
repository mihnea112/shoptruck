"use client";

import { useCart } from "@/hooks/useCart";
import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CartClient() {
  const { items, total, isLoading, error, updateQuantity, removeItem, reload } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    reload();
  }, []);

  if (!mounted) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-slate-500">Se încarcă...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-slate-500">Se încarcă coșul...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
        <div className="mb-4 text-4xl">🛒</div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">
          Coșul tău este gol
        </h3>
        <p className="mb-6 text-sm text-slate-600">
          Explorează catalogul și adaugă produsele care îți plac
        </p>
        <Link
          href="/catalog"
          className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Mergi la catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Cart Items */}
      <div>
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white w-full">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">
                  Produs
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">
                  Brand
                </th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">
                  Cod
                </th>
                <th className="px-6 py-3 text-right font-semibold text-slate-900">
                  Preț
                </th>
                <th className="px-6 py-3 text-center font-semibold text-slate-900">
                  Cantitate
                </th>
                <th className="px-6 py-3 text-right font-semibold text-slate-900">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-center font-semibold text-slate-900">
                  Acțiune
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex gap-4 mb-4">
                {/* Image */}
                {item.primary_image_path && (
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.primary_image_path}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/produs/${item.slug}`}
                    className="font-medium text-slate-900 hover:text-amber-600 transition truncate block"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.brand_name || "—"}
                  </p>
                  {item.primary_code && (
                    <p className="text-xs font-mono text-slate-500 mt-1">
                      {item.primary_code}
                    </p>
                  )}
                  <div className="mt-2 font-semibold text-slate-900">
                    {formatRON(item.price_gross)}
                  </div>
                </div>
              </div>

              {/* Quantity & Subtotal */}
              <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 transition text-sm"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-medium text-sm">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 transition text-sm"
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatRON(item.price_gross * item.quantity)}
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold transition"
                  >
                    Elimină
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 max-w-sm ml-auto">
        <CartSummary
          subtotalNet={total.net}
          tax={total.tax}
          totalGross={total.gross}
          itemCount={items.length}
        />
      </div>
    </div>
  );
}
