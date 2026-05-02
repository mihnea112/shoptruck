"use client";

import { useState } from "react";
import Link from "next/link";

type SuggestedProduct = {
  id: string;
  slug: string;
  name: string;
  brand_name: string | null;
  price_gross: number;
  image_url: string | null;
};

interface SuggestedProductsCarouselProps {
  products: SuggestedProduct[];
}

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

export function SuggestedProductsCarousel({
  products,
}: SuggestedProductsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerView = 4;
  const totalSlides = Math.ceil(products.length / itemsPerView);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
  };

  const startIndex = currentIndex * itemsPerView;
  const visibleProducts = products.slice(startIndex, startIndex + itemsPerView);

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="mt-10 space-y-6">
      <h2 className="text-2xl font-semibold text-slate-900">
        Te ar putea interesa si...
      </h2>

      <div>
        {/* Carousel with Arrows on Sides */}
        <div className="flex items-center gap-4 mb-4">
          {/* Left Arrow */}
          {totalSlides > 1 && (
            <button
              onClick={goToPrevious}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 bg-white hover:bg-slate-50 transition-colors duration-300 flex-shrink-0"
              aria-label="Previous products"
            >
              <svg
                className="w-5 h-5 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Carousel Container */}
          <div className="flex-1 overflow-hidden">
            <div className="grid gap-6 grid-cols-2 sm:grid-cols-4 transition-all duration-500 ease-out">
              {visibleProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/produs/${product.slug}`}
                  className="group rounded-lg border border-slate-200 overflow-hidden bg-white hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="aspect-video bg-slate-100 overflow-hidden">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        Fără imagine
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="mb-2 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-slate-700">
                      {product.name}
                    </h3>
                    {product.brand_name && (
                      <p className="text-xs text-slate-500 mb-2">
                        {product.brand_name}
                      </p>
                    )}
                    <div className="text-sm font-semibold text-slate-900">
                      {formatRON(product.price_gross)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right Arrow */}
          {totalSlides > 1 && (
            <button
              onClick={goToNext}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 bg-white hover:bg-slate-50 transition-colors duration-300 flex-shrink-0"
              aria-label="Next products"
            >
              <svg
                className="w-5 h-5 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Indicators Below */}
        {totalSlides > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  idx === currentIndex ? "bg-slate-900" : "bg-slate-300"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
