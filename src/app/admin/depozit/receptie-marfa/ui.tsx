"use client";

import { useState, useCallback, useEffect } from "react";

type ParsedItem = {
  code: string;
  name: string;
  quantity: number;
  buyPrice: number;
  marginPct: number;
  matched: boolean;
  productId: string | null;
  existingName: string | null;
  existingSku: string | null;
  existingBuyPrice: number | null;
  existingMarginPct: number | null;
  existingStock: number | null;
};

type ProcessedResult = {
  code: string;
  name: string;
  action: "updated" | "created";
  productId: string;
  newStock: number;
  buyPrice: number;
  marginPct: number;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
};

type Mode = "choose" | "pdf" | "manual";
type Step = "input" | "review" | "done";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#feab1f] focus:ring-1 focus:ring-[#feab1f] transition";

export function ReceptieMarfaClient() {
  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<Step>("input");

  // Warehouse
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);

  // Document metadata
  const [documentNumber, setDocumentNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [note, setNote] = useState("");

  // Load warehouses on mount + restore last selection
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/warehouses");
        const data = await res.json();
        if (data.ok && data.items?.length) {
          const active = data.items.filter((w: any) => w.is_active);
          setWarehouses(active);
          const saved = localStorage.getItem("receptie_warehouse_id");
          if (saved && active.some((w: any) => w.id === saved)) {
            setWarehouseId(saved);
          } else if (active.length === 1) {
            setWarehouseId(active[0].id);
          }
        }
      } catch {}
      setLoadingWarehouses(false);
    })();
  }, []);

  // Persist warehouse selection
  useEffect(() => {
    if (warehouseId) localStorage.setItem("receptie_warehouse_id", warehouseId);
  }, [warehouseId]);

  // PDF mode
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");

  // Items (shared between modes)
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [results, setResults] = useState<ProcessedResult[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History
  type HistoryReceipt = {
    id: string;
    document_number: string | null;
    supplier_name: string | null;
    note: string | null;
    source: string;
    created_at: string;
    created_by_name: string | null;
    items_count: number;
    total_quantity: number;
    total_value: number;
  };
  type HistoryItem = {
    id: string; code: string; name: string; quantity: number;
    buy_price: number; action: string;
  };
  const [history, setHistory] = useState<HistoryReceipt[]>([]);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [receiptItems, setReceiptItems] = useState<HistoryItem[]>([]);
  const [receiptItemsLoading, setReceiptItemsLoading] = useState(false);

  const loadHistory = useCallback(async (limit: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/depozit/receptie-marfa?limit=${limit + 1}`);
      const data = await res.json();
      if (data.ok) {
        const all = data.items || [];
        setHistoryHasMore(all.length > limit);
        setHistory(all.slice(0, limit));
      }
    } catch {}
    setHistoryLoading(false);
  }, []);

  useEffect(() => { loadHistory(historyLimit); }, [historyLimit, loadHistory]);

  // Reload history after a receipt is saved
  useEffect(() => {
    if (step === "done") loadHistory(historyLimit);
  }, [step, historyLimit, loadHistory]);

  const toggleReceiptDetail = useCallback(async (id: string) => {
    if (expandedReceiptId === id) {
      setExpandedReceiptId(null);
      return;
    }
    setExpandedReceiptId(id);
    setReceiptItemsLoading(true);
    try {
      const res = await fetch(`/api/admin/depozit/receptie-marfa/${id}`);
      const data = await res.json();
      if (data.ok) setReceiptItems(data.items || []);
    } catch {}
    setReceiptItemsLoading(false);
  }, [expandedReceiptId]);

  // ── Search product by code (for manual mode) ──
  const searchProduct = useCallback(async (idx: number, code: string) => {
    if (!code.trim()) return;
    try {
      const res = await fetch(
        `/api/admin/products/search?q=${encodeURIComponent(code.trim())}`
      );
      const data = await res.json();
      if (data.ok && data.items?.length) {
        const p = data.items[0];
        setItems((prev) => {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            matched: true,
            productId: p.id,
            name: p.name,
            buyPrice: Number(p.buy_price_net),
            marginPct: Number(p.profit_margin_pct ?? 30),
            existingName: p.name,
            existingSku: p.sku,
            existingBuyPrice: Number(p.buy_price_net),
            existingMarginPct: Number(p.profit_margin_pct ?? 30),
            existingStock: Number(p.stock_on_hand),
          };
          return copy;
        });
      }
    } catch {}
  }, []);

  // ── PDF upload + parse ──
  const handleUpload = useCallback(async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Doar fișiere PDF sunt acceptate.");
      return;
    }
    setUploading(true);
    setError(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/depozit/receptie-marfa/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Eroare la procesarea PDF-ului.");
        setRawText(data.rawText || "");
        return;
      }
      setRawText(data.rawText || "");
      if (!data.items?.length) {
        setError(
          data.message ||
            "Nu am găsit produse în document. Poți adăuga manual."
        );
        return;
      }
      setItems(data.items);
      setStep("review");
    } catch (err: any) {
      setError(err.message || "Eroare la încărcare.");
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Submit all items ──
  const handleSubmit = useCallback(async () => {
    // Validate document fields
    if (!documentNumber.trim()) {
      setError("Nr. document / factură este obligatoriu.");
      return;
    }
    if (!supplierName.trim()) {
      setError("Furnizorul este obligatoriu.");
      return;
    }

    // Validate each item — all fields mandatory
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.code.trim()) {
        setError(`Rândul ${i + 1}: Codul produsului este obligatoriu.`);
        return;
      }
      if (!item.name.trim()) {
        setError(`Rândul ${i + 1}: Denumirea produsului este obligatorie.`);
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        setError(`Rândul ${i + 1}: Cantitatea trebuie să fie mai mare decât 0.`);
        return;
      }
      if (item.buyPrice < 0 || !Number.isFinite(item.buyPrice)) {
        setError(`Rândul ${i + 1}: Prețul de achiziție este invalid.`);
        return;
      }
      if (item.marginPct < 0 || !Number.isFinite(item.marginPct)) {
        setError(`Rândul ${i + 1}: Adaosul (%) este invalid.`);
        return;
      }
    }

    const toProcess = items.filter((i) => i.quantity > 0 && i.code.trim());
    if (!toProcess.length) {
      setError("Adaugă cel puțin un produs.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/depozit/receptie-marfa/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          documentNumber,
          supplierName,
          note,
          source: mode === "pdf" ? "pdf" : "manual",
          items: toProcess.map((i) => ({
            productId: i.productId,
            code: i.code,
            name: i.name,
            quantity: i.quantity,
            buyPrice: i.buyPrice,
            marginPct: i.marginPct,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Eroare la salvare.");
        return;
      }
      setResults(data.results || []);
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Eroare la salvare.");
    } finally {
      setSubmitting(false);
    }
  }, [items, warehouseId, documentNumber, supplierName, note, mode]);

  // ── Item helpers ──
  const updateItem = (idx: number, field: keyof ParsedItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEmptyItem = () => {
    setItems((prev) => [
      ...prev,
      {
        code: "",
        name: "",
        quantity: 1,
        buyPrice: 0,
        marginPct: 30,
        matched: false,
        productId: null,
        existingName: null,
        existingSku: null,
        existingBuyPrice: null,
        existingMarginPct: null,
        existingStock: null,
      },
    ]);
  };

  const reset = () => {
    setMode("choose");
    setStep("input");
    setItems([]);
    setResults([]);
    setError(null);
    setRawText("");
    setFileName("");
    setDocumentNumber("");
    setSupplierName("");
    setNote("");
  };

  /* ═══════════════════════════════════════════ */

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Recepție marfă</h1>
        <p className="mt-1 text-sm text-slate-700">
          Înregistrează marfa primită în depozit — din PDF sau manual.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ═══════ WAREHOUSE SELECTOR ═══════ */}
      {mode === "choose" && step === "input" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Depozit
          </label>
          {loadingWarehouses ? (
            <p className="text-sm text-slate-600">Se încarcă depozitele…</p>
          ) : warehouses.length === 0 ? (
            <p className="text-sm text-red-600">Nu există depozite active. Creează unul din secțiunea Depozite.</p>
          ) : (
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Selectează depozitul —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ═══════ CHOOSE MODE ═══════ */}
      {mode === "choose" && step === "input" && warehouseId && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => setMode("pdf")}
            className="group rounded-xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-[#feab1f] hover:shadow-md"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-red-500 mb-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M12 18v-6" />
              <path d="M9 15l3-3 3 3" />
            </svg>
            <div className="text-sm font-bold text-slate-900">Încarcă PDF</div>
            <div className="mt-1 text-xs text-slate-700">
              Încarcă documentul (factură, aviz) și produsele vor fi extrase automat.
            </div>
          </button>

          <button
            onClick={() => {
              setMode("manual");
              addEmptyItem();
            }}
            className="group rounded-xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-[#feab1f] hover:shadow-md"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-[#feab1f] mb-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <div className="text-sm font-bold text-slate-900">Adaugă manual</div>
            <div className="mt-1 text-xs text-slate-700">
              Completează produsele, cantitățile și prețurile de mână.
            </div>
          </button>
        </div>
      )}

      {/* ═══════ DOCUMENT INFO (both modes, before done) ═══════ */}
      {mode !== "choose" && step !== "done" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Informații document
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nr. document / factură <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ex: FV-00123"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Furnizor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Bosch SRL"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Notă (opțional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Observații…"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════ PDF UPLOAD (step: input, mode: pdf) ═══════ */}
      {mode === "pdf" && step === "input" && (
        <>
          <div
            className={`relative rounded-xl border-2 border-dashed p-10 text-center transition ${
              dragOver
                ? "border-[#feab1f] bg-[#feab1f]/5"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="mx-auto h-12 w-12 text-slate-600" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M12 18v-6" />
              <path d="M9 15l3-3 3 3" />
            </svg>
            <p className="mt-4 text-sm font-medium text-slate-700">
              Trage PDF-ul aici sau{" "}
              <label className="cursor-pointer text-[#b57712] underline underline-offset-2 hover:text-[#8a5a0e]">
                alege de pe calculator
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
              </label>
            </p>
            <p className="mt-1 text-xs text-slate-600">Se caută codul, denumirea și prețul de achiziție</p>
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Se procesează PDF-ul…
            </div>
          )}

          {rawText && !items.length && (
            <details className="rounded-lg border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                Text extras din PDF (pentru verificare)
              </summary>
              <pre className="max-h-64 overflow-auto px-4 pb-4 text-xs text-slate-600 whitespace-pre-wrap">{rawText}</pre>
            </details>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              ← Înapoi
            </button>
          </div>
        </>
      )}

      {/* ═══════ MANUAL / REVIEW TABLE (shared) ═══════ */}
      {((mode === "manual" && step === "input") || step === "review") && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">
                {mode === "pdf" && fileName && (
                  <span className="mr-2 text-slate-600">{fileName}</span>
                )}
                {items.length} produs{items.length !== 1 ? "e" : ""}
              </p>
              <p className="text-xs text-slate-700">
                {mode === "manual"
                  ? "Completează datele, caută produsul după cod, apoi salvează."
                  : "Verifică datele, editează dacă e nevoie, apoi salvează."}
              </p>
            </div>
            <button onClick={reset} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              ← Înapoi
            </button>
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-slate-700">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
              Produs existent – se actualizează stoc + preț
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
              Produs nou – se creează automat
            </span>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">Cod</th>
                  <th className="px-4 py-3">Denumire</th>
                  <th className="px-4 py-3 text-right">Cantitate</th>
                  <th className="px-4 py-3 text-right">Preț achiziție</th>
                  <th className="px-4 py-3 text-right">Adaos %</th>
                  <th className="px-4 py-3 text-right">Stoc existent</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx} className={`transition ${item.matched ? "bg-white" : "bg-amber-50/50"}`}>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${item.matched ? "bg-green-400" : "bg-amber-400"}`}
                        title={item.matched ? "Produs existent" : "Produs nou"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={item.code}
                          onChange={(e) => {
                            updateItem(idx, "code", e.target.value);
                            // Reset match when code changes
                            if (item.matched) {
                              updateItem(idx, "matched", false);
                              updateItem(idx, "productId", null);
                            }
                          }}
                          placeholder="Cod produs"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none focus:ring-1 focus:ring-[#feab1f]"
                        />
                        {mode === "manual" && (
                          <button
                            onClick={() => searchProduct(idx, item.code)}
                            className="rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            title="Caută produsul"
                          >
                            🔍
                          </button>
                        )}
                      </div>
                      {item.existingSku && item.existingSku !== item.code && (
                        <div className="mt-0.5 text-[11px] text-slate-500">SKU: {item.existingSku}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(idx, "name", e.target.value)}
                        placeholder="Denumire produs"
                        className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none focus:ring-1 focus:ring-[#feab1f]"
                      />
                      {item.existingName && item.existingName !== item.name && (
                        <div className="mt-0.5 text-[11px] text-slate-500">Existent: {item.existingName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", Number(e.target.value) || 0)}
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none focus:ring-1 focus:ring-[#feab1f]"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.buyPrice}
                          onChange={(e) => updateItem(idx, "buyPrice", Number(e.target.value) || 0)}
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none focus:ring-1 focus:ring-[#feab1f]"
                        />
                        <span className="text-xs text-slate-600">RON</span>
                      </div>
                      {item.existingBuyPrice != null && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Anterior: {item.existingBuyPrice.toFixed(2)} RON
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.marginPct}
                          onChange={(e) => updateItem(idx, "marginPct", Number(e.target.value) || 0)}
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none focus:ring-1 focus:ring-[#feab1f]"
                        />
                        <span className="text-xs text-slate-600">%</span>
                      </div>
                      {item.existingMarginPct != null && item.existingMarginPct !== item.marginPct && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Anterior: {item.existingMarginPct}%
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {item.matched ? (
                        <span>
                          {item.existingStock ?? 0}
                          <span className="ml-1 text-green-600">→ {(item.existingStock ?? 0) + item.quantity}</span>
                        </span>
                      ) : (
                        <span className="text-amber-600 text-xs">Nou</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeItem(idx)} className="text-slate-600 hover:text-red-500 transition" title="Elimină">
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row + submit */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={addEmptyItem}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                + Adaugă rând
              </button>
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-green-700">{items.filter((i) => i.matched).length}</span> de actualizat,{" "}
                <span className="font-semibold text-amber-700">{items.filter((i) => !i.matched).length}</span> de creat
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || items.length === 0}
              className="rounded-xl bg-[#feab1f] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e89a10] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Se salvează…
                </span>
              ) : (
                "Salvează recepția"
              )}
            </button>
          </div>

          {rawText && (
            <details className="rounded-lg border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                Text extras din PDF
              </summary>
              <pre className="max-h-64 overflow-auto px-4 pb-4 text-xs text-slate-600 whitespace-pre-wrap">{rawText}</pre>
            </details>
          )}
        </>
      )}

      {/* ═══════ DONE ═══════ */}
      {step === "done" && (
        <>
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="mx-auto h-10 w-10 text-green-500" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4L12 14.01l-3-3" />
            </svg>
            <h2 className="mt-3 text-lg font-bold text-green-800">Recepția a fost salvată!</h2>
            <p className="mt-1 text-sm text-green-700">
              {results.length} produs{results.length !== 1 ? "e" : ""} procesat{results.length !== 1 ? "e" : ""}.
            </p>
            {(documentNumber || supplierName) && (
              <p className="mt-2 text-xs text-green-600">
                {documentNumber && <>Document: <strong>{documentNumber}</strong></>}
                {documentNumber && supplierName && " • "}
                {supplierName && <>Furnizor: <strong>{supplierName}</strong></>}
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <th className="px-4 py-3">Cod</th>
                  <th className="px-4 py-3">Denumire</th>
                  <th className="px-4 py-3">Acțiune</th>
                  <th className="px-4 py-3 text-right">Stoc nou</th>
                  <th className="px-4 py-3 text-right">Preț achiziție</th>
                  <th className="px-4 py-3 text-right">Adaos %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.action === "updated" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.action === "updated" ? "Actualizat" : "Creat"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{r.newStock}</td>
                    <td className="px-4 py-3 text-right">{r.buyPrice.toFixed(2)} RON</td>
                    <td className="px-4 py-3 text-right">{r.marginPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={reset} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            ← Recepție nouă
          </button>
        </>
      )}
      {/* ═══════ HISTORY ═══════ */}
      {mode === "choose" && step === "input" && warehouseId && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Ultimele recepții</h2>

          {historyLoading && !history.length ? (
            <p className="text-sm text-slate-500 py-4 text-center">Se încarcă…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Nicio recepție înregistrată.</p>
          ) : (
            <>
              {history.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <button
                    onClick={() => toggleReceiptDetail(r.id)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          r.source === "pdf" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                        }`}>
                          {r.source === "pdf" ? "PDF" : "Manual"}
                        </span>
                        <span className="font-semibold text-slate-900 truncate text-sm">
                          {r.document_number || "Fără nr."}
                        </span>
                        {r.supplier_name && (
                          <span className="text-xs text-slate-700 truncate">— {r.supplier_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="text-xs text-slate-800 font-medium">
                          {r.items_count} prod. · {Number(r.total_value).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {new Date(r.created_at).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 text-slate-600 transition-transform ${expandedReceiptId === r.id ? "rotate-180" : ""}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {expandedReceiptId === r.id && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                      {receiptItemsLoading ? (
                        <p className="text-xs text-slate-500">Se încarcă…</p>
                      ) : receiptItems.length ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                              <th className="pb-1 pr-3">Cod</th>
                              <th className="pb-1 pr-3">Denumire</th>
                              <th className="pb-1 pr-3">Acțiune</th>
                              <th className="pb-1 pr-3 text-right">Cant.</th>
                              <th className="pb-1 text-right">Preț</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {receiptItems.map((item) => (
                              <tr key={item.id}>
                                <td className="py-1.5 pr-3 font-mono text-slate-900">{item.code}</td>
                                <td className="py-1.5 pr-3 text-slate-900">{item.name}</td>
                                <td className="py-1.5 pr-3">
                                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.action === "updated" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                    {item.action === "updated" ? "Actualizat" : "Creat"}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3 text-right text-slate-900">{Number(item.quantity)}</td>
                                <td className="py-1.5 text-right text-slate-900 font-medium">{Number(item.buy_price).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-slate-500">Niciun produs.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {historyHasMore && (
                <button
                  onClick={() => setHistoryLimit((l) => l + 10)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Arată mai multe…
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
