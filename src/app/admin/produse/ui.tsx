"use client";

import { useEffect, useMemo, useState } from "react";

// --- TYPES ---

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
};

type TaxRate = {
  id: string;
  name: string;
  rate: string | number; // can be 0.19 or 19
};

type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;

  buy_price_net: number;
  profit_margin_pct: number;

  is_active: boolean;
  brand_id: string | null;
  category_id: string | null;
  tax_rate_id: string;
  uom: string;
  stock_on_hand?: number;
  stock_reserved?: number;

  brand_name?: string | null;
  category_name?: string | null;

  // Optional audit fields (from API)
  created_by_email?: string | null;
  created_by_name?: string | null;
};

type ProductDetails = Product & {
  description: string | null;
  stock_on_hand?: number;
  stock_reserved?: number;
  primary_code: string | null;
  equivalent_codes: string[];
  created_by_email?: string | null;
  created_by_name?: string | null;
};

type ProductImage = {
  id: string;
  product_id: string;
  storage_path: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

type ApiList<T> = { ok: true; items: T[]; limit?: number; offset?: number };
type ApiOne<T> = { ok: true; item: T };

// --- HELPERS ---

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ț/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Eroare.");
  return data as T;
}

function safeNum(v: any) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Accepts tax_rate.rate as either 0.19 or 19. Returns fraction 0.19. */
function normalizeTaxRate(rate: string | number) {
  const r = Number(rate);
  if (!Number.isFinite(r)) return null;
  return r <= 1 ? r : r / 100;
}

/** Round to 2 decimals (for NET preview / raw values). */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Round UP to whole lei (for FINAL GROSS). */
function ceilToLeu(n: number) {
  return Math.ceil(n); // 148.01 -> 149
}

function formatPct(rate: string | number) {
  const frac = normalizeTaxRate(rate);
  if (frac == null) return "—";
  const pct = frac * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

// Supabase public storage helper (public bucket)
const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
function publicProductImageUrl(storagePath: string) {
  if (!SUPABASE_PUBLIC_URL) return "";
  // bucket name is hardcoded by convention in your API: product-images
  return `${SUPABASE_PUBLIC_URL}/storage/v1/object/public/product-images/${storagePath}`;
}

function fileExt(name: string) {
  const m = String(name || "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] || "jpg";
  return ext.replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
}

// Styles
const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f]";
const selectBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f]";

// --- COMPONENT ---

