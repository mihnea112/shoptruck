"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AccountClient() {
  const [activeTab, setActiveTab] = useState<"profile" | "orders" | "favorites">("profile");

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "profile"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Date profil
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "orders"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Comenzile mele
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "favorites"
              ? "text-amber-600 border-b-2 border-amber-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Lista de dorințe
        </button>
      </div>

      {/* Content */}
      {activeTab === "profile" ? (
        <ProfileForm />
      ) : activeTab === "orders" ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <div className="mb-4 text-4xl">📦</div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">
            Nu ai nici o comandă yet
          </h3>
          <p className="mb-6 text-sm text-slate-600">
            Explorează catalogul și plasează prima comandă
          </p>
          <Link
            href="/catalog"
            className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Mergi la catalog
          </Link>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-600 mb-4">
            Vedere detaliată a dorințelor tale - accesează{" "}
            <Link href="/dorinte" className="font-medium text-amber-600 hover:text-amber-700">
              lista de dorințe completă
            </Link>
          </p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mb-4 text-4xl">♡</div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              Nu ai salvat nici un produs
            </h3>
            <p className="mb-6 text-sm text-slate-600">
              Explorează catalogul și adaugă produsele care îți plac
            </p>
            <Link
              href="/catalog"
              className="inline-block rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Mergi la catalog
            </Link>
          </div>
        </div>
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
          setFormData(data);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Prenume
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
            placeholder="Ex: Ion"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Nume
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
            placeholder="Ex: Popescu"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
            placeholder="Ex: ion@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Telefon
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
            placeholder="Ex: +40 123 456 789"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-900 mb-2">
          Adresă
        </label>
        <input
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
          placeholder="Ex: Str. Principală 123"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Oraș
          </label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
            placeholder="Ex: București"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Cod poștal
          </label>
          <input
            type="text"
            name="postalCode"
            value={formData.postalCode}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-amber-600 focus:outline-none"
            placeholder="Ex: 010000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">
            Țară
          </label>
          <select
            name="country"
            value={formData.country}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-amber-600 focus:outline-none"
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
        className="w-full rounded-lg bg-amber-600 px-6 py-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
      >
        {loading ? "Se salvează..." : "Salvează modificări"}
      </button>
    </form>
  );
}
