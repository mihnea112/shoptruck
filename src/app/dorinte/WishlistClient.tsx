"use client";

import { useWishlist } from "@/hooks/useWishlist";
import { FavoriteButton } from "@/components/products/FavoriteButton";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function WishlistClient() {
  const { items, isLoading, error, reload } = useWishlist();
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
        <div className="text-sm text-slate-500">Se încarcă dorințele...</div>
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
        <div className="mb-4 text-4xl">♡</div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">
          Nu ai salvat nici un produs
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
    <div className="space-y-4">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
                Acțiune
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b border-slate-200 transition hover:bg-slate-50 ${
                  idx === items.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-6 py-4">
                  <Link
                    href={`/produs/${item.slug}`}
                    className="text-sm font-medium text-slate-900 hover:text-amber-600 transition"
                  >
                    {item.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {item.brand_name || "—"}
                </td>
                <td className="px-6 py-4 text-xs font-mono text-slate-600">
                  {item.primary_code || "—"}
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-900">
                  {formatRON(item.price_gross)}
                </td>
                <td className="px-6 py-4 text-center">
                  <FavoriteButton productId={item.product_id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/produs/${item.slug}`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-amber-400 hover:shadow-sm"
          >
            <div className="flex gap-4">
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
                <h3 className="font-medium text-slate-900 truncate">
                  {item.name}
                </h3>
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

              {/* Favorite Button */}
              <div className="flex-shrink-0">
                <FavoriteButton productId={item.product_id} size="sm" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats Footer */}
      <div className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <span>{items.length} produs{items.length !== 1 ? "e" : ""} salvat{items.length !== 1 ? "e" : ""}</span>
      </div>
    </div>
  );
}
