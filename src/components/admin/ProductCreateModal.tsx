"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ProductDTO } from "./ProductAutocomplete";

// Same fields, labels and price logic as the "Adaugă produs" form on /admin/produse.

type Option = { id: string; name: string };
type TaxRate = { id: string; name: string; rate: string | number };

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f]";
const readonlyBase =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none";
const labelCls = "text-xs font-semibold text-slate-700";

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

function safeNum(v: any) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function taxFrac(rate: string | number) {
  const r = Number(rate);
  if (!Number.isFinite(r)) return null;
  return r <= 1 ? r : r / 100;
}

function formatPct(rate: string | number) {
  const f = taxFrac(rate);
  if (f == null) return "—";
  const pct = f * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

export default function ProductCreateModal({
  initialCode,
  onCreated,
  onClose,
}: {
  initialCode: string;
  onCreated: (p: ProductDTO) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState(initialCode);
  const [buyPriceNet, setBuyPriceNet] = useState("");
  const [marginPct, setMarginPct] = useState("");
  const [taxRateId, setTaxRateId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [primaryCode, setPrimaryCode] = useState(initialCode);
  const [equivCodes, setEquivCodes] = useState<string[]>([]);
  const [newEquiv, setNewEquiv] = useState("");
  const [uom, setUom] = useState("buc");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [cats, setCats] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, b, c] = await Promise.all([
          fetch("/api/admin/tax-rates").then((r) => r.json()),
          fetch("/api/admin/brands?q=&limit=500&offset=0").then((r) => r.json()),
          fetch("/api/admin/categories?q=&limit=500&offset=0").then((r) => r.json()),
        ]);
        const rates: TaxRate[] = (t.items || [])
          .slice()
          .sort((a: TaxRate, b: TaxRate) => Number(b.rate) - Number(a.rate));
        setTaxRates(rates);
        const def21 = rates.find((r) => {
          const n = Number(r.rate);
          return Math.round(n <= 1 ? n * 100 : n) === 21;
        });
        const def = def21 ?? rates[0];
        if (def) setTaxRateId(def.id);
        setBrands((b.items || []).slice().sort((x: Option, y: Option) => x.name.localeCompare(y.name)));
        setCats((c.items || []).slice().sort((x: Option, y: Option) => x.name.localeCompare(y.name)));
      } catch {
        setError("Nu s-au putut încărca TVA / brand / categorii.");
      }
    })();
  }, []);

  const selectedTax = useMemo(() => {
    const t = taxRates.find((x) => x.id === taxRateId);
    return t ? taxFrac(t.rate) : null;
  }, [taxRateId, taxRates]);

  const preview = useMemo(() => {
    const buy = safeNum(buyPriceNet);
    const mar = safeNum(marginPct);
    if (buy == null || mar == null || selectedTax == null) return null;
    const net = buy * (1 + mar / 100);
    return { sellNet: Math.round(net * 100) / 100, sellGross: Math.ceil(net * (1 + selectedTax)) };
  }, [buyPriceNet, marginPct, selectedTax]);

  function addEquiv() {
    const parts = newEquiv
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setEquivCodes((cur) => Array.from(new Set([...cur, ...parts])));
    setNewEquiv("");
  }

  async function save() {
    setError(null);
    const buy = safeNum(buyPriceNet);
    const mar = safeNum(marginPct);

    if (sku.trim().length < 2) return setError("SKU invalid.");
    if (name.trim().length < 2) return setError("Numele este obligatoriu.");
    if (!slug.trim()) return setError("Slug invalid.");
    if (!taxRateId) return setError("Selectează TVA.");
    if (!categoryId) return setError("Selectează categorie.");
    if (buy == null || buy < 0) return setError("Preț achiziție (fără TVA) invalid.");
    if (mar == null || mar < 0) return setError("Marjă (%) invalidă.");
    if (!primaryCode.trim()) return setError("Cod piesă obligatoriu.");

    setSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sku: sku.trim(),
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() ? description : null,
          buy_price_net: buy,
          profit_margin_pct: mar,
          tax_rate_id: taxRateId,
          is_active: isActive,
          brand_id: brandId || null,
          category_id: categoryId,
          uom: uom.trim() || "buc",
          stock_on_hand: 0,
          primary_code: primaryCode.trim(),
          equivalent_codes: equivCodes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Eroare la salvare.");

      let imagePath: string | null = null;
      if (imageFile) {
        try {
          const ext = (imageFile.name.split(".").pop() || "jpg").toLowerCase();
          const up = await fetch(`/api/admin/products/${data.id}/images/upload-url`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ext }),
          }).then((r) => r.json());
          if (!up?.ok) throw new Error(up?.error || "Upload eșuat.");
          const put = await fetch(up.signedUrl, {
            method: "PUT",
            headers: { "content-type": imageFile.type || "application/octet-stream" },
            body: imageFile,
          });
          if (!put.ok) throw new Error(`Upload eșuat (${put.status}).`);
          const reg = await fetch(`/api/admin/products/${data.id}/images`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ storage_path: up.path, alt: null, sort_order: 0, is_primary: true }),
          }).then((r) => r.json());
          if (!reg?.ok) throw new Error(reg?.error || "Imaginea nu a putut fi salvată.");
          imagePath = up.path;
        } catch (err: any) {
          alert(`Produsul a fost creat, dar imaginea nu s-a încărcat: ${err?.message || err}`);
        }
      }

      onCreated({
        id: String(data.id),
        name: name.trim(),
        sku: sku.trim(),
        slug: slug.trim(),
        brand_name: brands.find((b) => b.id === brandId)?.name ?? null,
        primary_code: primaryCode.trim(),
        primary_image_path: imagePath,
        // same formula as the product search: CEILING(buy * (1+margin) , 2 decimals)
        price: Math.ceil(buy * (1 + mar / 100) * 100) / 100,
        vat_percent: Math.round((selectedTax ?? 0) * 100),
        stock_available: 0,
        uom: uom.trim() || "buc",
      });
    } catch (e: any) {
      setError(e?.message || "Eroare la salvare.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Adaugă produs</div>
            <div className="mt-1 text-xs text-slate-700">
              Prețul final (cu TVA) este calculat automat: achiziție + marjă + TVA (rotunjire în sus la leu întreg).
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Închide
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className={labelCls}>Nume</label>
              <input
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!slug || slug === slugify(name)) setSlug(slugify(v));
                  setName(v);
                }}
                className={inputBase}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>SKU</label>
                <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputBase} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Slug</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputBase} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <label className={labelCls}>Achiziție (fără TVA)</label>
                <input value={buyPriceNet} onChange={(e) => setBuyPriceNet(e.target.value)} placeholder="ex: 120.50" className={inputBase} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Marjă (%)</label>
                <input value={marginPct} onChange={(e) => setMarginPct(e.target.value)} placeholder="ex: 25" className={inputBase} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Preț net (vânzare)</label>
                <input value={preview ? String(preview.sellNet) : ""} readOnly className={readonlyBase} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Preț final (cu TVA)</label>
                <input value={preview ? String(preview.sellGross) : ""} readOnly className={readonlyBase} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>TVA</label>
                <select value={taxRateId} onChange={(e) => setTaxRateId(e.target.value)} className={inputBase}>
                  <option value="">Selectează TVA</option>
                  {taxRates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({formatPct(t.rate)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelCls}>Brand</label>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputBase}>
                  <option value="">— Fără brand —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Categorie</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputBase}>
                <option value="">Selectează categoria…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Descriere</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputBase} />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Produs activ
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className={labelCls}>Cod piesă</label>
              <input value={primaryCode} onChange={(e) => {
                const v = e.target.value;
                // SKU follows cod piesă until edited manually
                if (sku === primaryCode) setSku(v);
                setPrimaryCode(v);
              }} placeholder="ex: 1K0 615 301" className={inputBase} />
            </div>

            <div className="space-y-2">
              <div className={labelCls}>Coduri Echivalente (OE / Cross)</div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-3 max-h-40 space-y-2 overflow-y-auto">
                  {equivCodes.length === 0 ? (
                    <p className="text-xs italic text-slate-700">Niciun cod echivalent.</p>
                  ) : (
                    equivCodes.map((c) => (
                      <div key={c} className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                        <span className="text-xs font-medium text-slate-900">{c}</span>
                        <button
                          type="button"
                          onClick={() => setEquivCodes((cur) => cur.filter((x) => x !== c))}
                          className="px-2 text-xs font-bold text-slate-700 hover:text-red-600"
                        >
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <textarea
                    value={newEquiv}
                    onChange={(e) => setNewEquiv(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        addEquiv();
                      }
                    }}
                    placeholder="Adaugă coduri (separate prin virgulă / ; / linii noi). Ctrl+Enter = adaugă."
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-600 outline-none focus:border-[#feab1f]"
                  />
                  <button type="button" onClick={addEquiv} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>UM</label>
              <input value={uom} onChange={(e) => setUom(e.target.value)} className={inputBase} />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Imagine</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-800 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              {imageFile && (
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="Previzualizare"
                  className="mt-2 h-28 rounded-lg border border-slate-200 object-contain"
                />
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Anulează
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-full bg-[#feab1f] px-5 py-2 text-sm font-bold text-white hover:bg-[#e09800] disabled:opacity-60"
          >
            {saving ? "Se salvează…" : "Salvează și selectează"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
