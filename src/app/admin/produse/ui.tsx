"use client";

import { useEffect, useMemo, useState } from "react";

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
  rate: string | number;
};

type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price_gross: number;
  is_active: boolean;
  code: string | null;
  code_normalized: string | null;
  external_code: string | null;
  brand_id: string | null;
  tax_rate_id: string;
  uom: string | null;
  weight_kg: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  // optional if your list API returns it
  brand_name?: string | null;
  categories?: string | null;
};

type ProductDetails = Product & {
  description: string | null;
  category_ids: string[];
};

type ApiList<T> = { ok: true; items: T[]; limit?: number; offset?: number };
type ApiOne<T> = { ok: true; item: T; category_ids?: string[] };

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

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f]";
const selectBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#feab1f]";

export default function ProductsAdmin({ isAdmin }: { isAdmin: boolean }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [brandFilterId, setBrandFilterId] = useState<string>("");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // form state
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [priceGross, setPriceGross] = useState("0");
  const [taxRateId, setTaxRateId] = useState(""); // now a picker
  const [isActive, setIsActive] = useState(true);

  const [code, setCode] = useState("");
  const [codeNorm, setCodeNorm] = useState("");
  const [externalCode, setExternalCode] = useState("");
  const [brandId, setBrandId] = useState(""); // now a picker

  const [uom, setUom] = useState("buc");
  const [weightKg, setWeightKg] = useState("");
  const [lengthMm, setLengthMm] = useState("");
  const [widthMm, setWidthMm] = useState("");
  const [heightMm, setHeightMm] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const categoryOptions = useMemo(
    () => cats.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [cats]
  );
  const brandOptions = useMemo(
    () => brands.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [brands]
  );
  const taxOptions = useMemo(
    () => taxRates.slice().sort((a, b) => Number(b.rate) - Number(a.rate)),
    [taxRates]
  );

  async function loadCategories() {
    const data = await apiJson<ApiList<Category>>(`/api/admin/categories?q=&limit=500&offset=0`);
    setCats(data.items || []);
  }

  async function loadBrands() {
    const data = await apiJson<ApiList<Brand>>(`/api/admin/brands?q=&limit=500&offset=0`);
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

  function resetForm() {
    setSku("");
    setName("");
    setSlug("");
    setDescription("");
    setPriceGross("0");
    setTaxRateId(taxOptions[0]?.id || ""); // default TVA
    setIsActive(true);

    setCode("");
    setCodeNorm("");
    setExternalCode("");
    setBrandId(""); // optional

    setUom("buc");
    setWeightKg("");
    setLengthMm("");
    setWidthMm("");
    setHeightMm("");
    setCategoryIds([]);
  }

  function openCreate() {
    setEditId(null);
    resetForm();
    setNotice(null);
    setError(null);
    setModalOpen(true);
  }

  async function openEdit(id: string) {
    setNotice(null);
    setError(null);
    try {
      const data = await apiJson<ApiOne<ProductDetails>>(`/api/admin/products/${id}`);
      const p = data.item;

      setEditId(p.id);
      setSku(p.sku || "");
      setName(p.name || "");
      setSlug(p.slug || "");
      setDescription(p.description || "");
      setPriceGross(String(p.price_gross ?? 0));
      setTaxRateId(p.tax_rate_id || "");
      setIsActive(!!p.is_active);

      setCode(p.code || "");
      setCodeNorm(p.code_normalized || "");
      setExternalCode(p.external_code || "");
      setBrandId(p.brand_id || "");

      setUom(p.uom || "buc");
      setWeightKg(p.weight_kg == null ? "" : String(p.weight_kg));
      setLengthMm(p.length_mm == null ? "" : String(p.length_mm));
      setWidthMm(p.width_mm == null ? "" : String(p.width_mm));
      setHeightMm(p.height_mm == null ? "" : String(p.height_mm));

      setCategoryIds((data.category_ids || []) as string[]);
      setModalOpen(true);
    } catch (e: any) {
      setError(e?.message || "Eroare la deschidere produs.");
    }
  }

  async function save() {
    setError(null);
    setNotice(null);

    const payload = {
      sku: sku.trim(),
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() ? description : null,
      price_gross: Number(String(priceGross).replace(",", ".")),
      tax_rate_id: taxRateId || null,
      is_active: isActive,

      code: code.trim() ? code.trim() : null,
      code_normalized: codeNorm.trim() ? codeNorm.trim() : null,
      external_code: externalCode.trim() ? externalCode.trim() : null,
      brand_id: brandId.trim() ? brandId.trim() : null,

      uom: uom.trim() || "buc",
      weight_kg: safeNum(weightKg),
      length_mm: safeNum(lengthMm),
      width_mm: safeNum(widthMm),
      height_mm: safeNum(heightMm),

      category_ids: categoryIds,
    };

    if (!payload.sku || payload.sku.length < 2) return setError("SKU invalid.");
    if (!payload.name || payload.name.length < 2) return setError("Numele este obligatoriu.");
    if (!payload.slug) return setError("Slug invalid.");
    if (!payload.tax_rate_id) return setError("Selectează TVA.");
    if (!Number.isFinite(payload.price_gross) || payload.price_gross < 0) return setError("Preț invalid.");

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
    setError(null);
    setNotice(null);

    if (!confirm("Sigur vrei să ștergi produsul?")) return;

    try {
      await apiJson(`/api/admin/products/${id}`, { method: "DELETE" });
      setNotice("Produs șters.");
      await loadProducts();
    } catch (e: any) {
      setError(e?.message || "Eroare la ștergere.");
    }
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Produse</h1>
          <p className="mt-2 text-sm text-slate-600">
            Administrare catalog: preț, TVA, brand, coduri, dimensiuni, categorii.
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
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Produs</th>
              <th className="px-4 py-3 font-semibold text-slate-700">SKU</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Brand</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Preț (cu TVA)</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Activ</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-600" colSpan={6}>
                  Nu există produse.
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const brandName =
                  (p.brand_name as any) ||
                  (p.brand_id ? brandOptions.find((b) => b.id === p.brand_id)?.name : "") ||
                  "—";

                return (
                  <tr key={p.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.sku}</td>
                    <td className="px-4 py-3 text-slate-700">{brandName}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {Number(p.price_gross || 0).toFixed(2)} lei
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.is_active ? "Da" : "Nu"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(p.id)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Deschide
                        </button>

                        {isAdmin ? (
                          <button
                            onClick={() => remove(p.id)}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          >
                            Șterge
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Doar vizualizare</span>
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

      {/* Modal */}
      {modalOpen ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {editId ? "Editează produs" : "Adaugă produs"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Completează câmpurile esențiale (SKU, nume, slug, TVA, preț). Restul sunt opționale.
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
                  <label className="text-xs font-semibold text-slate-600">Nume</label>
                  <input
                    value={name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setName(v);
                      if (!editId && (!slug || slug === slugify(name))) setSlug(slugify(v));
                    }}
                    className={inputBase}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">SKU</label>
                    <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputBase} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Slug</label>
                    <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputBase} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Preț (cu TVA)</label>
                    <input value={priceGross} onChange={(e) => setPriceGross(e.target.value)} className={inputBase} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">TVA</label>
                    <select value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)} className={selectBase}>
                      <option value="">Selectează TVA</option>
                      {taxOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({Math.round(Number(t.rate) * 100)}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Descriere</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={inputBase}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Produs activ
                </label>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Cod</label>
                    <input value={code} onChange={(e) => setCode(e.target.value)} className={inputBase} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Cod normalizat</label>
                    <input value={codeNorm} onChange={(e) => setCodeNorm(e.target.value)} className={inputBase} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Cod extern</label>
                    <input value={externalCode} onChange={(e) => setExternalCode(e.target.value)} className={inputBase} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Brand</label>
                    <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={selectBase}>
                      <option value="">— Fără brand —</option>
                      {brandOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">UM (uom)</label>
                    <input value={uom} onChange={(e) => setUom(e.target.value)} className={inputBase} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Greutate (kg)</label>
                    <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="ex: 1.25" className={inputBase} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Lungime (mm)</label>
                    <input value={lengthMm} onChange={(e) => setLengthMm(e.target.value)} className={inputBase} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Lățime (mm)</label>
                    <input value={widthMm} onChange={(e) => setWidthMm(e.target.value)} className={inputBase} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Înălțime (mm)</label>
                    <input value={heightMm} onChange={(e) => setHeightMm(e.target.value)} className={inputBase} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600">Categorii</div>
                  <div className="max-h-48 overflow-auto rounded-xl border border-slate-200 p-3">
                    {categoryOptions.length === 0 ? (
                      <div className="text-sm text-slate-500">Nu există categorii.</div>
                    ) : (
                      <div className="space-y-2">
                        {categoryOptions.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                            {c.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
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
                <button disabled className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
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