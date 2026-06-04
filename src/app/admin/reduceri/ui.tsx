"use client";

import { useEffect, useState, useCallback } from "react";
import { ProductDiscountManager } from "@/components/admin/ProductDiscountManager";

type Product = {
  id: string;
  name: string;
  sku: string;
  slug: string;
  price_gross: number;
  discount_price: number | null;
  discount_active: boolean;
  discount_percentage: number;
  category_name: string | null;
  brand_name: string | null;
  stock_available: number;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

export default function DiscountsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minDiscount, setMinDiscount] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [sortBy, setSortBy] = useState<"discount_desc" | "discount_asc" | "price_desc" | "name">("discount_desc");

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 25;

  // Modal
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removingBulk, setRemovingBulk] = useState(false);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch("/api/public/categories");
        const data = await res.json();
        if (data.ok && data.items) {
          setCategories(data.items);
        }
      } catch (e) {
        console.error("Failed to load categories:", e);
      }
    };
    loadCategories();
  }, []);

  // Dynamic search for products without discounts
  const searchProducts = useCallback(async (searchQuery: string) => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "25");
      params.set("offset", "0");
      params.set("discount_active", "false"); // Only products without discounts
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/public/products?${params}`);
      const data = await res.json();
      if (data.ok && data.items) {
        setAllProducts(data.items);
      } else {
        setAllProducts([]);
      }
    } catch (e) {
      console.error("Failed to search products:", e);
      setAllProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Load discounted products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get products WITH discounts from database
      const sp = new URLSearchParams();
      sp.set("limit", "1000");
      sp.set("offset", "0");
      sp.set("discount_active", "true"); // Only products WITH discounts

      const res = await fetch(`/api/public/products?${sp}`);
      const data = await res.json();

      if (!data.ok) throw new Error(data.error || "Failed to load products");

      // API already filters for discounted products, so no need to filter again
      let filtered = (data.items || []);

      // Apply filters
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (p: Product) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q)
        );
      }

      if (categoryFilter) {
        filtered = filtered.filter((p: Product) => p.category_name === categoryFilter);
      }

      if (minDiscount) {
        const min = Number(minDiscount);
        filtered = filtered.filter((p: Product) => p.discount_percentage >= min);
      }

      if (maxDiscount) {
        const max = Number(maxDiscount);
        filtered = filtered.filter((p: Product) => p.discount_percentage <= max);
      }

      // Apply sorting
      filtered.sort((a: Product, b: Product) => {
        switch (sortBy) {
          case "discount_desc":
            return b.discount_percentage - a.discount_percentage;
          case "discount_asc":
            return a.discount_percentage - b.discount_percentage;
          case "price_desc":
            return b.price_gross - a.price_gross;
          case "name":
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });

      setProducts(filtered);
      setPage(0);
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e?.message || "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, minDiscount, maxDiscount, sortBy]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleRemoveDiscount = async (productId: string) => {
    if (!window.confirm("Remove discount from this product?")) return;

    try {
      const res = await fetch(`/api/admin/products/${productId}/discount`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error || "Failed to remove discount");

      loadProducts();
    } catch (e: any) {
      alert(e?.message || "Failed to remove discount");
    }
  };

  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) {
      alert("Please select at least one product");
      return;
    }

    if (!window.confirm(`Remove discounts from ${selectedIds.size} products?`)) {
      return;
    }

    setRemovingBulk(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/admin/products/${id}/discount`, { method: "DELETE" })
            .then((r) => r.json())
            .catch(() => ({ ok: false }))
        )
      );

      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        alert(`Failed to remove ${failed} discounts`);
      }

      loadProducts();
    } catch (e: any) {
      alert(e?.message || "Failed to remove discounts");
    } finally {
      setRemovingBulk(false);
    }
  };

  const paginatedProducts = products.slice(
    page * limit,
    (page + 1) * limit
  );
  const totalPages = Math.ceil(products.length / limit);

  // Statistics
  const totalDiscounted = products.length;
  const avgDiscount =
    products.length > 0
      ? Math.round(
          products.reduce((sum, p) => sum + p.discount_percentage, 0) /
            products.length
        )
      : 0;
  const totalSavings = products.reduce(
    (sum, p) => sum + (p.price_gross - (p.discount_price || 0)),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestionare Reduceri</h1>
            <p className="mt-2 text-slate-600">
              Gestioneaza toate reducerile de preț ale magazinului
            </p>
          </div>
          <button
            onClick={() => {
              setProductSearch("");
              searchProducts("");
              setShowAddProductModal(true);
            }}
            className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 transition"
          >
            + Adauga Produs
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-600">Produse cu reduceri</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalDiscounted}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-600">
              Reducere medie
            </p>
            <p className="mt-2 text-3xl font-bold text-red-600">-{avgDiscount}%</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-600">Economie totala</p>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {totalSavings.toFixed(0)} RON
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Filtre</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cautare (Nume/SKU)
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cautati..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Categorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              >
                <option value="">Toate</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Discount */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reducere min (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={minDiscount}
                onChange={(e) => setMinDiscount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>

            {/* Max Discount */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reducere max (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                placeholder="100"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sortare
              </label>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "discount_desc"
                      | "discount_asc"
                      | "price_desc"
                      | "name"
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              >
                <option value="discount_desc">Reducere descrescatoare</option>
                <option value="discount_asc">Reducere crescatoare</option>
                <option value="price_desc">Pret descrescator</option>
                <option value="name">Alfabetic</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Products Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-600">
              Se incarca...
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              Nu exista produse cu reduceri
            </div>
          ) : (
            <>
              {/* Bulk Actions */}
              {selectedIds.size > 0 && (
                <div className="border-b border-slate-200 bg-amber-50 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {selectedIds.size} produse selectate
                    </span>
                    <button
                      onClick={handleBulkRemove}
                      disabled={removingBulk}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {removingBulk ? "Se sterge..." : "Sterge reducerile"}
                    </button>
                  </div>
                </div>
              )}

              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-slate-700 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(paginatedProducts.map((p) => p.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Produs</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">SKU</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Pret Original</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Pret Reducere</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Economie</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Reducere %</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Actiuni</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {paginatedProducts.map((product) => {
                    const isSelected = selectedIds.has(product.id);
                    const savings = product.price_gross - (product.discount_price || 0);

                    return (
                      <tr
                        key={product.id}
                        className={isSelected ? "bg-amber-50" : ""}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newIds = new Set(selectedIds);
                              if (e.target.checked) {
                                newIds.add(product.id);
                              } else {
                                newIds.delete(product.id);
                              }
                              setSelectedIds(newIds);
                            }}
                            className="rounded"
                          />
                        </td>

                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {product.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {product.category_name && (
                                <>
                                  {product.category_name}
                                  {product.brand_name && " · "}
                                </>
                              )}
                              {product.brand_name}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-700">{product.sku}</td>

                        <td className="px-6 py-4 text-slate-700">
                          {product.price_gross} RON
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-semibold text-green-600">
                            {product.discount_price} RON
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-medium text-emerald-600">
                            {savings.toFixed(0)} RON
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                            -{product.discount_percentage}%
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedProductId(product.id);
                                setShowDiscountModal(true);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Editeaza
                            </button>
                            <button
                              onClick={() => handleRemoveDiscount(product.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Sterge
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Pagina {page + 1} din {totalPages} · Total: {products.length} produse
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Inapoi
                    </button>

                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPage(i)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium ${
                            page === i
                              ? "bg-amber-500 text-white"
                              : "border border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page === totalPages - 1}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Inainte
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Discount Manager Modal */}
      {showDiscountModal && selectedProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {products.find((p) => p.id === selectedProductId)?.name ||
                  "Manager reducere"}
              </h2>
              <button
                onClick={() => {
                  setShowDiscountModal(false);
                  setSelectedProductId(null);
                }}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <ProductDiscountManager
              productId={selectedProductId}
              onSuccess={() => {
                setShowDiscountModal(false);
                setSelectedProductId(null);
                loadProducts();
              }}
            />
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-96 overflow-y-auto">
            <div className="mb-4 flex items-center justify-between sticky top-0 bg-white pb-4">
              <h2 className="text-xl font-bold text-slate-900">
                Adauga Produs cu Reducere
              </h2>
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  setProductSearch("");
                }}
                className="text-slate-500 hover:text-slate-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                searchProducts(e.target.value);
              }}
              placeholder="Cautati produs dupa nume sau SKU..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/20"
            />

            {/* Products List */}
            {loadingProducts ? (
              <div className="text-center py-8 text-slate-600">Se incarca...</div>
            ) : allProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                {productSearch ? "Nu s-au gasit produse" : "Nu exista produse disponibile pentru reducere"}
              </div>
            ) : (
              <div className="space-y-2">
                {allProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          SKU: {product.sku} · Pret: {product.price_gross} RON
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProductId(product.id);
                          setShowAddProductModal(false);
                          setProductSearch("");
                          setShowDiscountModal(true);
                        }}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
                      >
                        Adauga
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
