// src/components/common/DiscountBadge.tsx
"use client";

type DiscountBadgeProps = {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  className?: string;
};

export function DiscountBadge({
  originalPrice,
  discountedPrice,
  discountPercentage,
  className = "",
}: DiscountBadgeProps) {
  if (!originalPrice || !discountedPrice || discountPercentage === 0) {
    return null;
  }

  const savings = originalPrice - discountedPrice;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-3">
        {/* Original Price (struck through) */}
        <span className="text-sm text-slate-500 line-through">
          {new Intl.NumberFormat("ro-RO", {
            style: "currency",
            currency: "RON",
            maximumFractionDigits: 0,
          }).format(originalPrice)}
        </span>

        {/* Discount Percentage Badge */}
        <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          -{discountPercentage}%
        </span>
      </div>

      {/* Discounted Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-green-600">
          {new Intl.NumberFormat("ro-RO", {
            style: "currency",
            currency: "RON",
            maximumFractionDigits: 0,
          }).format(discountedPrice)}
        </span>
        <span className="text-xs text-slate-500">
          Economisezi{" "}
          {new Intl.NumberFormat("ro-RO", {
            style: "currency",
            currency: "RON",
            maximumFractionDigits: 0,
          }).format(savings)}
        </span>
      </div>
    </div>
  );
}
