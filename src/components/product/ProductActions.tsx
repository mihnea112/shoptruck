"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/hooks/useCart";

interface ProductActionsProps {
  productId: string;
  productName: string;
  productSlug: string;
  inStock: boolean;
}

export function ProductActions({
  productId,
  productName,
  productSlug,
  inStock,
}: ProductActionsProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        setIsAuthenticated(res.ok);
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setAddingToCart(true);
    setCartMessage(null);

    try {
      await addItem(productId, quantity);
      setCartMessage({ type: "success", text: `${productName} adăugat în coș!` });
      setQuantity(1);
      setTimeout(() => setCartMessage(null), 3000);
    } catch (error: any) {
      setCartMessage({
        type: "error",
        text: error?.message || "Eroare la adăugare în coș.",
      });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleAddToFavorites = async () => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setFavoriteMessage(null);

    try {
      const response = await fetch("/api/public/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setFavoriteMessage({
            type: "error",
            text: "Te rugăm să te autentifici pentru a adăuga la dorințe.",
          });
          router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        } else {
          setFavoriteMessage({
            type: "error",
            text: data.error || "Eroare la adăugare la dorințe.",
          });
        }
        return;
      }

      if (data.ok) {
        setIsFavorite(true);
        setFavoriteMessage({
          type: "success",
          text: data.message || "Adăugat la lista de dorințe!",
        });
        setTimeout(() => setFavoriteMessage(null), 3000);
      } else {
        setFavoriteMessage({
          type: "error",
          text: data.error || "Eroare la adăugare la dorințe.",
        });
      }
    } catch (error: any) {
      console.error("[ProductActions] Wishlist error:", error);
      setFavoriteMessage({
        type: "error",
        text: error?.message || "Eroare la adăugare la dorințe.",
      });
    }
  };

  const handleWhatsApp = () => {
    const message = `Mă interesează produsul: ${productName} (${productSlug})`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="space-y-3">
      {/* Messages */}
      {cartMessage && (
        <div
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            cartMessage.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {cartMessage.text}
        </div>
      )}
      {favoriteMessage && (
        <div
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            favoriteMessage.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {favoriteMessage.text}
        </div>
      )}

      {/* Quantity selector */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-2">
        <button
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          className="px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          −
        </button>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          className="flex-1 text-center text-sm font-medium text-slate-900 outline-none"
        />
        <button
          onClick={() => setQuantity(quantity + 1)}
          className="px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          +
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleAddToCart}
          disabled={!inStock || addingToCart || !isAuthenticated}
          className="flex-1 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:bg-slate-400"
          title={!isAuthenticated ? "Autentifică-te pentru a adăuga în coș" : ""}
        >
          {addingToCart ? "Se adaugă..." : "Adaugă în coș"}
        </button>
        <button
          onClick={handleWhatsApp}
          className="flex-1 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-[#feab1f] hover:text-[#feab1f] transition"
        >
          WhatsApp
        </button>
        <button
          onClick={handleAddToFavorites}
          disabled={isFavorite || !isAuthenticated}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-600 transition disabled:border-red-200 disabled:bg-red-50 disabled:text-red-600 disabled:cursor-not-allowed"
          title={!isAuthenticated ? "Autentifică-te pentru a adăuga la dorințe" : ""}
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </div>
    </div>
  );
}
