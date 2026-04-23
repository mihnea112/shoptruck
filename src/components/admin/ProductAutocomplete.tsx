"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ProductDTO = {
  id: string;
  name: string;
  sku?: string | null;
  slug?: string | null;
  brand_name?: string | null;
  primary_code?: string | null;
  primary_image_path?: string | null;
  price: number;
  price_gross?: number | null;
  vat_percent: number;
  stock_available?: number | null;
  stock_on_hand?: number | null;
  uom?: string | null;
};

type Props = {
  onSelect: (p: ProductDTO) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // If it's already a full URL (e.g. migrated from old site), return as-is
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

// ─── Product preview modal (portal) ──────────────────────────
function ProductModal({
  product,
  anchorRect,
  onSelect,
  onClose,
}: {
  product: ProductDTO;
  anchorRect: DOMRect;
  onSelect: (p: ProductDTO) => void;
  onClose: () => void;
}) {
  const imgUrl = getImageUrl(product.primary_image_path);
  const stockAvail = Number(product.stock_available ?? 0);
  const inStock = stockAvail > 0;

  // Position to the right of the search dropdown, or below if no room
  const MODAL_W = 320;
  const MODAL_H = 340;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.right + 8;
  let top = anchorRect.top;

  // Not enough room on right → show below the anchor
  if (left + MODAL_W > vw - 8) {
    left = Math.max(8, anchorRect.left);
    top = anchorRect.bottom + 8;
  }

  // Clamp vertical
  if (top + MODAL_H > vh - 8) top = Math.max(8, vh - MODAL_H - 8);

  return createPortal(
    <>
      {/* Invisible backdrop to close on click-outside */}
      <div className="fixed inset-0 z-[998]" onClick={onClose} />
      <div
        className="fixed z-[999] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{ left, top, width: MODAL_W }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="relative h-40 w-full flex-shrink-0 bg-slate-100">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={product.name}
              className="h-full w-full object-contain p-2"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">
              🔩
            </div>
          )}

          {/* Stock badge overlaid */}
          <span
            className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              inStock
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {inStock
              ? `✓ Stoc: ${stockAvail} ${product.uom ?? "buc"}`
              : "Lipsă stoc"}
          </span>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2 p-4">
          <div className="text-sm font-bold leading-tight text-slate-900">
            {product.name}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
            {product.brand_name && (
              <span className="font-semibold text-slate-700">
                {product.brand_name}
              </span>
            )}
            {product.sku && (
              <span>
                SKU: <span className="font-mono">{product.sku}</span>
              </span>
            )}
            {product.primary_code && (
              <span>
                Cod: <span className="font-mono">{product.primary_code}</span>
              </span>
            )}
          </div>

          <div className="mt-1 flex items-end justify-between">
            <div>
              <div className="text-lg font-bold text-slate-900">
                {formatMoney(product.price)}{" "}
                <span className="text-xs font-normal text-slate-400">
                  lei net
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                TVA {Math.round(Number(product.vat_percent) || 0)}%
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelect(product);
                onClose();
              }}
              className="rounded-full bg-[#feab1f] px-4 py-2 text-sm font-bold text-white hover:bg-[#e09800] transition"
            >
              Selectează
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── Main component ───────────────────────────────────────────
export default function ProductAutocomplete({
  onSelect,
  placeholder = "Caută după cod / echivalență / nume / SKU…",
  disabled,
  className,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ProductDTO | null>(null);
  const [hoveredItemRect, setHoveredItemRect] = useState<DOMRect | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHovered(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Search
  useEffect(() => {
    setError(null);

    if (!canSearch) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/products/search?q=${encodeURIComponent(q.trim())}&limit=20`,
          { headers: { accept: "application/json" }, signal: ac.signal },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok)
          throw new Error(data?.error || "Eroare la căutare.");

        const mapped: ProductDTO[] = (data.items || []).map((x: any) => ({
          id: String(x.id),
          name: String(x.name),
          sku: x.sku ?? null,
          slug: x.slug ?? null,
          brand_name: x.brand_name ?? null,
          primary_code: x.primary_code ?? null,
          primary_image_path: x.image_url ?? x.primary_image_path ?? null,
          price: Number(x.price ?? 0),
          price_gross: x.price_gross == null ? null : Number(x.price_gross),
          vat_percent: Number(x.vat_percent ?? 0),
          stock_available:
            x.stock_available != null ? Number(x.stock_available) : null,
          stock_on_hand:
            x.stock_on_hand != null ? Number(x.stock_on_hand) : null,
          uom: x.uom ?? null,
        }));

        setItems(mapped);
        setOpen(true);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Eroare la căutare.");
        setItems([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, canSearch]);

  function pick(p: ProductDTO) {
    onSelect(p);
    setQ(p.name);
    setOpen(false);
    setHovered(null);
  }

  function handleItemHover(p: ProductDTO, el: HTMLElement) {
    setHovered(p);
    // Get the dropdown position to anchor the modal
    const dropRect = dropdownRef.current?.getBoundingClientRect();
    if (dropRect) setHoveredItemRect(dropRect);
  }

  return (
    <div ref={rootRef} className={`relative ${className || ""}`}>
      {/* Input */}
      <div className="relative">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
            setHovered(null);
          }}
          onFocus={() => {
            if (items.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={
            "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 " +
            "placeholder:text-slate-500 outline-none focus:border-[#feab1f] transition-colors"
          }
        />
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {!canSearch ? (
            <div className="px-4 py-3 text-xs text-slate-400">
              Tastează minim 2 caractere…
            </div>
          ) : error ? (
            <div className="bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          ) : items.length === 0 && !loading ? (
            <div className="px-4 py-3 text-xs text-slate-400">
              Nu am găsit produse pentru &ldquo;{q}&rdquo;.
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
              {items.map((p) => {
                const inStock = (p.stock_available ?? 0) > 0;
                const isHovered = hovered?.id === p.id;

                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      onMouseEnter={(e) => handleItemHover(p, e.currentTarget)}
                      onMouseLeave={() => {
                        // small delay so user can move mouse into modal
                        setTimeout(
                          () => setHovered((h) => (h?.id === p.id ? null : h)),
                          80,
                        );
                      }}
                      className={`w-full px-3 py-2 text-left transition ${
                        isHovered ? "bg-amber-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          {getImageUrl(p.primary_image_path) ? (
                            <img
                              src={getImageUrl(p.primary_image_path)!}
                              alt={p.name}
                              className="h-full w-full object-contain p-0.5"
                              onError={(e) => {
                                (
                                  e.currentTarget as HTMLImageElement
                                ).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg text-slate-300">
                              🔩
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {p.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            {p.brand_name && (
                              <span className="font-medium text-slate-600">
                                {p.brand_name}
                              </span>
                            )}
                            {p.sku && (
                              <span className="font-mono">{p.sku}</span>
                            )}
                          </div>
                        </div>

                        {/* Price + stock */}
                        <div className="flex-shrink-0 text-right">
                          <div className="text-sm font-bold text-slate-900">
                            {formatMoney(p.price)}{" "}
                            <span className="text-[10px] font-normal text-slate-400">
                              lei
                            </span>
                          </div>
                          <div
                            className={`mt-0.5 text-[10px] font-semibold ${
                              inStock ? "text-emerald-600" : "text-red-500"
                            }`}
                          >
                            {inStock
                              ? `✓ ${p.stock_available} ${p.uom ?? "buc"}`
                              : "Lipsă"}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Popup modal on hover */}
      {hovered && hoveredItemRect && (
        <ProductModal
          product={hovered}
          anchorRect={hoveredItemRect}
          onSelect={pick}
          onClose={() => setHovered(null)}
        />
      )}
    </div>
  );
}
