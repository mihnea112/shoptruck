"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import WishlistClient from "@/app/dorinte/WishlistClient";

export default function AccountClient() {
  const [activeTab, setActiveTab] = useState<"profile" | "offers" | "orders" | "favorites">("profile");

  const tabs = [
    { key: "profile" as const, label: "Date profil" },
    { key: "offers" as const, label: "Ofertele mele" },
    { key: "orders" as const, label: "Comenzile mele" },
    { key: "favorites" as const, label: "Lista de dorințe" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Tabs */}
      <div className="flex gap-2 sm:gap-4 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm transition whitespace-nowrap ${
              activeTab === t.key
                ? "text-amber-600 border-b-2 border-amber-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "profile" ? (
        <ProfileForm />
      ) : activeTab === "offers" ? (
        <OffersSection />
      ) : activeTab === "orders" ? (
        <OrdersSection />
      ) : (
        <WishlistClient />
      )}
    </div>
  );
}

function ProfileForm() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    country: "România",
    kind: "" as string,
    companyName: "",
    legalName: "",
    taxId: "",
    regNo: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/user/profile");
        const data = await response.json();
        if (response.ok) {
          // Replace nulls with empty strings to avoid React warnings
          const clean: any = {};
          for (const [k, v] of Object.entries(data)) {
            clean[k] = v ?? "";
          }
          setFormData((prev) => ({ ...prev, ...clean }));
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Profil actualizat cu succes!" });
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la actualizare" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Eroare la salvare" });
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="rounded-lg border border-slate-300 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        <p className="mt-4 text-slate-600">Se încarcă datele...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 w-full">
      {message && (
        <div
          className={`rounded-lg p-3 sm:p-4 text-xs sm:text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
            Prenume
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
            placeholder="Ex: Ion"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
            Nume
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
            placeholder="Ex: Popescu"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
            placeholder="Ex: ion@example.com"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
            Telefon
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
            placeholder="Ex: +40 123 456 789"
          />
        </div>
      </div>

      {formData.kind === "company" && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
                Nume firmă
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
                placeholder="Ex: SC Exemplu SRL"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
                Denumire legală
              </label>
              <input
                type="text"
                name="legalName"
                value={formData.legalName}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
                placeholder="Ex: SC Exemplu SRL"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
                CUI
              </label>
              <input
                type="text"
                name="taxId"
                value={formData.taxId}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
                placeholder="Ex: RO12345678"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
                Nr. Reg. Com.
              </label>
              <input
                type="text"
                name="regNo"
                value={formData.regNo}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
                placeholder="Ex: J35/128/1994"
              />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
          Adresă
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
          placeholder="Ex: Str. Principală 123"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-3">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
            Oraș
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
            placeholder="Ex: București"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
            Cod poștal
          </label>
          <input
            type="text"
            name="postalCode"
            value={formData.postalCode}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none transition"
            placeholder="Ex: 010000"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-900 mb-1 sm:mb-2">
            Țară
          </label>
          <select
            name="country"
            value={formData.country}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-900 focus:border-amber-600 focus:outline-none transition"
          >
            <option>România</option>
            <option>Bulgaria</option>
            <option>Serbia</option>
            <option>Ungaria</option>
            <option>Polonia</option>
            <option>Alte țări</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber-400 px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition"
      >
        {loading ? "Se salvează..." : "Salvează modificări"}
      </button>
    </form>
  );
}

/* ── Offers Section ───────────────────────────────────── */

type Offer = {
  id: string;
  status: string;
  createdAt: string;
  validUntil: string | null;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  accountName: string;
  vehicle: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Ciornă",
  SENT: "Trimisă",
  ACCEPTED: "Acceptată",
  REJECTED: "Respinsă",
  EXPIRED: "Expirată",
  ORDERED: "Comandată",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
  EXPIRED: "bg-amber-50 text-amber-700",
  ORDERED: "bg-purple-50 text-purple-700",
};

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function OfferDownloadBtn({ offerId }: { offerId: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/user/offers/${offerId}`);
      if (!res.ok) throw new Error("Eroare la descărcare");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Date invalide");

      const { pdf } = await import("@react-pdf/renderer");
      const { saveAs } = await import("file-saver");
      const { default: OfferPDF } = await import("@/components/admin/OfferPdfDocument");

      const blob = await pdf(<OfferPDF offer={json.data} />).toBlob();
      saveAs(blob, `Oferta-${offerId.slice(0, 6).toUpperCase()}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Nu s-a putut genera PDF-ul.");
    } finally {
      setDownloading(false);
    }
  }, [offerId]);

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
    >
      {downloading ? (
        <span>Se generează...</span>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PDF
        </>
      )}
    </button>
  );
}

function OffersSection() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/offers");
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Eroare");
        setOffers(data.items || []);
      } catch (e: any) {
        setError(e?.message || "Eroare la încărcare");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-300 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        <p className="mt-4 text-sm text-slate-600">Se încarcă ofertele...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 md:p-8 text-center">
        <div className="mb-3 sm:mb-4 text-3xl sm:text-4xl">📋</div>
        <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold text-slate-900">
          Nu ai nici o ofertă
        </h3>
        <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600">
          Ofertele generate de echipa noastră vor apărea aici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Data</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Vehicul</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Total (fără TVA)</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">TVA</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Valabilă până</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-900">Descarcă</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o, idx) => (
              <tr
                key={o.id}
                className={`border-b border-slate-200 transition hover:bg-slate-50 ${
                  idx === offers.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 text-slate-900">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[o.status] || "bg-slate-100 text-slate-700"}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{o.vehicle || "—"}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatRON(o.totalNet)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{formatRON(o.totalTax)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRON(o.totalGross)}</td>
                <td className="px-4 py-3 text-slate-700">
                  {o.validUntil ? formatDate(o.validUntil) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <OfferDownloadBtn offerId={o.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {offers.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-900">{formatDate(o.createdAt)}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[o.status] || "bg-slate-100 text-slate-700"}`}>
                {STATUS_LABELS[o.status] || o.status}
              </span>
            </div>
            {o.vehicle && (
              <p className="text-xs text-slate-600 mb-1">🚗 {o.vehicle}</p>
            )}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-600">Total</span>
              <span className="text-sm font-semibold text-slate-900">{formatRON(o.totalGross)}</span>
            </div>
            {o.validUntil && (
              <p className="text-xs text-slate-500 mt-1">Valabilă până: {formatDate(o.validUntil)}</p>
            )}
            <div className="mt-3 pt-2 border-t border-slate-100">
              <OfferDownloadBtn offerId={o.id} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
        {offers.length} ofert{offers.length !== 1 ? "e" : "ă"}
      </div>
    </div>
  );
}

/* ── Orders Section ───────────────────────────────────── */

type Order = {
  id: string;
  status: string;
  deliveryMethod: string;
  paymentMethod: string;
  paymentStatus: string | null;
  createdAt: string;
  totalNet: number;
  totalTax: number;
  totalGross: number;
  itemsCount: number;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PLACED: "Plasată",
  RESERVED: "Rezervată",
  SHIPPED: "Expediată",
  DELIVERED: "Livrată",
  CANCELLED: "Anulată",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  PLACED: "bg-blue-50 text-blue-700",
  RESERVED: "bg-amber-50 text-amber-700",
  SHIPPED: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Plătită",
  pending: "În așteptare",
  failed: "Eșuată",
  not_required: "—",
};

function OrderInvoiceBtn({ orderId }: { orderId: string }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      const res = await fetch(`/api/user/orders/${orderId}`);
      if (!res.ok) throw new Error("Eroare la descărcare");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Date invalide");

      const { pdf } = await import("@react-pdf/renderer");
      const { saveAs } = await import("file-saver");
      const { default: InvoicePDF } = await import("@/components/admin/InvoicePdfDocument");

      const blob = await pdf(<InvoicePDF data={json.data} />).toBlob();
      saveAs(blob, `Comanda-${orderId.slice(0, 6).toUpperCase()}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Nu s-a putut genera PDF-ul.");
    } finally {
      setDownloading(false);
    }
  }, [orderId]);

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
    >
      {downloading ? (
        <span>Se generează...</span>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PDF
        </>
      )}
    </button>
  );
}

function OrdersSection() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/orders");
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Eroare");
        setOrders(data.items || []);
      } catch (e: any) {
        setError(e?.message || "Eroare la încărcare");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-300 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        <p className="mt-4 text-sm text-slate-600">Se încarcă comenzile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 md:p-8 text-center">
        <div className="mb-3 sm:mb-4 text-3xl sm:text-4xl">📦</div>
        <h3 className="mb-1 sm:mb-2 text-base sm:text-lg font-semibold text-slate-900">
          Nu ai nici o comandă
        </h3>
        <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600">
          Explorează catalogul și plasează prima comandă
        </p>
        <Link
          href="/catalog"
          className="inline-block rounded-full bg-slate-900 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Mergi la catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Data</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Livrare</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900">Plată</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Produse</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-900">Total</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-900">Factură</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, idx) => (
              <tr
                key={o.id}
                className={`border-b border-slate-200 transition hover:bg-slate-50 ${
                  idx === orders.length - 1 ? "border-b-0" : ""
                }`}
              >
                <td className="px-4 py-3 text-slate-900">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_COLORS[o.status] || "bg-slate-100 text-slate-700"}`}>
                    {ORDER_STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700 text-xs">
                  {o.deliveryMethod === "pickup" ? "Ridicare" : "Curier"}
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="text-slate-700">
                    {o.paymentMethod === "card" ? "Card" : "Transfer"}
                  </span>
                  {o.paymentStatus && o.paymentStatus !== "not_required" && (
                    <span className={`ml-1 text-[10px] font-medium ${
                      o.paymentStatus === "paid" ? "text-emerald-600" :
                      o.paymentStatus === "pending" ? "text-amber-600" : "text-red-600"
                    }`}>
                      ({PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">{o.itemsCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatRON(o.totalGross)}</td>
                <td className="px-4 py-3 text-center">
                  <OrderInvoiceBtn orderId={o.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-900">{formatDate(o.createdAt)}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_COLORS[o.status] || "bg-slate-100 text-slate-700"}`}>
                {ORDER_STATUS_LABELS[o.status] || o.status}
              </span>
            </div>
            <div className="text-xs text-slate-600 mb-1">
              {o.deliveryMethod === "pickup" ? "Ridicare din depozit" : "Curier"} ·{" "}
              {o.paymentMethod === "card" ? "Card online" : "Transfer bancar"}
              {o.paymentStatus && o.paymentStatus !== "not_required" && (
                <span className={`ml-1 font-medium ${
                  o.paymentStatus === "paid" ? "text-emerald-600" :
                  o.paymentStatus === "pending" ? "text-amber-600" : "text-red-600"
                }`}>
                  ({PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus})
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mb-2">{o.itemsCount} produs{o.itemsCount !== 1 ? "e" : ""}</div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <span className="text-sm font-semibold text-slate-900">{formatRON(o.totalGross)}</span>
              <OrderInvoiceBtn orderId={o.id} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
        {orders.length} comand{orders.length !== 1 ? "e" : "ă"}
      </div>
    </div>
  );
}
