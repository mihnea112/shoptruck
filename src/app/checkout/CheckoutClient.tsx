"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function formatRON(n: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 0,
  }).format(n);
}

interface CheckoutItem {
  product_id: string;
  name: string;
  brand_name: string | null;
  primary_code: string | null;
  primary_image_path: string | null;
  price_gross: number;
  final_price: number;
  unit_net: number;
  tax_rate: number;
  quantity: number;
}

interface CheckoutProfile {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  kind: string | null;
  company_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  reg_no: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
}

interface Totals {
  net: number;
  tax: number;
  gross: number;
}

export default function CheckoutClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [totals, setTotals] = useState<Totals>({ net: 0, tax: 0, gross: 0 });
  const [classDiscountPct, setClassDiscountPct] = useState(0);

  // Form fields
  const [form, setForm] = useState({
    shipping_address: "",
    shipping_city: "",
    shipping_postal_code: "",
    shipping_country: "România",
    billing_name: "",
    billing_tax_id: "",
    billing_reg_no: "",
    phone: "",
    notes: "",
    gdpr_consent: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/checkout");
        const data = await res.json();

        if (!res.ok || !data.ok) {
          if (res.status === 401) {
            router.push("/login?redirect=/checkout");
            return;
          }
          setError(data.error || "Eroare la încărcarea datelor.");
          setLoading(false);
          return;
        }

        setItems(data.items || []);
        setTotals(data.totals || { net: 0, tax: 0, gross: 0 });
        setClassDiscountPct(data.class_discount_pct || 0);

        // Prefill form from profile
        const p: CheckoutProfile | null = data.profile;
        if (p) {
          setForm((prev) => ({
            ...prev,
            shipping_address: p.address || "",
            shipping_city: p.city || "",
            shipping_postal_code: p.postal_code || "",
            shipping_country: p.country || "România",
            billing_name: p.company_name || p.legal_name || p.display_name || "",
            billing_tax_id: p.tax_id || "",
            billing_reg_no: p.reg_no || "",
            phone: p.phone || "",
          }));
        }

        if (!data.items?.length) {
          setError("Coșul este gol.");
        }
      } catch {
        setError("Eroare la încărcarea datelor.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.gdpr_consent) {
      setError("Trebuie să accepți termenii și politica GDPR.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Eroare la plasarea comenzii.");
        setSubmitting(false);
        return;
      }

      setOrderId(data.order_id);
      setSuccess(true);
    } catch {
      setError("Eroare la plasarea comenzii.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="text-sm text-slate-700">Se încarcă...</div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8 text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">{error}</h3>
        <Link
          href="/cos"
          className="inline-block mt-4 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Înapoi la coș
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 sm:p-10 text-center">
        <div className="mb-4 text-5xl">✅</div>
        <h2 className="mb-2 text-xl font-bold text-slate-900">
          Comanda a fost plasată!
        </h2>
        <p className="mb-6 text-sm text-slate-700">
          Vei primi un email de confirmare. Numărul comenzii:{" "}
          <span className="font-mono font-semibold">{orderId?.slice(0, 8)}</span>
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/account"
            className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Contul meu
          </Link>
          <Link
            href="/catalog"
            className="inline-block rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
          >
            Continuă cumpărăturile
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8 text-center">
        <div className="mb-4 text-4xl">🛒</div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">
          Coșul tău este gol
        </h3>
        <p className="mb-6 text-sm text-slate-700">
          Adaugă produse în coș înainte de a finaliza comanda.
        </p>
        <Link
          href="/catalog"
          className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Mergi la catalog
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left — form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipping */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              📦 Adresa de livrare
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Adresa *
                </label>
                <input
                  name="shipping_address"
                  value={form.shipping_address}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="Strada, Nr., Bloc, Scara, Ap."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Oraș *
                </label>
                <input
                  name="shipping_city"
                  value={form.shipping_city}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="București"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Cod poștal
                </label>
                <input
                  name="shipping_postal_code"
                  value={form.shipping_postal_code}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="010101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Telefon *
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  type="tel"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="07xx xxx xxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Țara
                </label>
                <input
                  name="shipping_country"
                  value={form.shipping_country}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                />
              </div>
            </div>
          </section>

          {/* Billing */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              🧾 Date de facturare
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Nume / Firmă
                </label>
                <input
                  name="billing_name"
                  value={form.billing_name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="SC Exemplu SRL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  CUI / CIF
                </label>
                <input
                  name="billing_tax_id"
                  value={form.billing_tax_id}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="RO12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  Nr. Reg. Com.
                </label>
                <input
                  name="billing_reg_no"
                  value={form.billing_reg_no}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  placeholder="J40/1234/2024"
                />
              </div>
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              📝 Observații
            </h2>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none resize-none"
              placeholder="Instrucțiuni speciale de livrare, mențiuni pentru comandă..."
            />
          </section>

          {/* GDPR Consent */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.gdpr_consent}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, gdpr_consent: e.target.checked }))
                }
                required
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 accent-amber-500 flex-shrink-0"
              />
              <span className="text-sm text-slate-700">
                Am citit și sunt de acord cu{" "}
                <a
                  href="/terms"
                  target="_blank"
                  className="text-amber-600 hover:text-amber-500 font-medium"
                >
                  Termenii și condițiile
                </a>
                ,{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  className="text-amber-600 hover:text-amber-500 font-medium"
                >
                  Politica de confidențialitate
                </a>{" "}
                și{" "}
                <a
                  href="/gdpr"
                  target="_blank"
                  className="text-amber-600 hover:text-amber-500 font-medium"
                >
                  Politica GDPR
                </a>
                . Sunt de acord cu prelucrarea datelor personale în scopul
                procesării comenzii. *
              </span>
            </label>
          </section>
        </div>

        {/* Right — summary */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 sticky top-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Sumar comandă
            </h2>

            {/* Items */}
            <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-3">
                  {item.primary_image_path && (
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.primary_image_path}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-700">
                      {item.quantity} × {formatRON(item.final_price)}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 flex-shrink-0">
                    {formatRON(item.final_price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-700">
                <span>Subtotal (net):</span>
                <span className="font-medium">{formatRON(totals.net)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700">
                <span>TVA:</span>
                <span className="font-medium">{formatRON(totals.tax)}</span>
              </div>
              {classDiscountPct > 0 && (
                <div className="flex justify-between text-sm text-indigo-700">
                  <span>Discount clasă:</span>
                  <span className="font-semibold">-{classDiscountPct}%</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 mt-4 pt-4 flex justify-between">
              <span className="text-lg font-semibold text-slate-900">Total:</span>
              <span className="text-2xl font-bold text-amber-500">
                {formatRON(totals.gross)}
              </span>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className={`
                mt-6 w-full py-3 rounded-full font-semibold text-center transition
                ${submitting
                  ? "bg-slate-300 text-slate-500 cursor-wait"
                  : "bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer"
                }
              `}
            >
              {submitting ? "Se procesează..." : "Plasează comanda"}
            </button>

            <Link
              href="/cos"
              className="block mt-3 text-center text-sm text-slate-700 hover:text-slate-900 transition"
            >
              ← Înapoi la coș
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
