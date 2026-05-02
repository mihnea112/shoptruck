"use client";

import { useState, useEffect } from "react";

export interface WishlistItem {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  primary_code: string | null;
  price_gross: number;
  primary_image_path: string | null;
  added_at: string;
}

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load wishlist on mount
  useEffect(() => {
    if (!isInitialized) {
      loadWishlist();
    }
  }, [isInitialized]);

  const loadWishlist = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/wishlist");
      const data = await res.json();

      if (data.ok) {
        setItems(data.items || []);
      } else if (res.status === 401) {
        // Not authenticated, wishlist will be empty
        setItems([]);
      } else {
        setError(data.error || "Nu am putut încărca dorințele.");
      }
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcarea dorințelor.");
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  };

  const addFavorite = async (productId: string) => {
    try {
      const res = await fetch("/api/public/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
      });

      const data = await res.json();

      if (!data.ok) {
        if (res.status === 401) {
          setError("Trebuie să te autentifici pentru a salva favoruri.");
        } else {
          setError(data.error || "Nu am putut adăuga la dorințe.");
        }
        return false;
      }

      // Reload wishlist to get fresh data
      await loadWishlist();
      return true;
    } catch (e: any) {
      setError(e?.message || "Eroare la adăugare.");
      return false;
    }
  };

  const removeFavorite = async (productId: string) => {
    try {
      const res = await fetch(`/api/public/wishlist?product_id=${productId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Nu am putut elimina din dorințe.");
        return false;
      }

      // Reload wishlist to get fresh data
      await loadWishlist();
      return true;
    } catch (e: any) {
      setError(e?.message || "Eroare la eliminare.");
      return false;
    }
  };

  const isFavorited = (productId: string): boolean => {
    return items.some((item) => item.product_id === productId);
  };

  const toggleFavorite = async (productId: string) => {
    if (isFavorited(productId)) {
      return await removeFavorite(productId);
    } else {
      return await addFavorite(productId);
    }
  };

  return {
    items,
    addFavorite,
    removeFavorite,
    isFavorited,
    toggleFavorite,
    isLoading,
    error,
    reload: loadWishlist,
  };
}