export default function ProductsAdmin({ isAdmin }: { isAdmin: boolean }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const [items, setItems] = useState<Product[]>([]);

  // Images state (modal)
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // Bulk selection (admin only)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBrandId, setBulkBrandId] = useState<string>("");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkMarginPct, setBulkMarginPct] = useState<string>("");

  const visibleIds = useMemo(() => items.map((p) => p.id), [items]);
  const allVisibleSelected = useMemo(() => {
    if (!isAdmin) return false;
    if (visibleIds.length === 0) return false;
    const sel = new Set(selectedIds);
    return visibleIds.every((id) => sel.has(id));
  }, [isAdmin, visibleIds, selectedIds]);

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [brandFilterId, setBrandFilterId] = useState<string>("");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  // NEW: buy + margin
  const [buyPriceNet, setBuyPriceNet] = useState("");
  const [marginPct, setMarginPct] = useState("");

  const [taxRateId, setTaxRateId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [brandId, setBrandId] = useState("");
  const [categoryIdEdit, setCategoryIdEdit] = useState<string>("");

  const [primaryCode, setPrimaryCode] = useState("");

  const [uom, setUom] = useState("buc");
  // Stock (manual edit)
  const [stockOnHand, setStockOnHand] = useState("");
  const [stockReserved, setStockReserved] = useState(""); // read-only in UI

  // Equivalents (string[])
  const [equivCodes, setEquivCodes] = useState<string[]>([]);
  const [newEquivCode, setNewEquivCode] = useState("");

  const categoryOptions = useMemo(
    () => cats.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [cats],
  );
  const brandOptions = useMemo(
    () => brands.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [brands],
  );
  const taxOptions = useMemo(
    () => taxRates.slice().sort((a, b) => Number(b.rate) - Number(a.rate)),
    [taxRates],
  );

  const selectedTax = useMemo(() => {
    if (!taxRateId) return null;
    const t = taxRates.find((x) => x.id === taxRateId);
    if (!t) return null;
    const frac = normalizeTaxRate(t.rate);
    if (frac == null) return null;
    return { ...t, frac };
  }, [taxRateId, taxRates]);

  // Preview calculations:
  // - Net: round2
  // - Gross FINAL: ceilToLeu (whole lei)
  const preview = useMemo(() => {
    const buy = safeNum(buyPriceNet);
    const mar = safeNum(marginPct);
    const taxFrac = selectedTax?.frac ?? null;

    if (buy == null || mar == null || taxFrac == null) return null;

    const sellNetRaw = buy * (1 + mar / 100);
    const sellGrossRaw = sellNetRaw * (1 + taxFrac);

    return {
      sellNet: round2(sellNetRaw),
      sellGross: ceilToLeu(sellGrossRaw),
      sellGrossRaw: round2(sellGrossRaw),
    };
  }, [buyPriceNet, marginPct, selectedTax]);

  async function loadCategories() {
    const data = await apiJson<ApiList<Category>>(
      `/api/admin/categories?q=&limit=500&offset=0`,
    );
    setCats(data.items || []);
  }

  async function loadBrands() {
    const data = await apiJson<ApiList<Brand>>(
      `/api/admin/brands?q=&limit=500&offset=0`,
    );
    setBrands(data.items || []);
  }

  async function loadTaxRates() {
    const data = await apiJson<ApiList<TaxRate>>(`/api/admin/tax-rates`);
    setTaxRates(data.items || []);
  }

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const url =
        `/api/admin/products?q=${encodeURIComponent(q)}` +
        `&limit=200&offset=0` +
        (categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : "") +
        (brandFilterId ? `&brandId=${encodeURIComponent(brandFilterId)}` : "");

      const data = await apiJson<ApiList<Product>>(url);
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcare.");
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------
  // IMAGES
  // ----------------------------

  async function loadProductImages(productId: string) {
    if (!productId) return;
    setImgError(null);
    try {
      const data = await apiJson<{ ok: true; items: ProductImage[] }>(
        `/api/admin/products/${productId}/images`,
      );
      setProductImages(data.items || []);
    } catch (e: any) {
      setImgError(e?.message || "Eroare la încărcare imagini.");
    }
  }

  async function uploadProductFiles(
    productId: string,
    files: FileList | File[],
  ) {
    if (!productId) {
      setImgError("Salvează produsul înainte să încarci imagini.");
      return;
    }
    const arr = Array.from(files || []);
    if (arr.length === 0) return;

    setImgBusy(true);
    setImgError(null);

    try {
      for (const f of arr) {
        const ext = fileExt(f.name);

        // 1) signed upload url
        const up = await apiJson<{
          ok: true;
          signedUrl: string;
          path: string;
          token: string;
        }>(`/api/admin/products/${productId}/images/upload-url`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ext }),
        });

        // 2) upload to storage
        const putRes = await fetch(up.signedUrl, {
          method: "PUT",
          headers: { "content-type": f.type || "application/octet-stream" },
          body: f,
        });

        if (!putRes.ok) {
          const t = await putRes.text().catch(() => "");
          throw new Error(`Upload eșuat (${putRes.status}). ${t || ""}`.trim());
        }

        // 3) register in DB
        await apiJson(`/api/admin/products/${productId}/images`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storage_path: up.path,
            alt: null,
            sort_order: 0,
            is_primary: false,
          }),
        });
      }

      await loadProductImages(productId);
      setNotice("Imagini încărcate.");
    } catch (e: any) {
      setImgError(e?.message || "Eroare la încărcare imagini.");
      setError(e?.message || "Eroare la încărcare imagini.");
    } finally {
      setImgBusy(false);
    }
  }

  async function setPrimaryImage(productId: string, imageId: string) {
    if (!productId || !imageId) return;
    setImgBusy(true);
    setImgError(null);
    try {
      await apiJson(`/api/admin/products/${productId}/images/set-primary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_id: imageId }),
      });
      await loadProductImages(productId);
    } catch (e: any) {
      setImgError(e?.message || "Eroare la setare imagine principală.");
    } finally {
      setImgBusy(false);
    }
  }

  async function deleteImage(productId: string, imageId: string) {
    if (!productId || !imageId) return;
    if (!confirm("Ștergi imaginea?")) return;

    setImgBusy(true);
    setImgError(null);
    try {
      await apiJson(
        `/api/admin/products/${productId}/images?imageId=${encodeURIComponent(
          imageId,
        )}`,
        { method: "DELETE" },
      );
      await loadProductImages(productId);
    } catch (e: any) {
      setImgError(e?.message || "Eroare la ștergere imagine.");
    } finally {
      setImgBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadCategories(), loadBrands(), loadTaxRates()]);
        await loadProducts();
      } catch (e: any) {
        setError(e?.message || "Eroare la inițializare.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep selection only for visible products (after filtering/reload)
  useEffect(() => {
    if (!isAdmin) return;
    const vis = new Set(items.map((p) => p.id));
    setSelectedIds((prev) => prev.filter((id) => vis.has(id)));
  }, [isAdmin, items]);

  function resetForm() {
    setSku("");
    setName("");
    setSlug("");
    setDescription("");

    setBuyPriceNet("");
    setMarginPct("");

    const defaultTaxId = taxOptions[0]?.id || taxRates[0]?.id || "";
    setTaxRateId(defaultTaxId);

    setIsActive(true);
    setBrandId("");
    setCategoryIdEdit("");

    setPrimaryCode("");

    setUom("buc");
    setStockOnHand("");
    setStockReserved("");

    setEquivCodes([]);
    setNewEquivCode("");

    setProductImages([]);
    setImgError(null);
    setImgBusy(false);
  }

  function openCreate() {
    setEditId(null);
    resetForm();
    setProductImages([]);
    setNotice(null);
    setError(null);
    setModalOpen(true);
  }

  async function openEdit(id: string) {
    setNotice(null);
    setError(null);
    setImgError(null);
    try {
      const data = await apiJson<ApiOne<ProductDetails>>(
        `/api/admin/products/${id}`,
      );
      const p = data.item;

      setEditId(p.id);
      setSku(p.sku || "");
      setName(p.name || "");
      setSlug(p.slug || "");
      setDescription(p.description || "");

      setTaxRateId(p.tax_rate_id || "");
      setIsActive(!!p.is_active);

      setBuyPriceNet(p.buy_price_net == null ? "" : String(p.buy_price_net));
      setMarginPct(
        p.profit_margin_pct == null ? "" : String(p.profit_margin_pct),
      );

      setBrandId(p.brand_id || "");
      setCategoryIdEdit(p.category_id ?? "");

      setPrimaryCode(p.primary_code ?? "");
      setEquivCodes(p.equivalent_codes ?? []);

      setUom(p.uom || "buc");

      // stock
      setStockOnHand(p.stock_on_hand == null ? "" : String(p.stock_on_hand));
      setStockReserved(p.stock_reserved == null ? "" : String(p.stock_reserved));

      setModalOpen(true);
      await loadProductImages(p.id);
    } catch (e: any) {
      setError(e?.message || "Eroare la deschidere produs.");
    }
  }

  function splitEquivalentCodes(input: string) {
    // IMPORTANT: part codes may contain spaces (e.g. "1K0 615 301"),
    // so we only split by comma/semicolon/newline/TAB, not by whitespace.
    return String(input ?? "")
      .split(/[;,\n\r\t]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function handleAddCodeLocal() {
    const parts = splitEquivalentCodes(newEquivCode);
    if (parts.length === 0) return;

    setEquivCodes((prev) => {
      const seen = new Set(prev.map((c) => c.toLowerCase()));
      const next = [...prev];

      for (const raw of parts) {
        const val = raw.trim();
        if (!val) continue;

        const key = val.toLowerCase();
        if (seen.has(key)) continue;

        // Optional: avoid adding the primary code into equivalents
        if (primaryCode && key === primaryCode.trim().toLowerCase()) continue;

        next.push(val);
        seen.add(key);
      }

      return next;
    });

    setNewEquivCode("");
  }

  function handleRemoveCodeLocal(codeToRemove: string) {
    setEquivCodes((prev) => prev.filter((c) => c !== codeToRemove));
  }

  async function save() {
    setError(null);
    setNotice(null);

    const buy = safeNum(buyPriceNet);
    const mar = safeNum(marginPct);
    const stock = safeNum(stockOnHand);

    const payload: any = {
      sku: sku.trim(),
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() ? description : null,

      buy_price_net: buy,
      profit_margin_pct: mar,

      tax_rate_id: taxRateId || null,
      is_active: isActive,

      brand_id: brandId.trim() ? brandId.trim() : null,
      category_id: categoryIdEdit.trim() ? categoryIdEdit.trim() : null,

      uom: uom.trim() || "buc",
      stock_on_hand: stock,

      primary_code: primaryCode.trim() ? primaryCode.trim() : null,
      equivalent_codes: equivCodes,
    };

    if (!payload.sku || payload.sku.length < 2) return setError("SKU invalid.");
    if (!payload.name || payload.name.length < 2)
      return setError("Numele este obligatoriu.");
    if (!payload.slug) return setError("Slug invalid.");
    if (!payload.tax_rate_id) return setError("Selectează TVA.");

    if (payload.buy_price_net == null || payload.buy_price_net < 0)
      return setError("Preț achiziție (fără TVA) invalid.");
    if (payload.profit_margin_pct == null || payload.profit_margin_pct < 0)
      return setError("Marjă (%) invalidă.");
    if (payload.stock_on_hand == null || payload.stock_on_hand < 0)
      return setError("Stoc (disponibil) invalid.");
    if (!payload.primary_code) return setError("Cod principal obligatoriu.");

    try {
      if (!editId) {
        await apiJson(`/api/admin/products`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setNotice("Produs creat.");
      } else {
        await apiJson(`/api/admin/products/${editId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setNotice("Produs actualizat.");
      }

      setModalOpen(false);
      await loadProducts();
    } catch (e: any) {
      setError(e?.message || "Eroare la salvare.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Sigur vrei să ștergi produsul?")) return;
    try {
      await apiJson(`/api/admin/products/${id}`, { method: "DELETE" });
      setNotice("Produs șters.");
      await loadProducts();
    } catch (e: any) {
      setError(e?.message || "Eroare la ștergere.");
    }
  }

  // ----------------------------
  // BULK ACTIONS (admin only)
  // ----------------------------

  function clearBulkSelection() {
    setSelectedIds([]);
    setBulkBrandId("");
    setBulkCategoryId("");
    setBulkMarginPct("");
  }

  async function bulkPatchProducts(patch: any, successMsg: string) {
    if (!isAdmin) return;
    if (selectedIds.length === 0) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiJson<{ ok: true; updated: number; ids: string[] }>(
        `/api/admin/products/bulk`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: selectedIds, patch }),
        },
      );

      const count = Number(res?.updated ?? selectedIds.length);
      setNotice(`${successMsg} (${count})`);
      await loadProducts();
      clearBulkSelection();
    } catch (e: any) {
      setError(e?.message || "Eroare la actualizare în masă.");
    } finally {
      setLoading(false);
    }
  }

  async function bulkDeleteProducts() {
    if (!isAdmin) return;
    if (selectedIds.length === 0) return;

    if (!confirm(`Sigur vrei să ștergi ${selectedIds.length} produse?`)) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiJson<{ ok: true; deleted: number; ids: string[] }>(
        `/api/admin/products/bulk`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: selectedIds }),
        },
      );

      const count = Number(res?.deleted ?? selectedIds.length);
      setNotice(`Produse șterse. (${count})`);
      await loadProducts();
      clearBulkSelection();
    } catch (e: any) {
      setError(e?.message || "Eroare la ștergere în masă.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Produse</h1>
          <p className="mt-2 text-sm text-slate-600">
            Administrare catalog: preț, TVA, brand, coduri, dimensiuni,
            categorii.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după nume, SKU, slug…"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f] sm:w-80"
          />

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f] sm:w-56"
          >
            <option value="">Toate categoriile</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={brandFilterId}
            onChange={(e) => setBrandFilterId(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f] sm:w-56"
          >
            <option value="">Toate brandurile</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={loadProducts}
            className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Filtrează
          </button>

          {isAdmin ? (
            <button
              onClick={openCreate}
              className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Adaugă produs
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">
            Listă produse {loading ? "— se încarcă…" : `(${items.length})`}
          </div>

          {isAdmin && selectedIds.length > 0 ? (
            <div className="text-xs font-semibold text-slate-600">
              Selectate: {selectedIds.length}
            </div>
          ) : null}
        </div>

        {isAdmin && selectedIds.length > 0 ? (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Brand (bulk)
                  </label>
                  <select
                    value={bulkBrandId}
                    onChange={(e) => setBulkBrandId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#feab1f]"
                  >
                    <option value="">— (nu modifica) —</option>
                    <option value="__NULL__">— Fără brand —</option>
                    {brandOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Categorie (bulk)
                  </label>
                  <select
                    value={bulkCategoryId}
                    onChange={(e) => setBulkCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#feab1f]"
                  >
                    <option value="">— (nu modifica) —</option>
                    <option value="__NULL__">— Fără categorie —</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">
                    Marjă (%) (bulk)
                  </label>
                  <input
                    value={bulkMarginPct}
                    onChange={(e) => setBulkMarginPct(e.target.value)}
                    placeholder="ex: 25"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setError(null);

                    const patch: any = {};

                    if (bulkBrandId) {
                      patch.brand_id =
                        bulkBrandId === "__NULL__" ? null : bulkBrandId;
                    }

                    if (bulkCategoryId) {
                      patch.category_id =
                        bulkCategoryId === "__NULL__" ? null : bulkCategoryId;
                    }

                    const marginRaw = String(bulkMarginPct ?? "").trim();
                    if (marginRaw) {
                      const mar = safeNum(marginRaw);
                      if (mar == null || mar < 0) {
                        setError("Marjă (%) invalidă.");
                        return;
                      }
                      patch.profit_margin_pct = mar;
                    }

                    if (Object.keys(patch).length === 0) {
                      setError(
                        "Selectează cel puțin o modificare pentru bulk.",
                      );
                      return;
                    }

                    bulkPatchProducts(patch, "Produse actualizate");
                  }}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  disabled={
                    loading ||
                    (!bulkBrandId &&
                      !bulkCategoryId &&
                      !String(bulkMarginPct ?? "").trim())
                  }
                  type="button"
                >
                  Aplică modificări
                </button>

                <button
                  onClick={bulkDeleteProducts}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                  disabled={loading}
                  type="button"
                >
                  Șterge selectate
                </button>

                <button
                  onClick={() => setSelectedIds([])}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  disabled={loading}
                  type="button"
                >
                  Deselectează
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {isAdmin ? (
                <th className="px-4 py-3 font-semibold text-slate-700 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? visibleIds : [])
                    }
                    aria-label="Selectează toate produsele vizibile"
                  />
                </th>
              ) : null}

              <th className="px-4 py-3 font-semibold text-slate-700">Produs</th>
              <th className="px-4 py-3 font-semibold text-slate-700">SKU</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Brand</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Creat de
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Pret Achiziție
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Marjă (%)
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Preț (cu TVA)
              </th>
              <th className="px-4 py-3 font-semibold text-slate-700">Stoc</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Activ</th>
              <th className="px-4 py-3 font-semibold text-slate-700">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-4 text-slate-600"
                  colSpan={isAdmin ? 11 : 10}
                >
                  Nu există produse.
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const brandName =
                  (p.brand_name as any) ||
                  (p.brand_id
                    ? brandOptions.find((b) => b.id === p.brand_id)?.name
                    : "") ||
                  "—";
                const t = taxRates.find((x) => x.id === p.tax_rate_id);
                const taxFrac = t ? normalizeTaxRate(t.rate) : null;
                const gross =
                  taxFrac == null
                    ? null
                    : ceilToLeu(
                        Number(p.buy_price_net) *
                          (1 + Number(p.profit_margin_pct) / 100) *
                          (1 + taxFrac),
                      );

                const isChecked = isAdmin ? selectedIds.includes(p.id) : false;
                const onHand = Number((p as any).stock_on_hand ?? 0);
                const reserved = Number((p as any).stock_reserved ?? 0);
                const available = onHand - reserved;

                return (
                  <tr key={p.id} className="border-t border-slate-200">
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedIds((prev) => {
                              if (checked)
                                return prev.includes(p.id)
                                  ? prev
                                  : [...prev, p.id];
                              return prev.filter((x) => x !== p.id);
                            });
                          }}
                          aria-label={`Selectează produsul ${p.name}`}
                        />
                      </td>
                    ) : null}

                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {p.name}
                      </div>
                      <div className="text-xs text-slate-500">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.sku}</td>
                    <td className="px-4 py-3 text-slate-700">{brandName}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.created_by_name || p.created_by_email || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {Number(p.buy_price_net || 0).toFixed(2)} lei
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {Number(p.profit_margin_pct || 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {gross == null ? "—" : `${gross} lei`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-semibold text-slate-900">{available.toFixed(3)}</div>
                      <div className="text-[11px] text-slate-500">
                        în stoc: {onHand.toFixed(3)} · rezervat: {reserved.toFixed(3)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.is_active ? "Da" : "Nu"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(p.id)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Deschide
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => remove(p.id)}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          >
                            Șterge
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {editId ? "Editează produs" : "Adaugă produs"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Prețul final (cu TVA) este calculat automat: achiziție + marjă
                  + TVA (rotunjire în sus la leu întreg).
                  {editId ? (
                    <div className="mt-1">
                      Creat de:{" "}
                      {(items.find((x) => x.id === editId)?.created_by_name ||
                        items.find((x) => x.id === editId)?.created_by_email) ??
                        "—"}
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Închide
              </button>
            </div>

            <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Nume
                  </label>
                  <input
                    value={name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setName(v);
                      if (!editId && (!slug || slug === slugify(name)))
                        setSlug(slugify(v));
                    }}
                    className={inputBase}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      SKU
                    </label>
                    <input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Slug
                    </label>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Achiziție (fără TVA)
                    </label>
                    <input
                      value={buyPriceNet}
                      onChange={(e) => setBuyPriceNet(e.target.value)}
                      placeholder="ex: 120.50"
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Marjă (%)
                    </label>
                    <input
                      value={marginPct}
                      onChange={(e) => setMarginPct(e.target.value)}
                      placeholder="ex: 25"
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Preț net (vânzare)
                    </label>
                    <input
                      value={
                        preview?.sellNet != null ? String(preview.sellNet) : ""
                      }
                      readOnly
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Preț final (cu TVA)
                    </label>
                    <input
                      value={
                        preview?.sellGross != null
                          ? String(preview.sellGross)
                          : ""
                      }
                      readOnly
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      TVA
                    </label>
                    <select
                      value={taxRateId}
                      onChange={(e) => setTaxRateId(e.target.value)}
                      className={selectBase}
                    >
                      <option value="">Selectează TVA</option>
                      {taxOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({formatPct(t.rate)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">
                      Brand
                    </label>
                    <select
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      className={selectBase}
                    >
                      <option value="">— Fără brand —</option>
                      {brandOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Descriere
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={inputBase}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Produs activ
                </label>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Categorie
                  </label>
                  <select
                    value={categoryIdEdit}
                    onChange={(e) => setCategoryIdEdit(e.target.value)}
                    className={selectBase}
                  >
                    <option value="">— Fără categorie —</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {/* Images */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-600">
                      Imagini produs
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {editId
                        ? `${productImages.length} imagini`
                        : "Salvează produsul ca să încarci"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={!isAdmin || !editId || imgBusy}
                        onChange={(e) => {
                          const files = e.currentTarget.files;
                          if (!files || files.length === 0) return;
                          uploadProductFiles(editId as string, files);
                          e.currentTarget.value = "";
                        }}
                        className="text-xs"
                      />

                      {imgBusy ? (
                        <span className="text-[11px] text-slate-500">
                          Se procesează…
                        </span>
                      ) : null}
                    </div>

                    {imgError ? (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {imgError}
                      </div>
                    ) : null}

                    {productImages.length === 0 ? (
                      <div className="mt-3 text-xs text-slate-500 italic">
                        Nicio imagine.
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {productImages.map((img) => {
                          const url = publicProductImageUrl(img.storage_path);
                          return (
                            <div
                              key={img.id}
                              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                              title={img.storage_path}
                            >
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={img.alt || ""}
                                  className="h-28 w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-28 items-center justify-center text-[11px] text-slate-500">
                                  Fără URL
                                </div>
                              )}

                              <div className="absolute left-2 top-2">
                                {img.is_primary ? (
                                  <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
                                    Primary
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                                    —
                                  </span>
                                )}
                              </div>

                              {isAdmin ? (
                                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
                                  <button
                                    type="button"
                                    disabled={imgBusy}
                                    onClick={() =>
                                      setPrimaryImage(editId as string, img.id)
                                    }
                                    className="rounded bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-900 hover:bg-white"
                                  >
                                    Setează
                                  </button>
                                  <button
                                    type="button"
                                    disabled={imgBusy}
                                    onClick={() =>
                                      deleteImage(editId as string, img.id)
                                    }
                                    className="rounded bg-red-500/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-500"
                                  >
                                    Șterge
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-2 text-[11px] text-slate-500">
                      Bucket: <span className="font-mono">product-images</span>{" "}
                      (public)
                    </div>
                  </div>
                </div>

                {/* Codes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Cod principal (Piesa)
                  </label>
                  <input
                    value={primaryCode}
                    onChange={(e) => setPrimaryCode(e.target.value)}
                    placeholder="ex: 1K0 615 301"
                    className={inputBase}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600">
                    Coduri Echivalente (OE / Cross)
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
                      {equivCodes.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          Niciun cod echivalent.
                        </p>
                      ) : (
                        equivCodes.map((c, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0"
                          >
                            <span className="text-xs font-medium text-slate-900">
                              {c}
                            </span>
                            {isAdmin && (
                              <button
                                onClick={() => handleRemoveCodeLocal(c)}
                                className="text-slate-400 hover:text-red-600 text-xs px-2 font-bold"
                                type="button"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {isAdmin && (
                      <>
                        <div className="flex gap-2 border-t border-slate-100 pt-3">
                          <textarea
                            value={newEquivCode}
                            onChange={(e) => setNewEquivCode(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                (e.ctrlKey || e.metaKey)
                              ) {
                                e.preventDefault();
                                handleAddCodeLocal();
                              }
                            }}
                            placeholder="Adaugă coduri (separate prin virgulă / ; / linii noi). Ctrl+Enter / Cmd+Enter = adaugă."
                            rows={2}
                            className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                          ></textarea>
                          <button
                            onClick={handleAddCodeLocal}
                            type="button"
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800"
                          >
                            +
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          Poți lipi mai multe coduri (unul pe linie) sau
                          separate prin virgulă / ;.
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Stock */}
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Stoc
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">
                        Stoc în depozit (on hand)
                      </label>
                      <input
                        value={stockOnHand}
                        onChange={(e) => setStockOnHand(e.target.value)}
                        placeholder="ex: 10"
                        className={inputBase}
                        inputMode="decimal"
                      />
                      <div className="text-[11px] text-slate-500">
                        Modificare manuală (import / facturi / intrări).
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">
                        Rezervat (read-only)
                      </label>
                      <input
                        value={stockReserved}
                        readOnly
                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none"
                      />
                      <div className="text-[11px] text-slate-500">
                        Se modifică automat din comenzi.
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600">
                    Disponibil: <span className="font-semibold">{(() => {
                      const oh = safeNum(stockOnHand) ?? 0;
                      const rs = safeNum(stockReserved) ?? 0;
                      return (oh - rs).toFixed(3);
                    })()}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">
                    UM (uom)
                  </label>
                  <input
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className={inputBase}
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Renunță
              </button>

              {isAdmin ? (
                <button
                  onClick={save}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  Salvează
                </button>
              ) : (
                <button
                  disabled
                  className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                >
                  Doar vizualizare
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
