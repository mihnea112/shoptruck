// src/components/admin/ProductDiscountManager.tsx
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

type DiscountData = {
  id: string;
  name: string;
  sell_gross: number;
  discount_price: number | null;
  discount_active: boolean;
  discount_percentage: number;
};

type ProductDiscountManagerProps = {
  productId: string;
  onSuccess?: () => void;
};

export function ProductDiscountManager({
  productId,
  onSuccess,
}: ProductDiscountManagerProps) {
  const [discount, setDiscount] = useState<DiscountData | null>(null);
  const [productInfo, setProductInfo] = useState<{name: string; sell_gross: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true); // Start in editing mode for new discounts
  const [newPrice, setNewPrice] = useState("");

  async function loadDiscount() {
    setLoading(true);
    setError(null);
    try {
      // First, load the product's current price from the public API to get fresh data
      const publicData = await fetch(`/api/public/products?limit=100&offset=0`).then(r => r.json());
      const product = publicData.items?.find((p: any) => p.id === productId);

      if (product) {
        setProductInfo({
          name: product.name,
          sell_gross: product.price_gross
        });
      }

      // Then try to load any existing discount
      const data = await apiFetch<any>(
        `/api/admin/products/${productId}/discount`
      );
      if (data.product) {
        setDiscount(data.product);
      }
    } catch (e: any) {
      // If product not found, that's ok - we're adding a new discount
      setDiscount(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveDiscount() {
    if (!newPrice || Number(newPrice) <= 0) {
      setError("Price must be greater than 0");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ product: DiscountData }>(
        `/api/admin/products/${productId}/discount`,
        {
          method: "PUT",
          body: JSON.stringify({
            discount_price: Number(newPrice),
            discount_active: true,
          }),
        }
      );
      setDiscount(data.product);
      setIsEditing(false);
      setNewPrice("");
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message || "Failed to save discount");
    } finally {
      setLoading(false);
    }
  }

  async function removeDiscount() {
    if (!window.confirm("Remove discount from this product?")) return;

    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/products/${productId}/discount`, {
        method: "DELETE",
      });
      setDiscount(null);
      setIsEditing(false);
      setNewPrice("");
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message || "Failed to remove discount");
    } finally {
      setLoading(false);
    }
  }

  if (!discount && !isEditing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <button
          onClick={() => {
            loadDiscount();
            setIsEditing(true);
          }}
          disabled={loading}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Add Discount"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="mb-4 font-semibold text-slate-900">Discount Manager</h3>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isEditing && discount && (
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs text-slate-500">Original Price</p>
            <p className="text-lg font-semibold text-slate-900">
              {new Intl.NumberFormat("ro-RO", {
                style: "currency",
                currency: "RON",
                maximumFractionDigits: 0,
              }).format(discount.sell_gross)}
            </p>
          </div>

          <div className="rounded-lg bg-white p-3">
            <p className="text-xs text-slate-500">Discounted Price</p>
            <p className="text-lg font-semibold text-green-600">
              {new Intl.NumberFormat("ro-RO", {
                style: "currency",
                currency: "RON",
                maximumFractionDigits: 0,
              }).format(discount.discount_price || 0)}
            </p>
          </div>

          <div className="rounded-lg bg-white p-3">
            <p className="text-xs text-slate-500">Discount Percentage</p>
            <p className="text-lg font-semibold text-red-600">
              -{discount.discount_percentage}%
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setNewPrice(String(discount.discount_price || ""));
                setIsEditing(true);
              }}
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              onClick={removeDiscount}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Original Price: RON{" "}
              {new Intl.NumberFormat("ro-RO", {
                maximumFractionDigits: 0,
              }).format(productInfo?.sell_gross || discount?.sell_gross || 0)}
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New Discounted Price (RON)
            </label>
            <input
              type="number"
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
          </div>

          {newPrice && (productInfo || discount) && (
            <div className="rounded-lg bg-white p-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Discount:</span>
                <span className="font-semibold text-red-600">
                  -{Math.round((1 - Number(newPrice) / (productInfo?.sell_gross || discount?.sell_gross || 0)) * 100)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">You save:</span>
                <span className="font-semibold text-green-600">
                  RON {Math.round((productInfo?.sell_gross || discount?.sell_gross || 0) - Number(newPrice))}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={saveDiscount}
              disabled={loading || !newPrice}
              className="flex-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Discount"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setNewPrice("");
              }}
              disabled={loading}
              className="flex-1 rounded-lg bg-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
