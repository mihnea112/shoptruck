"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerSearch, { CustomerDTO } from "@/components/admin/CustomerSearch";
import ProductAutocomplete, {
  ProductDTO,
} from "@/components/admin/ProductAutocomplete"; // Import nou

// --- STYLE & ICONS ---
const inputBase =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 " +
  "placeholder:text-slate-500 caret-slate-950 outline-none transition-colors " +
  "focus:border-[#feab1f] focus:ring-2 focus:ring-[#feab1f]/25";

const tableHeader =
  "px-4 py-3 font-semibold text-slate-700 bg-slate-50 text-xs uppercase tracking-wide";

const Icons = {
  User: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  Car: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
      />
    </svg>
  ),
  Plus: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  ),
  Trash: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  Check: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
  Search: () => (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  ),
};

type OfferItemUI = {
  id: number;
  productId?: string; // ID-ul produsului din DB
  name: string;
  qty: number;
  /** current editable unit net price */
  price: number;
  /** base/catalog unit net price used for +/-50% validation */
  basePrice?: number;
  tax: number;
};

export default function NewOfferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);

  // Stare
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  // TVA is shown/included for INDIVIDUAL customers, excluded for others (e.g. COMPANY)
  const [vatEnabled, setVatEnabled] = useState(true);

  useEffect(() => {
    const k = String((customer as any)?.kind ?? "").toLowerCase();
    // support: "individual" / "INDIVIDUAL" and potential variants
    const isIndividual =
      k === "individual" || k === "person" || k === "private";
    setVatEnabled(isIndividual);
  }, [customer]);
  const [vehicle, setVehicle] = useState({
    chassis_vin: "",
    plate_no: "",
    make: "",
    model: "",
    series: "",
    engine_code: "",
    year: new Date().getFullYear(),
  });

  // Rândul inițial
  const [items, setItems] = useState<OfferItemUI[]>([
    { id: Date.now(), name: "", qty: 1, price: 0, tax: 19 }, // Tax default 19, dar va fi suprascris de produs
  ]);
  const [priceErrors, setPriceErrors] = useState<Record<number, string | null>>(
    {},
  );

  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );

  // Logică Vehicle Lookup
  async function lookupVehicle(query: string) {
    if (!query || query.length < 3) return;
    setVehicleLoading(true);
    try {
      const res = await fetch(
        `/api/admin/vehicles/search?q=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      if (data.ok && data.vehicle) {
        setVehicle((prev) => {
          const v = data.vehicle || {};

          const chassis_vin = (v.chassis_vin ??
            v.vin ??
            prev.chassis_vin) as string;
          const plate_no = (v.plate_no ??
            v.plate_number ??
            prev.plate_no) as string;
          const make = (v.make ?? v.brand ?? prev.make) as string;
          const model = (v.model ?? prev.model) as string;
          const series = (v.series ?? prev.series) as string;
          const engine_code = (v.engine_code ??
            v.motor_code ??
            prev.engine_code) as string;
          const year =
            v.year != null && v.year !== "" ? Number(v.year) : prev.year;

          return {
            ...prev,
            chassis_vin: String(chassis_vin || "").toUpperCase(),
            plate_no: String(plate_no || "").toUpperCase(),
            make: String(make || ""),
            model: String(model || ""),
            series: String(series || ""),
            engine_code: String(engine_code || ""),
            year: Number.isFinite(year) ? year : prev.year,
          };
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setVehicleLoading(false);
    }
  }

  const updatePrice = (id: number, raw: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const next = Number(raw);
        if (!Number.isFinite(next)) return i;
        // Allow any non-negative number while typing; we validate separately.
        return { ...i, price: next };
      }),
    );

    // Clear error while typing; re-check happens on blur/save.
    setPriceErrors((prev) => ({ ...prev, [id]: null }));
  };

  const validatePrice = (id: number) => {
    const it = items.find((x) => x.id === id);
    if (!it) return true;

    const price = Number(it.price);
    if (!Number.isFinite(price) || price < 0) {
      setPriceErrors((prev) => ({ ...prev, [id]: "Preț invalid." }));
      return false;
    }

    const base = Number(it.basePrice ?? 0);
    // If there is no meaningful base price, allow any non-negative value.
    if (!Number.isFinite(base) || base <= 0) {
      setPriceErrors((prev) => ({ ...prev, [id]: null }));
      return true;
    }

    const min = base * 0.5;
    const max = base * 1.5;
    if (price < min || price > max) {
      setPriceErrors((prev) => ({
        ...prev,
        [id]: `Prețul trebuie să fie între ${min.toFixed(2)} și ${max.toFixed(2)} (bază ${base.toFixed(2)}).`,
      }));
      return false;
    }

    setPriceErrors((prev) => ({ ...prev, [id]: null }));
    return true;
  };

  // --- CALCULE ---
  const totalNet = items.reduce((acc, i) => acc + i.qty * i.price, 0);
  const totalTax = vatEnabled
    ? items.reduce((acc, i) => acc + i.qty * i.price * (i.tax / 100), 0)
    : 0;
  const totalGross = totalNet + totalTax;

  // --- ACTIUNI TABEL ---
  const addItem = () => {
    const newId = Date.now();
    setItems([...items, { id: newId, name: "", qty: 1, price: 0, tax: 19 }]);
    setPriceErrors((prev) => ({ ...prev, [newId]: null }));
  };

  const removeItem = (id: number) => {
    setItems(items.filter((i) => i.id !== id));
    setPriceErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateQty = (id: number, qty: number) => {
    setItems(items.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  // Când selectăm un produs din DB
  const handleProductSelect = (id: number, product: ProductDTO) => {
    const catalogPrice = Number(product.price);
    const p = Number.isFinite(catalogPrice) ? catalogPrice : 0;

    setItems(
      items.map((i) =>
        i.id === id
          ? {
              ...i,
              productId: product.id,
              name: product.name,
              price: p,
              basePrice: p,
              tax: Number(product.vat_percent),
            }
          : i,
      ),
    );

    setPriceErrors((prev) => ({ ...prev, [id]: null }));
  };

  async function handleSave() {
    const accountId =
      (customer as any)?.id ??
      (customer as any)?.account_id ??
      (customer as any)?.accountId ??
      "";

    if (!accountId) {
      console.log("[offer][create] missing accountId; customer=", customer);
      return alert("Selectează un client!");
    }
    if (!vehicle.make) return alert("Completează marca vehiculului!");
    if (!vehicle.model) return alert("Completează modelul vehiculului!");
    if (!vehicle.chassis_vin) return alert("Completează VIN (șasiu)!");

    // Verificăm dacă toate liniile au produse selectate din DB
    const invalidItem = items.find((i) => !i.productId || !i.name);
    if (invalidItem)
      return alert(
        "Toate rândurile trebuie să fie produse valide din baza de date.",
      );

    // Validate price ranges (+/-50% from base/catalog price) for all items
    const badIds: number[] = [];
    for (const it of items) {
      const ok = validatePrice(it.id);
      if (!ok) badIds.push(it.id);
    }
    if (badIds.length > 0) {
      return alert(
        "Există prețuri în afara intervalului permis. Verifică liniile marcate cu roșu.",
      );
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          vehicle,
          items: items.map((i) => ({
            ...i,
            // For B2B (non-individual), we exclude TVA at document level.
            tax: vatEnabled ? i.tax : 0,
          })),
          notes,
          validUntil,
        }),
      });
      const data = await response.json();
      if (data.ok) {
        alert("Ofertă salvată!");
        router.push("/admin/oferte");
      } else {
        alert("Eroare: " + data.error);
      }
    } catch (e) {
      alert("Eroare de conexiune.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Ofertă Nouă</h1>
          <p className="mt-2 text-sm text-slate-600">
            Produsele se selectează automat din catalog.
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Serie Document
          </div>
          <div className="font-mono text-lg font-bold text-slate-700">
            OF (Auto)
          </div>
        </div>
      </div>

      {/* Grid Client / Vehicul (Neschimbat major, doar stilizat) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD CLIENT */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icons.User />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">
              Date Client
            </h2>
          </div>
          <div className="flex-1">
            <CustomerSearch onSelect={setCustomer} />
            {customer ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-emerald-900 text-sm">
                      {customer.display_name}
                    </div>
                    <div className="mt-1 text-xs text-emerald-700">
                      {customer.kind === "company"
                        ? `CUI: ${customer.vat_id}`
                        : `Tel: ${customer.phone}`}
                    </div>
                  </div>
                  <div className="text-emerald-600">
                    <Icons.Check />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                Niciun client selectat
              </div>
            )}
          </div>
        </div>

        {/* CARD VEHICUL */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icons.Car />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Date Vehicul
              </h2>
            </div>
            {vehicleLoading && (
              <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-500">
                <Icons.Search />
                <span>Caut...</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                VIN (șasiu)
              </label>
              <input
                className={`${inputBase} font-mono uppercase`}
                placeholder="ex: WAUZZZ..."
                value={vehicle.chassis_vin}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    chassis_vin: e.target.value.toUpperCase(),
                  })
                }
                onBlur={(e) => lookupVehicle(e.target.value)}
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Nr. înmatriculare
              </label>
              <input
                className={`${inputBase} uppercase`}
                placeholder="ex: B 123 ABC"
                value={vehicle.plate_no}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    plate_no: e.target.value.toUpperCase(),
                  })
                }
                onBlur={(e) => lookupVehicle(e.target.value)}
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                An
              </label>
              <input
                type="number"
                className={inputBase}
                value={vehicle.year}
                onChange={(e) =>
                  setVehicle({ ...vehicle, year: Number(e.target.value) })
                }
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Marcă
              </label>
              <input
                type="text"
                className={inputBase}
                value={vehicle.make}
                onChange={(e) =>
                  setVehicle({ ...vehicle, make: e.target.value })
                }
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Model
              </label>
              <input
                type="text"
                className={inputBase}
                value={vehicle.model}
                onChange={(e) =>
                  setVehicle({ ...vehicle, model: e.target.value })
                }
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Serie (opțional)
              </label>
              <input
                type="text"
                className={inputBase}
                value={vehicle.series}
                onChange={(e) =>
                  setVehicle({ ...vehicle, series: e.target.value })
                }
              />
            </div>

            <div className="col-span-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Cod motor (opțional)
              </label>
              <input
                type="text"
                className={`${inputBase} uppercase`}
                value={vehicle.engine_code}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    engine_code: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* LISTA PRODUSE - ACTUALIZATA */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">
            Articole și Manoperă
          </div>
        </div>

        <table
          className="w-full text-left text-sm"
          style={{ borderCollapse: "separate", borderSpacing: 0 }}
        >
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeader}>Produs (Căutare)</th>
              <th className={`${tableHeader} w-24 text-center`}>Cant.</th>
              <th className={`${tableHeader} w-32 text-right`}>Preț (RON)</th>
              <th className={`${tableHeader} w-24 text-center`}>TVA %</th>
              <th className={`${tableHeader} w-32 text-right`}>Total</th>
              <th className={`${tableHeader} w-10`}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="group hover:bg-slate-50 transition-colors"
              >
                <td className="px-4 py-2 border-t border-slate-200 relative z-10">
                  {/* FOLOSIM AUTOCOMPLETE AICI */}
                  <ProductAutocomplete
                    onSelect={(p) => handleProductSelect(item.id, p)}
                    placeholder="Caută piesă sau serviciu..."
                  />
                  {/* Dacă e selectat, arătăm un mic text sub input (opțional, dar input-ul din componenta se updateaza deja) */}
                </td>

                <td className="px-4 py-2 border-t border-slate-200">
                  {/* DOAR CANTITATEA E EDITABILA */}
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-slate-950 placeholder:text-slate-500 outline-none focus:border-[#feab1f] focus:ring-2 focus:ring-[#feab1f]/25"
                    value={item.qty}
                    onChange={(e) => updateQty(item.id, Number(e.target.value))}
                  />
                </td>

                <td className="px-4 py-2 border-t border-slate-200">
                  {(() => {
                    const base = Number(item.basePrice ?? 0);
                    const hasBase = Number.isFinite(base) && base > 0;
                    const min = hasBase ? base * 0.5 : 0;
                    const max = hasBase ? base * 1.5 : undefined;
                    const err = priceErrors[item.id];

                    return (
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="number"
                          step="0.01"
                          className={
                            "w-full rounded-lg border bg-white px-2 py-1.5 text-right text-slate-950 placeholder:text-slate-500 outline-none focus:border-[#feab1f] focus:ring-2 focus:ring-[#feab1f]/25 " +
                            (err ? "border-red-400" : "border-slate-300")
                          }
                          value={
                            Number.isFinite(Number(item.price))
                              ? Number(item.price)
                              : 0
                          }
                          onChange={(e) =>
                            updatePrice(item.id, Number(e.target.value))
                          }
                          onBlur={() => validatePrice(item.id)}
                        />
                        {err ? (
                          <div className="text-[11px] text-red-600 text-right">
                            {err}
                          </div>
                        ) : hasBase ? (
                          <div className="text-[11px] text-slate-500 text-right">
                            Permis: {min.toFixed(2)} –{" "}
                            {(max as number).toFixed(2)} (bază {base.toFixed(2)}
                            )
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 text-right">
                            Preț liber (nu există preț de bază)
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>

                <td className="px-4 py-2 border-t border-slate-200">
                  {/* TVA READ-ONLY */}
                  <input
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-slate-800 cursor-not-allowed"
                    value={(vatEnabled ? item.tax : 0) + "%"}
                  />
                </td>

                <td className="px-4 py-2 text-right font-semibold text-slate-900 border-t border-slate-200">
                  {(
                    item.qty *
                    item.price *
                    (1 + (vatEnabled ? item.tax : 0) / 100)
                  ).toFixed(2)}
                </td>

                <td className="px-2 py-2 text-center border-t border-slate-200">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="invisible group-hover:visible text-slate-400 hover:text-red-600 transition"
                  >
                    <Icons.Trash />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={6} className="px-4 py-3 border-t border-slate-200">
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Icons.Plus /> Adaugă rând
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* FOOTER TOTALS */}
      <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="w-full space-y-4 md:w-1/2">
          <textarea
            className={`${inputBase} h-32 text-slate-950`}
            placeholder="Observații..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex items-center gap-4">
            <label className="text-xs font-semibold text-slate-500">
              Valabilitate:
            </label>
            <input
              type="date"
              className={inputBase}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:w-96">
          <div className="p-6">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">TVA:</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold ${vatEnabled ? "text-emerald-700" : "text-slate-600"}`}
                >
                  {vatEnabled ? "Inclus" : "Exclus"}
                </span>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-slate-900"
                    checked={vatEnabled}
                    readOnly
                    disabled
                    aria-label="TVA (automat în funcție de tipul clientului)"
                  />
                </label>
              </div>
            </div>
            <div className="mb-2 flex justify-between text-sm text-slate-500">
              <span>Total Net:</span>
              <span className="font-medium text-slate-900">
                {totalNet.toFixed(2)} Lei
              </span>
            </div>
            <div className="mb-4 flex justify-between text-sm text-slate-500">
              <span>Total TVA:</span>
              <span className="font-medium text-slate-900">
                {totalTax.toFixed(2)} Lei
              </span>
            </div>
            <div className="my-4 border-t border-slate-100"></div>
            <div className="flex justify-between items-end">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Total
              </span>
              <span className="text-2xl font-bold text-slate-900">
                {totalGross.toFixed(2)}{" "}
                <span className="text-sm font-normal text-slate-400">Lei</span>
              </span>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className={`w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {loading ? "Se salvează..." : "Salvează Oferta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
