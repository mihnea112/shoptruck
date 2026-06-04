"use client";

import { useState } from "react";

interface Product {
  id: string;
  slug: string;
  name: string;
  price_gross: number;
  discount_price: number | null;
  discount_active: boolean;
  discount_percentage: number;
  primary_image_url: string | null;
  brand_name: string | null;
}

interface ProductGeneratorProps {
  onGenerate: (html: string, text: string) => void;
  onGeneratingChange: (generating: boolean) => void;
}

export default function ProductGenerator({ onGenerate, onGeneratingChange }: ProductGeneratorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("");
  const [tone, setTone] = useState("professional");
  const [keyPoints, setKeyPoints] = useState("");
  const [onlyDiscounted, setOnlyDiscounted] = useState(true); // Show only discounted products by default
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setAvailableProducts([]);
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("limit", "20");
      if (onlyDiscounted) {
        params.set("discount_active", "true"); // Only discounted products
      }

      const res = await fetch(`/api/public/products?${params}`);
      const data = await res.json();
      if (data.ok) {
        setAvailableProducts(data.items || []);
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la căutare." });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Eroare la căutare." });
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      searchProducts(query);
    } else {
      setAvailableProducts([]);
    }
  };

  const handleOnlyDiscountedChange = (checked: boolean) => {
    setOnlyDiscounted(checked);
    if (searchQuery.trim().length >= 2) {
      searchProducts(searchQuery);
    }
  };

  const addProduct = (product: Product) => {
    if (!selectedProducts.find((p) => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product]);
    }
    setSearchQuery("");
    setAvailableProducts([]);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.id !== productId));
  };

  const generateEmail = async () => {
    if (!subject.trim()) {
      setMessage({ type: "error", text: "Subiectul este necesar." });
      return;
    }

    if (selectedProducts.length === 0) {
      setMessage({ type: "error", text: "Selectați cel puțin un produs." });
      return;
    }

    if (!keyPoints.trim()) {
      setMessage({ type: "error", text: "Punctele cheie sunt necesare." });
      return;
    }

    setGenerating(true);
    onGeneratingChange(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/email/compose-ai-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          tone,
          keyPoints,
          products: selectedProducts,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        onGenerate(data.body_html, data.body_text);
        setMessage({ type: "success", text: "Email generat cu succes!" });
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la generare." });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Eroare la generare." });
    } finally {
      setGenerating(false);
      onGeneratingChange(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Generează Email cu Produse</h3>

        {message && (
          <div
            className={`rounded-lg p-3 mb-4 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Subiect email
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Ofertă specială - Piese auto cu reducere"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Tonul email-ului
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
            >
              <option value="professional">Profesional</option>
              <option value="friendly">Prietenos</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Key Points */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Puncte cheie
            </label>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              placeholder="Ex: Reduceri până la 50%, Livrare gratuită, Garanție 2 ani"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Filter: Only Discounted Products */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="onlyDiscounted"
              checked={onlyDiscounted}
              onChange={(e) => handleOnlyDiscountedChange(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="onlyDiscounted" className="text-sm font-medium text-slate-900 cursor-pointer">
              Afișează doar produsele cu reduceri
            </label>
          </div>

          {/* Product Search */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Cauta produse
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Cauta după nume, marcă, SKU..."
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none"
              />
              {searching && <div className="absolute right-3 top-2.5 text-sm text-slate-500">Se cauta...</div>}
            </div>

            {/* Search Results */}
            {availableProducts.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white">
                {availableProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-200 last:border-b-0 transition"
                  >
                    {product.primary_image_url && (
                      <img
                        src={product.primary_image_url}
                        alt={product.name}
                        className="h-8 w-8 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {product.name}
                        </div>
                        {product.discount_active && product.discount_price && (
                          <span className="text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                            -{product.discount_percentage}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {product.brand_name} •
                        {product.discount_active && product.discount_price ? (
                          <>
                            <span className="line-through">{product.price_gross.toFixed(0)} RON</span>
                            <span className="text-green-600 font-medium"> {product.discount_price.toFixed(0)} RON</span>
                          </>
                        ) : (
                          <span> {product.price_gross.toFixed(0)} RON</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Products */}
          {selectedProducts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Produse selectate ({selectedProducts.length})
              </label>
              <div className="space-y-2">
                {selectedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {product.primary_image_url && (
                        <img
                          src={product.primary_image_url}
                          alt={product.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {product.name}
                          </div>
                          {product.discount_active && product.discount_price && (
                            <span className="text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                              -{product.discount_percentage}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600">
                          {product.discount_active && product.discount_price ? (
                            <>
                              <span className="line-through">{product.price_gross.toFixed(0)} RON</span>
                              <span className="text-green-600 font-medium ml-1">{product.discount_price.toFixed(0)} RON</span>
                            </>
                          ) : (
                            <span>{product.price_gross.toFixed(0)} RON</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeProduct(product.id)}
                      type="button"
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                    >
                      Elimină
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateEmail}
            disabled={generating || selectedProducts.length === 0 || !subject.trim() || !keyPoints.trim()}
            type="button"
            className="w-full rounded-lg bg-[#feab1f] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-[#e09a1f] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {generating ? "Se generează..." : "Generează Email"}
          </button>
        </div>
      </div>
    </div>
  );
}
