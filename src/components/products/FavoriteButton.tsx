"use client";

import { useState, useEffect } from "react";
import { useWishlist } from "@/hooks/useWishlist";

interface FavoriteButtonProps {
  productId: string;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function FavoriteButton({
  productId,
  className = "",
  showLabel = false,
  size = "md",
}: FavoriteButtonProps) {
  const { isFavorited, toggleFavorite, isLoading, error } = useWishlist();
  const [isHovering, setIsHovering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isCurrentlyFavorited = isFavorited(productId);

  const sizeClasses = {
    sm: "p-1.5 text-sm",
    md: "p-2 text-base",
    lg: "p-3 text-lg",
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const success = await toggleFavorite(productId);
    if (success) {
      setMessage(
        isCurrentlyFavorited
          ? "Eliminat din dorințe."
          : "Adăugat la dorințe."
      );
      setTimeout(() => setMessage(null), 2000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isLoading}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`
          flex items-center justify-center gap-2 rounded-full transition-all
          ${sizeClasses[size]}
          ${isCurrentlyFavorited
            ? "bg-red-100 text-red-600 hover:bg-red-200"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }
          ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${className}
        `}
        title={isCurrentlyFavorited ? "Elimină din dorințe" : "Adaugă la dorințe"}
      >
        <svg
          className={`w-5 h-5 transition-transform ${
            isHovering && !isLoading ? "scale-110" : ""
          }`}
          fill={isCurrentlyFavorited ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>

        {showLabel && (
          <span className="text-xs font-medium">
            {isCurrentlyFavorited ? "Salvat" : "Salvează"}
          </span>
        )}
      </button>

      {/* Feedback message */}
      {message && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-slate-900 text-white px-3 py-1 rounded-full text-xs font-medium pointer-events-none">
          {message}
        </div>
      )}

      {error && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium pointer-events-none">
          {error}
        </div>
      )}
    </div>
  );
}
