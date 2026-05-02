"use client";

import { useCart } from "@/hooks/useCart";
import { useState } from "react";

interface AddToCartButtonProps {
  productId: string;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  quantity?: number;
}

export function AddToCartButton({
  productId,
  className = "",
  showLabel = true,
  size = "md",
  quantity = 1,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    try {
      await addItem(productId, quantity);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={isLoading}
      className={`
        inline-flex items-center gap-2 rounded-full
        ${success ? "bg-emerald-600 text-white" : "bg-amber-600 text-white hover:bg-amber-700"}
        disabled:opacity-50 disabled:cursor-not-allowed
        transition font-semibold
        ${sizeClasses[size]}
        ${className}
      `}
      title={showLabel ? undefined : "Adaugă în coș"}
    >
      <span className="text-lg">
        {isLoading ? "⏳" : success ? "✓" : "🛒"}
      </span>
      {showLabel && (
        <span>{isLoading ? "Se adaugă..." : success ? "Adăugat!" : "Adaugă în coș"}</span>
      )}
    </button>
  );
}
