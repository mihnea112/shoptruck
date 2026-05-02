"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────
type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand_name: string | null;
  category_name: string | null;
  brand_id: string | null;
  category_id: string | null;
  primary_code: string | null;
  price_gross: number;
  stock_available: number;
  primary_image_url: string | null;
};

type FilterOption = { id: string; name: string; count?: number };

// ─── Helpers ──────────────────────────────────────────────────
function fmtRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function StockBadge({ qty }: { qty: number }) {
  if (qty <= 0)
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
        Indisponibil
      </span>
    );
  if (qty <= 5)
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        {qty} buc
      </span>
    );
  if (qty < 10)
    return (
      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-600">
        Stoc limitat
      </span>
    );
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
      Stoc suficient
    </span>
  );
}

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error || "Eroare");
  return d as T;
}

// ─── Product card ─────────────────────────────────────────────
function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      href={`/produs/${p.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-amber-400 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {p.primary_image_url ? (
          <img
            src={p.primary_image_url}
            alt={p.name}
            className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-16 w-16 text-slate-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
              />
            </svg>
          </div>
        )}
        {/* Stock badge */}
        <div className="absolute left-3 top-3">
          <StockBadge qty={p.stock_available} />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        {p.brand_name && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            {p.brand_name}
          </div>
        )}
        <h3 className="flex-1 text-sm font-semibold leading-snug text-slate-900 line-clamp-2 group-hover:text-amber-700 transition">
          {p.name}
        </h3>
        {p.sku && (
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            {p.sku}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-lg font-bold text-slate-900">
            {fmtRON(p.price_gross)}
          </div>
          <div
            className="rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-900
            opacity-0 transition group-hover:opacity-100"
          >
            Vezi →
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton card ────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="aspect-square animate-pulse bg-slate-100" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

// ─── Main catalog client ──────────────────────────────────────
export default function CatalogClient() {
  // Read initial filter from URL (e.g. coming from homepage category click)
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [brands, setBrands] = useState<FilterOption[]>([]);

  // Filters
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("categoryId") || ""
      : "",
  );
  const [brandId, setBrandId] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const LIMIT = 24;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load filter options on mount
  useEffect(() => {
    fetch("/api/public/categories")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setCategories(d.items || []);
      })
      .catch(() => {});
    fetch("/api/public/brands")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setBrands(d.items || []);
      })
      .catch(() => {});
  }, []);

  const loadProducts = useCallback(
    async (
      _q = q,
      _cat = categoryId,
      _brand = brandId,
      _sort = sort,
      _page = page,
    ) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("limit", String(LIMIT));
        sp.set("offset", String(_page * LIMIT));
        sp.set("sort", _sort);
        if (_q) sp.set("q", _q);
        if (_cat) sp.set("categoryId", _cat);
        if (_brand) sp.set("brandId", _brand);

        const data = await apiFetch<any>(`/api/public/products?${sp}`);
        setProducts(data.items || []);
        setTotal(data.total || 0);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [q, categoryId, brandId, sort, page],
  );

  useEffect(() => {
    loadProducts();
  }, [categoryId, brandId, sort, page]);

  function handleSearch(val: string) {
    setQ(val);
    setPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => loadProducts(val, categoryId, brandId, sort, 0),
      350,
    );
  }

  function handleCategory(id: string) {
    setCategoryId(id);
    setPage(0);
    loadProducts(q, id, brandId, sort, 0);
  }

  function handleBrand(id: string) {
    setBrandId(id);
    setPage(0);
    loadProducts(q, categoryId, id, sort, 0);
  }

  function handleSort(s: string) {
    setSort(s);
    setPage(0);
    loadProducts(q, categoryId, brandId, s, 0);
  }

  function clearAll() {
    setQ("");
    setCategoryId("");
    setBrandId("");
    setSort("newest");
    setPage(0);
    loadProducts("", "", "", "newest", 0);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = q || categoryId || brandId || sort !== "newest";

  return (
    <>
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          {/* Search bar — full width, top */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"
                />
              </svg>
            </div>
            <input
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cauta dupa nume, SKU, cod piesa, marca..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 transition"
            />
            {q && (
              <button
                onClick={() => handleSearch("")}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Bottom row: title + count + sort */}
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-base font-bold text-slate-900 whitespace-nowrap">
                Catalog Piese
              </h1>
              {!loading && (
                <span className="text-sm text-slate-400 truncate">
                  {total} produse
                </span>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => handleSort(e.target.value)}
              className="flex-shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            >
              <option value="newest">Cele mai noi</option>
              <option value="price_asc">Pret crescator</option>
              <option value="price_desc">Pret descrescator</option>
              <option value="name">Alfabetic</option>
            </select>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-8">
          {/* ── Sidebar filters ─────────────────────────────── */}
          <aside className="hidden w-56 flex-shrink-0 lg:block">
            {/* Active filters */}
            {hasFilters && (
              <div className="mb-5">
                <button
                  onClick={clearAll}
                  className="flex items-center gap-2 text-xs font-semibold text-amber-600 hover:text-amber-700"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Sterge filtrele
                </button>
              </div>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Categorii
                </div>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => handleCategory("")}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition
                        ${!categoryId ? "bg-amber-50 font-semibold text-amber-700" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      Toate
                    </button>
                  </li>
                  {categories.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => handleCategory(c.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition
                          ${categoryId === c.id ? "bg-amber-50 font-semibold text-amber-700" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Brands */}
            {brands.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Marca
                </div>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => handleBrand("")}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition
                        ${!brandId ? "bg-amber-50 font-semibold text-amber-700" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      Toate marcile
                    </button>
                  </li>
                  {brands.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => handleBrand(b.id)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition
                          ${brandId === b.id ? "bg-amber-50 font-semibold text-amber-700" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        {b.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* ── Product grid ─────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters row */}
            <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
              <select
                value={categoryId}
                onChange={(e) => handleCategory(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
              >
                <option value="">Toate categoriile</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={brandId}
                onChange={(e) => handleBrand(e.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
              >
                <option value="">Toate marcile</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700"
                >
                  Sterge filtrele
                </button>
              )}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-24 text-center">
                <div className="text-4xl mb-4">🔩</div>
                <div className="text-base font-semibold text-slate-700">
                  Niciun produs gasit
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  Incearca alte cuvinte cheie sau sterge filtrele.
                </p>
                {hasFilters && (
                  <button
                    onClick={clearAll}
                    className="mt-4 rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition"
                  >
                    Sterge filtrele
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  ← Anterior
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  const start = Math.max(0, Math.min(page - 3, totalPages - 7));
                  const pg = start + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      className={`h-9 w-9 rounded-full text-sm font-semibold transition
                        ${
                          pg === page
                            ? "bg-amber-400 text-slate-900"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {pg + 1}
                    </button>
                  );
                })}

                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Urmator →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
