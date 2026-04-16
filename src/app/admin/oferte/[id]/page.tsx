"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import CustomerSearch, { CustomerDTO } from "@/components/admin/CustomerSearch";
import ProductAutocomplete, {
  ProductDTO,
} from "@/components/admin/ProductAutocomplete";
import OfferDownloadButton from "@/components/admin/OfferDownloadButton";

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
};

type OfferItemUI = {
  /** local UI key */
  uiId: number;

  /** offer_item.id from DB (uuid). Null for newly added rows until saved. */
  offerItemId: string | null;

  productId?: string;
  name: string;
  qty: number;

  /** numeric unit net price used for totals/payload */
  price: number;

  /** base/catalog unit net price used for +/-50% rule */
  basePrice?: number;

  /** what user typed (string), so we don't snap while typing */
  priceDraft?: string;

  /** validation message (null if ok) */
  priceError?: string | null;

  tax: number;
};

type VehicleState = {
  id?: string;
  chassis_vin: string;
  plate_no: string;
  make: string;
  model: string;
  series: string;
  engine_code: string;
  year: number;
};

export default function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: offerId } = use(params);

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [vehicle, setVehicle] = useState<VehicleState>({
    id: "",
    chassis_vin: "",
    plate_no: "",
    make: "",
    model: "",
    series: "",
    engine_code: "",
    year: new Date().getFullYear(),
  });

  const [items, setItems] = useState<OfferItemUI[]>([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");

  // TVA: include for INDIVIDUAL, exclude for COMPANY
  const isIndividualKind = (k: any) => {
    const v = String(k ?? "").toLowerCase();
    return (
      v === "individual" ||
      v === "person" ||
      v === "private" ||
      v === "ind" ||
      v === "pf"
    );
  };

  const isCompanyKind = (k: any) => {
    const v = String(k ?? "").toLowerCase();
    return v === "company" || v === "business" || v === "srl" || v === "sr";
  };

  // Default to including TVA if kind is missing/unknown
  const includeVat = (() => {
    const k = (customer as any)?.kind;
    if (!k) return true;
    if (isCompanyKind(k)) return false;
    if (isIndividualKind(k)) return true;
    return true;
  })();

  // ÎNCĂRCARE DATE
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/admin/offers/${offerId}`);
        const json = await res.json();

        if (!json.ok) {
          alert("Oferta nu a fost găsită.");
          router.push("/admin/oferte");
          return;
        }

        const d = json.data;
        setCustomer(d.customer);

        // Populam vehiculul
        // Luam ID-ul prioritar din d.vehicle_id, apoi din obiect
        const vData = d.vehicle || {};
        setVehicle({
          id: d.vehicle_id || vData.id || "",
          chassis_vin: vData.chassis_vin || vData.vin || "",
          plate_no: vData.plate_no || vData.plate_number || "",
          make: vData.make || vData.brand || "",
          model: vData.model || "",
          series: vData.series || "",
          engine_code: vData.engine_code || "",
          year: vData.year || new Date().getFullYear(),
        });

        // Mapam items
        setItems(
          d.items.map((i: any) => {
            const price = Number(i.price);
            const basePrice = Number.isFinite(Number(i.base_price))
              ? Number(i.base_price)
              : Number.isFinite(price)
                ? price
                : 0;

            const numericPrice = Number.isFinite(price) ? price : 0;

            return {
              ...i,
              offerItemId: i.id ? String(i.id) : null,
              uiId: Date.now() + Math.random(),
              price: numericPrice,
              basePrice,
              priceDraft: Number.isFinite(numericPrice)
                ? numericPrice.toFixed(2)
                : "0.00",
              priceError: null,
              qty: Number(i.quantity || i.qty),
              tax: Number(i.tax || i.tax_percentage),
            };
          }),
        );

        setNotes(d.notes || "");

        if (d.validUntil || d.valid_until) {
          const dateObj = new Date(d.validUntil || d.valid_until);
          setValidUntil(dateObj.toISOString().split("T")[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setFetching(false);
      }
    }
    loadData();
  }, [offerId, router]);

  // Load warehouses on mount so picker is ready when modal opens
  useEffect(() => {
    fetch("/api/admin/warehouses", { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && Array.isArray(d.items)) {
          const active = d.items.filter((w: any) => w.is_active);
          setWarehouses(active);
          if (active.length > 0) setOrderWarehouseId(active[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // CALCULE
  const totalNet = items.reduce(
    (acc, i) => acc + Number(i.qty || 0) * Number(i.price || 0),
    0,
  );

  const totalTax = includeVat
    ? items.reduce(
        (acc, i) =>
          acc +
          Number(i.qty || 0) *
            Number(i.price || 0) *
            (Number(i.tax || 0) / 100),
        0,
      )
    : 0;

  const totalGross = totalNet + totalTax;

  // ACTIUNI TABEL
  const addItem = () =>
    setItems([
      ...items,
      {
        uiId: Date.now(),
        offerItemId: null,
        name: "",
        qty: 1,
        price: 0,
        basePrice: undefined,
        priceDraft: "0.00",
        priceError: null,
        tax: 19,
      },
    ]);

  const removeItem = (uiId: number) =>
    setItems(items.filter((i) => i.uiId !== uiId));

  const updateQty = (uiId: number, qty: number) =>
    setItems(items.map((i) => (i.uiId === uiId ? { ...i, qty } : i)));

  const updatePriceDraft = (uiId: number, draft: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.uiId !== uiId) return i;

        const d = String(draft ?? "");
        const normalized = d.trim().replace(/\s+/g, "").replace(",", ".");

        if (normalized === "") {
          return { ...i, priceDraft: d, priceError: "Preț obligatoriu." };
        }

        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) {
          return { ...i, priceDraft: d, priceError: "Format preț invalid." };
        }

        const base = Number(i.basePrice ?? 0);
        let err: string | null = null;

        if (Number.isFinite(base) && base > 0) {
          const min = base * 0.5;
          const max = base * 1.5;
          if (parsed < min || parsed > max) {
            err = `Prețul trebuie să fie între ${min.toFixed(2)} și ${max.toFixed(
              2,
            )} (bază ${base.toFixed(2)}).`;
          }
        }

        // Keep numeric price in sync, but DO NOT clamp/snap
        return { ...i, priceDraft: d, price: parsed, priceError: err };
      }),
    );
  };

  const handleProductSelect = (uiId: number, product: ProductDTO) => {
    setItems(
      items.map((i) =>
        i.uiId === uiId
          ? {
              ...i,
              productId: product.id,
              name: product.name,
              // reset both the editable price and baseline to the catalog price
              price: Number(product.price),
              basePrice: Number(product.price),
              priceDraft: Number.isFinite(Number(product.price))
                ? Number(product.price).toFixed(2)
                : "0.00",
              priceError: null,
              tax: Number(product.vat_percent),
            }
          : i,
      ),
    );
  };
  // --- OFFER -> ORDER (UI)
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderSelected, setOrderSelected] = useState<Record<string, boolean>>(
    {},
  );
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderWarehouseId, setOrderWarehouseId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<
    { id: string; code: string; name: string }[]
  >([]);

  const openOrderModal = () => {
    // default: select all existing offer items that exist in DB
    const initial: Record<string, boolean> = {};
    for (const it of items) {
      if (it.offerItemId) initial[it.offerItemId] = true;
    }
    setOrderSelected(initial);
    setOrderModalOpen(true);
  };

  const toggleAllOrderItems = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const it of items) {
      if (it.offerItemId) next[it.offerItemId] = checked;
    }
    setOrderSelected(next);
  };

  const createOrderFromOffer = async () => {
    // Only allow DB-backed offer items
    const selectable = items.filter((x) => !!x.offerItemId);
    if (selectable.length === 0) {
      alert(
        "Oferta nu are încă rânduri salvate în DB. Salvează oferta înainte.",
      );
      return;
    }

    const itemIds = selectable
      .map((x) => x.offerItemId as string)
      .filter((id) => orderSelected[id]);

    if (itemIds.length === 0) {
      alert("Selectează cel puțin un rând pentru comandă.");
      return;
    }

    setCreatingOrder(true);
    try {
      const res = await fetch(`/api/admin/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: offerId,
          item_ids: itemIds,
          warehouse_id: orderWarehouseId || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Eroare la crearea comenzii.");
      }

      const newId =
        json?.id ||
        json?.order_id ||
        json?.data?.id ||
        json?.data?.order_id ||
        json?.order?.id;
      alert("Comanda a fost creată.");
      setOrderModalOpen(false);

      // Redirect: try common paths
      if (newId) {
        router.push(`/admin/comenzi/${newId}`);
      } else {
        router.push(`/admin/comenzi`);
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Eroare la crearea comenzii.");
    } finally {
      setCreatingOrder(false);
    }
  };

  // --- LOGICA DE UPDATE (PUT) ---
  async function handleUpdate() {
    if (!customer?.id) return alert("Selectează un client!");
    const badPrice = items.find((i) => i.priceError);
    if (badPrice) {
      return alert(
        "Există rânduri cu preț invalid (în afara intervalului permis sau format greșit).",
      );
    }

    setLoading(true);

    try {
      // 1. Curățăm lista de produse
      const cleanItems = items.map((i) => ({
        productId: i.productId || null,
        name: i.name,
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
        tax: includeVat ? Number(i.tax) || 0 : 0,
      }));

      // 2. Construim payload-ul
      // IMPORTANTA MAXIMA: Trimitem obiectul "vehicle" complet pentru a permite editarea/crearea
      const payload = {
        customerId: customer.id,
        vehicleId: vehicle.id,
        vehicle: vehicle, // <--- AICI TRIMITEM DATELE MODIFICATE ALE VEHICULULUI
        notes: notes,
        validUntil: validUntil,
        items: cleanItems,
      };

      // 3. Trimitem Request
      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.ok) throw new Error(json.error || "Eroare la actualizare");

      alert("Oferta a fost salvată!");
      // Dacă API-ul ne întoarce un nou ID de vehicul (pentru că a fost creat unul nou), îl actualizăm
      if (json.data?.vehicle_id) {
        setVehicle((prev) => ({ ...prev, id: json.data.vehicle_id }));
      }

      router.push("/admin/oferte");
    } catch (error: any) {
      console.error("Update Error:", error);
      alert(`Eroare: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (fetching)
    return (
      <div className="p-10 text-center text-slate-500">
        Se încarcă oferta...
      </div>
    );

  return (
    <div className="w-full pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Editare Ofertă
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Modifică detaliile ofertei #{offerId.slice(0, 8)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openOrderModal}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            type="button"
          >
            Creează comandă
          </button>
          <OfferDownloadButton offerId={offerId} />
        </div>
      </div>

      {/* Grid Client / Vehicul */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* CARD CLIENT */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icons.User />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Client</h2>
          </div>
          {customer && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="font-semibold text-emerald-900 text-sm">
                {customer.display_name}
              </div>
              <div className="text-xs text-emerald-700">
                {customer.kind === "company"
                  ? `CUI: ${customer.vat_id}`
                  : `Tel: ${customer.phone}`}
              </div>
            </div>
          )}
        </div>

        {/* CARD VEHICUL - ACUM EDITABIL */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Icons.Car />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Vehicul</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <input
                className={`${inputBase} font-mono uppercase`}
                value={vehicle.chassis_vin || ""}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    chassis_vin: e.target.value.toUpperCase(),
                  })
                }
                placeholder="VIN / Serie șasiu (chassis_vin)"
              />
            </div>

            <div className="col-span-1">
              <input
                className={`${inputBase} uppercase`}
                value={vehicle.plate_no || ""}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    plate_no: e.target.value.toUpperCase(),
                  })
                }
                placeholder="Nr. înmatriculare (plate_no)"
              />
            </div>

            <div className="col-span-1">
              <input
                type="number"
                className={inputBase}
                value={vehicle.year}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    year: Number(e.target.value || new Date().getFullYear()),
                  })
                }
                placeholder="An"
              />
            </div>

            <div className="col-span-1">
              <input
                className={inputBase}
                value={vehicle.make || ""}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    make: e.target.value,
                  })
                }
                placeholder="Marcă (make)"
              />
            </div>

            <div className="col-span-1">
              <input
                className={inputBase}
                value={vehicle.model || ""}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    model: e.target.value,
                  })
                }
                placeholder="Model"
              />
            </div>

            <div className="col-span-1">
              <input
                className={inputBase}
                value={vehicle.series || ""}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    series: e.target.value,
                  })
                }
                placeholder="Serie / versiune (series)"
              />
            </div>

            <div className="col-span-1">
              <input
                className={inputBase}
                value={vehicle.engine_code || ""}
                onChange={(e) =>
                  setVehicle({
                    ...vehicle,
                    engine_code: e.target.value,
                  })
                }
                placeholder="Cod motor (engine_code)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABEL PRODUSE */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table
          className="w-full text-left text-sm"
          style={{ borderCollapse: "separate", borderSpacing: 0 }}
        >
          <thead className="bg-slate-50">
            <tr>
              <th className={tableHeader}>Produs</th>
              <th className={`${tableHeader} w-24 text-center`}>Cant.</th>
              <th className={`${tableHeader} w-32 text-right`}>Preț</th>
              <th className={`${tableHeader} w-24 text-center`}>TVA %</th>
              <th className={`${tableHeader} w-32 text-right`}>
                {includeVat ? "Total Brut" : "Total"}
              </th>
              <th className={`${tableHeader} w-10`}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              // Calcule sigure per rând
              const rowQty = Number(item.qty) || 0;
              const rowPrice = Number(item.price) || 0;
              const rowTax = Number(item.tax) || 0;
              const rowTotal =
                rowQty * rowPrice * (includeVat ? 1 + rowTax / 100 : 1);

              return (
                <tr
                  key={item.uiId}
                  className="group hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2 border-t border-slate-200 relative">
                    <ProductAutocomplete
                      onSelect={(p) => handleProductSelect(item.uiId, p)}
                      placeholder={item.name || "Caută produs..."}
                    />
                  </td>
                  <td className="px-4 py-2 border-t border-slate-200">
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center outline-none"
                      value={item.qty}
                      onChange={(e) =>
                        updateQty(item.uiId, Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-4 py-2 border-t border-slate-200">
                    {(() => {
                      const base = Number(item.basePrice ?? rowPrice ?? 0);
                      const hasBase = Number.isFinite(base) && base > 0;
                      const min = hasBase ? base * 0.5 : 0;
                      const max = hasBase ? base * 1.5 : undefined;

                      return (
                        <div className="flex flex-col items-end gap-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            className={
                              "w-full rounded-lg border bg-white px-2 py-1.5 text-right text-slate-950 placeholder:text-slate-500 outline-none focus:border-[#feab1f] focus:ring-2 focus:ring-[#feab1f]/25 " +
                              (item.priceError
                                ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                                : "border-slate-300")
                            }
                            value={
                              item.priceDraft ??
                              (Number.isFinite(Number(rowPrice))
                                ? Number(rowPrice).toFixed(2)
                                : "")
                            }
                            onChange={(e) =>
                              updatePriceDraft(item.uiId, e.target.value)
                            }
                            placeholder="0.00"
                          />
                          {hasBase ? (
                            <div className="text-[11px] text-slate-500">
                              Permis: {min.toFixed(2)} –{" "}
                              {(max as number).toFixed(2)} (bază{" "}
                              {base.toFixed(2)})
                            </div>
                          ) : null}
                          {item.priceError ? (
                            <div className="text-[11px] text-red-600">
                              {item.priceError}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2 border-t border-slate-200 text-center text-slate-500">
                    {includeVat ? rowTax : 0}%
                  </td>
                  <td className="px-4 py-2 text-right font-semibold border-t border-slate-200">
                    {rowTotal.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-center border-t border-slate-200">
                    <button
                      onClick={() => removeItem(item.uiId)}
                      className="invisible group-hover:visible text-red-500 hover:bg-red-50 p-1 rounded"
                    >
                      <Icons.Trash />
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={6} className="px-4 py-3 border-t border-slate-200">
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Icons.Plus /> Adaugă rând
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="w-full space-y-4 md:w-1/2">
          <label className="block text-sm font-medium text-slate-700">
            Observații
          </label>
          <textarea
            className={`${inputBase} h-32`}
            placeholder="Observații interne sau pentru client..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <label className="block text-sm font-medium text-slate-700 mt-4">
            Valabilă până la
          </label>
          <input
            type="date"
            className={inputBase}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 md:w-96">
          <div className="space-y-2 mb-4 border-b border-slate-100 pb-4">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Total Net:</span>
              <span>{totalNet.toFixed(2)} RON</span>
            </div>

            <div className="flex justify-between text-sm text-slate-600">
              <span>TVA:</span>
              <span
                className={includeVat ? "text-emerald-700" : "text-slate-500"}
              >
                {includeVat ? "Inclus" : "Exclus"}
              </span>
            </div>

            <div className="flex justify-between text-sm text-slate-600">
              <span>Total TVA:</span>
              <span>{(includeVat ? totalTax : 0).toFixed(2)} RON</span>
            </div>
          </div>
          <div className="flex justify-between items-end mb-6">
            <span className="text-sm font-bold uppercase text-slate-500">
              Total General
            </span>
            <span className="text-2xl font-bold text-slate-900">
              {totalGross.toFixed(2)} Lei
            </span>
          </div>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white transition-colors
                ${
                  loading
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-slate-900 hover:bg-slate-800"
                }
            `}
          >
            {loading ? "Se salvează..." : <>Salvează Modificări</>}
          </button>
        </div>
      </div>
      {/* --- ORDER MODAL --- */}
      {orderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Creează comandă din ofertă
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Selectează rândurile care intră în comandă. (Doar rândurile
                  deja salvate în DB sunt disponibile.)
                </div>
              </div>
              <button
                onClick={() => setOrderModalOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                type="button"
              >
                Închide
              </button>
            </div>

            <div className="px-5 py-4">
              {/* Warehouse picker */}
              {warehouses.length > 0 && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 10l9-7 9 7v11H3V10z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 20V14h6v6"
                    />
                  </svg>
                  <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                    Depozit expediere:
                  </label>
                  <select
                    value={orderWarehouseId}
                    onChange={(e) => setOrderWarehouseId(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#feab1f]"
                  >
                    <option value="">— Fără depozit (alocare manuală) —</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={(() => {
                      const ids = items
                        .filter((x) => !!x.offerItemId)
                        .map((x) => x.offerItemId as string);
                      if (ids.length === 0) return false;
                      return ids.every((id) => !!orderSelected[id]);
                    })()}
                    onChange={(e) => toggleAllOrderItems(e.target.checked)}
                  />
                  Selectează toate
                </label>
                <div className="text-xs text-slate-500">
                  Selectate:{" "}
                  {
                    items
                      .filter((x) => !!x.offerItemId)
                      .map((x) => x.offerItemId as string)
                      .filter((id) => !!orderSelected[id]).length
                  }
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-700 w-10"></th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-700">
                        Produs
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-700 w-24 text-center">
                        Cant.
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-700 w-28 text-right">
                        Preț
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter((x) => !!x.offerItemId).length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-4 text-sm text-slate-600"
                        >
                          Nu există rânduri salvate în DB pentru această ofertă.
                        </td>
                      </tr>
                    ) : (
                      items
                        .filter((x) => !!x.offerItemId)
                        .map((it) => {
                          const id = it.offerItemId as string;
                          return (
                            <tr key={id} className="border-t border-slate-200">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={!!orderSelected[id]}
                                  onChange={(e) =>
                                    setOrderSelected((prev) => ({
                                      ...prev,
                                      [id]: e.target.checked,
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">
                                  {it.name || "—"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {it.productId ?? ""}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-700">
                                {Number(it.qty || 0)}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-700">
                                {Number(it.price || 0).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                onClick={() => setOrderModalOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                type="button"
                disabled={creatingOrder}
              >
                Renunță
              </button>
              <button
                onClick={createOrderFromOffer}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:bg-slate-400"
                type="button"
                disabled={creatingOrder}
              >
                {creatingOrder ? "Se creează..." : "Creează comandă"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
