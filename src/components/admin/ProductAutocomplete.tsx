"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ProductDTO = {
  id: string;
  name: string;
  sku?: string | null;
  slug?: string | null;
  brand_name?: string | null;

  // IMPORTANT: this is NET (no VAT) – used by offers math
  price: number;

  // Optional (for display)
  price_gross?: number | null;

  // 19 / 9 / 0
  vat_percent: number;
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

  const rootRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setError(null);

    if (!canSearch) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/products/search?q=${encodeURIComponent(q.trim())}&limit=20`,
          { headers: { accept: "application/json" }, signal: ac.signal }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Eroare la căutare.");

        const list = (data.items || []) as any[];
        const mapped: ProductDTO[] = list.map((x) => ({
          id: String(x.id),
          name: String(x.name),
          sku: x.sku ?? null,
          slug: x.slug ?? null,
          brand_name: x.brand_name ?? null,
          price: Number(x.price ?? 0),
          price_gross: x.price_gross == null ? null : Number(x.price_gross),
          vat_percent: Number(x.vat_percent ?? 0),
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
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [q, canSearch]);

  function pick(p: ProductDTO) {
    onSelect(p);
    // Set input to selected product name (optional)
    setQ(p.name);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={
            "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 " +
            "placeholder:text-slate-500 outline-none focus:border-[#feab1f] transition-colors"
          }
        />

        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {!canSearch ? (
            <div className="px-3 py-2 text-xs text-slate-500">Tastează minim 2 caractere.</div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border-t border-red-100">{error}</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">Nu am găsit produse.</div>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {p.brand_name ? `${p.brand_name} · ` : ""}
                          {p.sku ? `SKU: ${p.sku}` : p.slug ? p.slug : ""}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatMoney(p.price)} lei
                        </div>
                        <div className="text-[11px] text-slate-500">
                          TVA {Math.round(Number(p.vat_percent) || 0)}%
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}