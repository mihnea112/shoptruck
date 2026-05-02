"use client";

import { CartItem as CartItemType } from "@/hooks/useCart";
import Link from "next/link";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (productId: string, quantity: number) => Promise<void>;
  onRemove: (productId: string) => Promise<void>;
}

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  const subtotal = item.price_gross * item.quantity;

  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50 transition">
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
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
            className="px-2 py-1 rounded hover:bg-slate-200 transition"
            title="Micșorează cantitate"
          >
            −
          </button>
          <span className="w-8 text-center font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
            className="px-2 py-1 rounded hover:bg-slate-200 transition"
            title="Mărește cantitate"
          >
            +
          </button>
        </div>
      </td>
      <td className="px-6 py-4 text-right font-semibold text-slate-900">
        {formatRON(subtotal)}
      </td>
      <td className="px-6 py-4 text-center">
        <button
          onClick={() => onRemove(item.product_id)}
          className="text-red-600 hover:text-red-700 font-semibold text-sm transition"
          title="Elimină din coș"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
