"use client";

import { useEffect, useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  product_count?: number;
};

type Brand = {
  id: string;
  name: string;
};

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
    headers: {
      accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Eroare.");
  return data as T;
}

export default function CatalogAdmin({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<"categories" | "brands">("categories");

  // shared notices
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ========== CATEGORIES ==========
  const [cats, setCats] = useState<Category[]>([]);
  const [catsQ, setCatsQ] = useState("");
  const [catsLoading, setCatsLoading] = useState(false);

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catParentId, setCatParentId] = useState<string>("");

  const parentOptions = useMemo(
    () => cats.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [cats]
  );

  async function loadCategories() {
    setCatsLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ ok: true; items: Category[] }>(
        `/api/admin/categories?q=${encodeURIComponent(catsQ)}&limit=200&offset=0`
      );
      setCats(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcare categorii.");
    } finally {
      setCatsLoading(false);
    }
  }

  function openCreateCategory() {
    setCatEditId(null);
    setCatName("");
    setCatSlug("");
    setCatParentId("");
    setError(null);
    setNotice(null);
    setCatModalOpen(true);
  }

  function openEditCategory(c: Category) {
    setCatEditId(c.id);
    setCatName(c.name);
    setCatSlug(c.slug);
    setCatParentId(c.parent_id || "");
    setError(null);
    setNotice(null);
    setCatModalOpen(true);
  }

  async function saveCategory() {
    setError(null);
    setNotice(null);

    const payload = {
      name: catName.trim(),
      slug: catSlug.trim(),
      parent_id: catParentId || null,
    };

    if (!payload.name || payload.name.length < 2) return setError("Numele este obligatoriu.");
    if (!payload.slug || payload.slug.length < 2) return setError("Slug invalid.");

    try {
      if (!catEditId) {
        await apiJson(`/api/admin/categories`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setNotice("Categoria a fost creată.");
      } else {
        await apiJson(`/api/admin/categories/${catEditId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setNotice("Categoria a fost actualizată.");
      }

      setCatModalOpen(false);
      await loadCategories();
    } catch (e: any) {
      setError(e?.message || "Eroare la salvare categorie.");
    }
  }

  async function removeCategory(id: string) {
    setError(null);
    setNotice(null);

    const ok = confirm("Sigur vrei să ștergi categoria?");
    if (!ok) return;

    try {
      await apiJson(`/api/admin/categories/${id}`, { method: "DELETE" });
      setNotice("Categoria a fost ștearsă.");
      await loadCategories();
    } catch (e: any) {
      setError(e?.message || "Eroare la ștergere categorie.");
    }
  }

  // ========== BRANDS ==========
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsQ, setBrandsQ] = useState("");
  const [brandsLoading, setBrandsLoading] = useState(false);

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandEditId, setBrandEditId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");

  async function loadBrands() {
    setBrandsLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ ok: true; items: Brand[] }>(
        `/api/admin/brands?q=${encodeURIComponent(brandsQ)}&limit=200&offset=0`
      );
      setBrands(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcare branduri.");
    } finally {
      setBrandsLoading(false);
    }
  }

  function openCreateBrand() {
    setBrandEditId(null);
    setBrandName("");
    setError(null);
    setNotice(null);
    setBrandModalOpen(true);
  }

  function openEditBrand(b: Brand) {
    setBrandEditId(b.id);
    setBrandName(b.name);
    setError(null);
    setNotice(null);
    setBrandModalOpen(true);
  }

  async function saveBrand() {
    setError(null);
    setNotice(null);

    const payload = { name: brandName.trim() };
    if (!payload.name || payload.name.length < 2) return setError("Numele brandului este obligatoriu.");

    try {
      if (!brandEditId) {
        await apiJson(`/api/admin/brands`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setNotice("Brandul a fost creat.");
      } else {
        await apiJson(`/api/admin/brands/${brandEditId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        setNotice("Brandul a fost actualizat.");
      }

      setBrandModalOpen(false);
      await loadBrands();
    } catch (e: any) {
      setError(e?.message || "Eroare la salvare brand.");
    }
  }

  async function removeBrand(id: string) {
    setError(null);
    setNotice(null);

    const ok = confirm("Sigur vrei să ștergi brandul?");
    if (!ok) return;

    try {
      await apiJson(`/api/admin/brands/${id}`, { method: "DELETE" });
      setNotice("Brandul a fost șters.");
      await loadBrands();
    } catch (e: any) {
      setError(e?.message || "Eroare la ștergere brand.");
    }
  }

  // init load per tab
  useEffect(() => {
    (async () => {
      if (tab === "categories") await loadCategories();
      else await loadBrands();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const inputBase =
    "w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 " +
    "placeholder:text-slate-500 outline-none focus:border-[#feab1f]";

  // make edit textbox text darker (also for modals)
  const inputModal =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 " +
    "placeholder:text-slate-500 outline-none focus:border-[#feab1f]";

  return (
    <div className="w-full">
      {/* Header + Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Catalog</h1>
          <p className="mt-2 text-sm text-slate-600">Administrare categorii și branduri.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab("categories")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === "categories" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Categorii
            </button>
            <button
              onClick={() => setTab("brands")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === "brands" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              Branduri
            </button>
          </div>

          {tab === "categories" ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={catsQ}
                onChange={(e) => setCatsQ(e.target.value)}
                placeholder="Caută după nume sau slug…"
                className={`${inputBase} sm:w-80`}
              />
              <button
                onClick={loadCategories}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Caută
              </button>
              {isAdmin ? (
                <button
                  onClick={openCreateCategory}
                  className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  Adaugă categorie
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                value={brandsQ}
                onChange={(e) => setBrandsQ(e.target.value)}
                placeholder="Caută după nume…"
                className={`${inputBase} sm:w-80`}
              />
              <button
                onClick={loadBrands}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Caută
              </button>
              {isAdmin ? (
                <button
                  onClick={openCreateBrand}
                  className="rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  Adaugă brand
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Notices */}
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

      {/* Lists */}
      {tab === "categories" ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">
              Listă categorii {catsLoading ? "— se încarcă…" : `(${cats.length})`}
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Nume</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Slug</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Părinte</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Produse</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {cats.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={5}>
                    Nu există categorii.
                  </td>
                </tr>
              ) : (
                cats.map((c) => {
                  const parent = c.parent_id ? cats.find((x) => x.id === c.parent_id) : null;
                  return (
                    <tr key={c.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-slate-700">{c.slug}</td>
                      <td className="px-4 py-3 text-slate-700">{parent?.name || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{c.product_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => openEditCategory(c)}
                                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                              >
                                Editează
                              </button>
                              <button
                                onClick={() => removeCategory(c.id)}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                              >
                                Șterge
                              </button>
                            </>
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
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">
              Listă branduri {brandsLoading ? "— se încarcă…" : `(${brands.length})`}
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Nume</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {brands.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-600" colSpan={2}>
                    Nu există branduri.
                  </td>
                </tr>
              ) : (
                brands.map((b) => (
                  <tr key={b.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900">{b.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => openEditBrand(b)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                              Editează
                            </button>
                            <button
                              onClick={() => removeBrand(b.id)}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                            >
                              Șterge
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Doar vizualizare</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {catModalOpen ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {catEditId ? "Editează categorie" : "Adaugă categorie"}
                </div>
                <div className="mt-1 text-xs text-slate-500">Nume, slug și opțional părinte.</div>
              </div>
              <button
                onClick={() => setCatModalOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Închide
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Nume</label>
                <input
                  value={catName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCatName(v);
                    if (!catEditId && (!catSlug || catSlug === slugify(catName))) setCatSlug(slugify(v));
                  }}
                  className={inputModal}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Slug</label>
                <input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} className={inputModal} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Categorie părinte (opțional)</label>
                <select
                  value={catParentId}
                  onChange={(e) => setCatParentId(e.target.value)}
                  className={inputModal}
                >
                  <option value="">— fără părinte —</option>
                  {parentOptions
                    .filter((x) => x.id !== catEditId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                onClick={() => setCatModalOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Renunță
              </button>
              <button
                onClick={saveCategory}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Salvează
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* BRAND MODAL */}
      {brandModalOpen ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {brandEditId ? "Editează brand" : "Adaugă brand"}
                </div>
                <div className="mt-1 text-xs text-slate-500">Completează numele brandului.</div>
              </div>
              <button
                onClick={() => setBrandModalOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Închide
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Nume</label>
                <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputModal} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                onClick={() => setBrandModalOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Renunță
              </button>
              <button
                onClick={saveBrand}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Salvează
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}