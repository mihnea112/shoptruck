"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MainHeader } from "@/components/layout/MainHeader";
import { MainFooter } from "@/components/layout/MainFooter";

type DiscountedProduct = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  price_gross: number;
  discount_price: number | null;
  discount_percentage: number;
  brand_name: string;
  category_name: string;
  primary_image_url: string | null;
};

export default function PromotionsPageUI() {
  const [products, setProducts] = useState<DiscountedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDiscountedProducts();
  }, []);

  async function loadDiscountedProducts() {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", "100");
      sp.set("offset", "0");
      sp.set("discount_active", "true");

      const res = await fetch(`/api/public/products?${sp}`);
      const data = await res.json();

      if (data.ok && data.items) {
        setProducts(data.items);
      } else {
        setError(data.error || "Failed to load promotions");
      }
    } catch (e) {
      console.error("Failed to load discounted products:", e);
      setError("Unable to load promotions");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <MainHeader />

      {/* Header/Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold">🎉 Promotii Speciale</h1>
          <p className="mt-2 text-lg text-red-100">
            Descoperi ofertele exclusive ale magazinului nostru
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-slate-600">Se incarca promotiile...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">
              Nu sunt disponibile promotii in acest moment.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 text-sm text-slate-600">
              Sunt {products.length} produse cu reduceri disponibile
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => {
                const originalPrice = product.price_gross;
                const discountedPrice = product.discount_price || 0;
                const savings = originalPrice - discountedPrice;

                return (
                  <Link
                    key={product.id}
                    href={`/produs/${product.slug}`}
                    className="group rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="relative overflow-hidden bg-slate-100">
                      {/* Discount Badge */}
                      <div className="absolute right-2 top-2 z-10 rounded-lg bg-red-600 px-3 py-1 text-sm font-bold text-white">
                        -{product.discount_percentage}%
                      </div>

                      {/* Product Image */}
                      {product.primary_image_url ? (
                        <Image
                          src={product.primary_image_url}
                          alt={product.name}
                          width={300}
                          height={250}
                          className="h-48 w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center bg-slate-200">
                          <span className="text-slate-400">No image</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      {/* Brand & Category */}
                      <div className="mb-2 text-xs text-slate-500">
                        {product.brand_name && (
                          <>
                            <span>{product.brand_name}</span>
                            {product.category_name && <span> • </span>}
                          </>
                        )}
                        {product.category_name && (
                          <span>{product.category_name}</span>
                        )}
                      </div>

                      {/* Product Name */}
                      <h3 className="mb-3 line-clamp-2 font-semibold text-slate-900 group-hover:text-orange-600">
                        {product.name}
                      </h3>

                      {/* SKU */}
                      <div className="mb-3 text-xs text-slate-500">
                        SKU: {product.sku}
                      </div>

                      {/* Prices */}
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-500 line-through">
                            {originalPrice} RON
                          </span>
                          <span className="font-bold text-green-600">
                            {discountedPrice} RON
                          </span>
                        </div>

                        {/* Savings */}
                        <div className="text-xs text-emerald-600">
                          💚 Economisezi {savings.toFixed(0)} RON
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button className="w-full rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-700">
                        Vezi detalii
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      <MainFooter />
    </div>
  );
}
