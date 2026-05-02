"use client";

import { useEffect, useState } from "react";

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  brand_name: string | null;
  primary_code: string | null;
  price_gross: number;
  primary_image_path: string | null;
  quantity: number;
  added_at: string;
}

interface CartTotal {
  net: number;
  tax: number;
  gross: number;
}

interface UseCartReturn {
  items: CartItem[];
  total: CartTotal;
  isLoading: boolean;
  error: string | null;
  addItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  reload: () => Promise<void>;
}

const CART_STORAGE_KEY = "shoptruck_cart";

export function useCart(): UseCartReturn {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateTotal = (cartItems: CartItem[]): CartTotal => {
    const gross = cartItems.reduce(
      (sum, item) => sum + item.price_gross * item.quantity,
      0
    );

    const net = cartItems.reduce((sum, item) => {
      const netPrice = item.price_gross / 1.19;
      return sum + netPrice * item.quantity;
    }, 0);

    const tax = gross - net;

    return { net: Math.round(net * 100) / 100, tax: Math.round(tax * 100) / 100, gross: Math.round(gross * 100) / 100 };
  };

  const total = calculateTotal(items);

  const reload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/public/cart", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        setItems([]);
        setError(data.error || "Nu s-a putut încărca coșul.");
        return;
      }

      const data = await response.json();
      if (data.ok && data.items) {
        setItems(data.items);
      }
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Eroare la încărcarea coșului.");
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = async (productId: string, quantity: number) => {
    setError(null);

    try {
      const response = await fetch("/api/public/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Nu s-a putut adăuga produsul.");
        return;
      }

      const data = await response.json();
      if (data.ok) {
        await reload();
      }
    } catch (e: any) {
      setError(e?.message || "Eroare la adăugare.");
    }
  };

  const removeItem = async (productId: string) => {
    setError(null);

    try {
      const response = await fetch(
        `/api/public/cart?product_id=${encodeURIComponent(productId)}`,
        { method: "DELETE", headers: { "Content-Type": "application/json" } }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Nu s-a putut elimina produsul.");
        return;
      }

      const data = await response.json();
      if (data.ok) {
        await reload();
      }
    } catch (e: any) {
      setError(e?.message || "Eroare la eliminare.");
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    setError(null);

    if (quantity <= 0) {
      await removeItem(productId);
      return;
    }

    try {
      const response = await fetch(
        `/api/public/cart?product_id=${encodeURIComponent(productId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Nu s-a putut actualiza cantitatea.");
        return;
      }

      const data = await response.json();
      if (data.ok) {
        await reload();
      }
    } catch (e: any) {
      setError(e?.message || "Eroare la actualizare.");
    }
  };

  const clearCart = async () => {
    setError(null);

    try {
      for (const item of items) {
        await removeItem(item.product_id);
      }
    } catch (e: any) {
      setError(e?.message || "Eroare la golire.");
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return {
    items,
    total,
    isLoading,
    error,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    reload,
  };
}
