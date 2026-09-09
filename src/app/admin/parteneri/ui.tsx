"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────────── */

type Partner = {
  id: string;
  partner_type: string;
  kind: string;
  code: string | null;
  display_name: string;
  legal_name: string | null;
  tax_id: string | null;
  reg_no: string | null;
  is_vat_payer: boolean;
  email: string | null;
  phone: string | null;
  city: string | null;
  county: string | null;
  credit_days: number;
  credit_limit: number;
  payment_method: string | null;
  delivery_method: string | null;
  discount_class_name: string | null;
  discount_pct: number | null;
  is_active: boolean;
  created_at: string;
};

type DiscountClass = {
  id: string;
  name: string;
  description: string | null;
  discount_pct: number;
  applies_to: string;
  is_active: boolean;
};

/* ── Helpers ───────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  CLIENT: "Client",
  SUPPLIER: "Furnizor",
  BOTH: "Client & Furnizor",
};

const TYPE_COLORS: Record<string, string> = {
  CLIENT: "bg-blue-50 text-blue-700 border-blue-200",
  SUPPLIER: "bg-amber-50 text-amber-700 border-amber-200",
  BOTH: "bg-purple-50 text-purple-700 border-purple-200",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl ${ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
      {msg}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────── */

export default function PartnersUI() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [discountClasses, setDiscountClasses] = useState<DiscountClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Tabs
  const [tab, setTab] = useState<"partners" | "discounts">("partners");

  // Partner form modal
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [formBanks, setFormBanks] = useState<any[]>([]);
  const [formContacts, setFormContacts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Discount class form
  const [showDcForm, setShowDcForm] = useState(false);
  const [dcForm, setDcForm] = useState<any>({});
  const [dcEditId, setDcEditId] = useState<string | null>(null);
  const [dcSaving, setDcSaving] = useState(false);

  const showToast = (msg: string, ok: boolean) => setToast({ msg, ok });

  /* ── Load data ─────────────────────────────────────── */

  const loadPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (typeFilter !== "all") params.set("type", typeFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/admin/partners?${params}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare.");
      setPartners(data.items || []);
    } catch (e: any) {
      showToast(e?.message || "Eroare la încărcare.", false);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  const loadDiscountClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/discount-classes");
      const data = await res.json();
      if (data.ok) setDiscountClasses(data.items || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadPartners(); }, [loadPartners]);
  useEffect(() => { loadDiscountClasses(); }, [loadDiscountClasses]);

  async function syncPartners() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/partners/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare.");
      const s = data.synced;
      showToast(`Sincronizat: ${s.clients_added} clienți, ${s.suppliers_added} furnizori adăugați (${s.skipped} existenți).`, true);
      loadPartners();
    } catch (e: any) {
      showToast(e?.message || "Eroare la sincronizare.", false);
    } finally {
      setSyncing(false);
    }
  }

  /* ── Partner CRUD ──────────────────────────────────── */

  function openNew() {
    setEditId(null);
    setForm({
      partner_type: "CLIENT",
      kind: "COMPANY",
      country: "Romania",
      street_type: "Strada",
      credit_days: 0,
      credit_limit: 0,
      is_vat_payer: false,
      has_credit: false,
      blocked_billing: false,
      vat_on_receipt: false,
      split_vat: false,
      is_active: true,
    });
    setFormBanks([]);
    setFormContacts([]);
    setShowForm(true);
  }

  async function openEdit(id: string) {
    try {
      const res = await fetch(`/api/admin/partners/${id}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const p = data.item;
      setEditId(id);
      setForm({ ...p });
      setFormBanks(p.banks || []);
      setFormContacts(p.contacts || []);
      setShowForm(true);
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    }
  }

  async function savePartner() {
    setSaving(true);
    try {
      const payload = { ...form, banks: formBanks, contacts: formContacts };
      const url = editId ? `/api/admin/partners/${editId}` : "/api/admin/partners";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare.");
      showToast(editId ? "Partener actualizat." : "Partener creat.", true);
      setShowForm(false);
      loadPartners();
    } catch (e: any) {
      showToast(e?.message || "Eroare la salvare.", false);
    } finally {
      setSaving(false);
    }
  }

  async function deletePartner(id: string, name: string) {
    if (!confirm(`Sigur ștergi partenerul "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/partners/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      showToast("Partener șters.", true);
      loadPartners();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    }
  }

  /* ── Discount Class CRUD ───────────────────────────── */

  function openNewDc() {
    setDcEditId(null);
    setDcForm({ name: "", discount_pct: 0, applies_to: "BOTH", description: "", is_active: true });
    setShowDcForm(true);
  }

  function openEditDc(dc: DiscountClass) {
    setDcEditId(dc.id);
    setDcForm({ ...dc });
    setShowDcForm(true);
  }

  async function saveDc() {
    setDcSaving(true);
    try {
      const method = dcEditId ? "PUT" : "POST";
      const payload = dcEditId ? { ...dcForm, id: dcEditId } : dcForm;
      const res = await fetch("/api/admin/discount-classes", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      showToast(dcEditId ? "Clasă actualizată." : "Clasă creată.", true);
      setShowDcForm(false);
      loadDiscountClasses();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    } finally {
      setDcSaving(false);
    }
  }

  async function deleteDc(id: string, name: string) {
    if (!confirm(`Sigur ștergi clasa "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/discount-classes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      showToast("Clasă ștearsă.", true);
      loadDiscountClasses();
    } catch (e: any) {
      showToast(e?.message || "Eroare.", false);
    }
  }

  /* ── Render ────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Parteneri</h1>
          <p className="mt-1 text-sm text-slate-600">Clienți, furnizori și clase de discount</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setTab("partners")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "partners" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          Parteneri ({partners.length})
        </button>
        <button
          onClick={() => setTab("discounts")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "discounts" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          Clase discount ({discountClasses.length})
        </button>
      </div>

      {/* ══════════ PARTNERS TAB ══════════ */}
      {tab === "partners" && (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Caută partener..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#feab1f] focus:outline-none focus:ring-2 focus:ring-[#feab1f]/20"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none"
            >
              <option value="all">Toți</option>
              <option value="CLIENT">Clienți</option>
              <option value="SUPPLIER">Furnizori</option>
              <option value="BOTH">Client & Furnizor</option>
            </select>
            <button
              onClick={syncPartners}
              disabled={syncing}
              className="ml-auto rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              {syncing ? "Se sincronizează..." : "⟳ Sincronizează"}
            </button>
            <button
              onClick={openNew}
              className="rounded-xl bg-[#feab1f] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e09a1a] transition"
            >
              + Partener nou
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500">Se încarcă...</div>
          ) : partners.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500">
              {search ? "Niciun rezultat." : "Niciun partener."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3">Nume</th>
                    <th className="px-4 py-3">Tip</th>
                    <th className="px-4 py-3">CUI</th>
                    <th className="px-4 py-3">Oraș</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Clasă discount</th>
                    <th className="px-4 py-3">Credit</th>
                    <th className="px-4 py-3 text-right">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partners.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{p.display_name}</div>
                        {p.code && <div className="text-xs text-slate-500">Cod: {p.code}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={TYPE_LABELS[p.partner_type] || p.partner_type} color={TYPE_COLORS[p.partner_type] || "bg-slate-50 text-slate-600 border-slate-200"} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.tax_id || "–"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {[p.city, p.county].filter(Boolean).join(", ") || "–"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.email || "–"}</td>
                      <td className="px-4 py-3">
                        {p.discount_class_name ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {p.discount_class_name} ({p.discount_pct}%)
                          </span>
                        ) : (
                          <span className="text-slate-400">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.credit_limit > 0 ? `${Number(p.credit_limit).toLocaleString("ro-RO")} lei / ${p.credit_days}z` : "–"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(p.id)} className="mr-2 text-[#b57712] hover:underline text-xs font-semibold">
                          Editează
                        </button>
                        <button onClick={() => deletePartner(p.id, p.display_name)} className="text-red-500 hover:underline text-xs font-semibold">
                          Șterge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══════════ DISCOUNT CLASSES TAB ══════════ */}
      {tab === "discounts" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Clasele de discount se atribuie partenerilor pentru a oferi reduceri automate.
            </p>
            <button
              onClick={openNewDc}
              className="rounded-xl bg-[#feab1f] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e09a1a] transition"
            >
              + Clasă nouă
            </button>
          </div>

          {discountClasses.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500">Nicio clasă de discount.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discountClasses.map((dc) => (
                <div key={dc.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">{dc.name}</h3>
                      {dc.description && <p className="mt-1 text-xs text-slate-600">{dc.description}</p>}
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-lg font-bold text-emerald-700">
                      {dc.discount_pct}%
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge
                      label={dc.applies_to === "CLIENT" ? "Clienți" : dc.applies_to === "SUPPLIER" ? "Furnizori" : "Toți"}
                      color={dc.applies_to === "CLIENT" ? "bg-blue-50 text-blue-700 border-blue-200" : dc.applies_to === "SUPPLIER" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-purple-50 text-purple-700 border-purple-200"}
                    />
                    {!dc.is_active && <Badge label="Inactiv" color="bg-red-50 text-red-700 border-red-200" />}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button onClick={() => openEditDc(dc)} className="text-xs font-semibold text-[#b57712] hover:underline">
                      Editează
                    </button>
                    <button onClick={() => deleteDc(dc.id, dc.name)} className="text-xs font-semibold text-red-500 hover:underline">
                      Șterge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════ PARTNER FORM MODAL ══════════ */}
      {showForm && (
        <PartnerFormModal
          form={form}
          setForm={setForm}
          banks={formBanks}
          setBanks={setFormBanks}
          contacts={formContacts}
          setContacts={setFormContacts}
          discountClasses={discountClasses}
          isEdit={!!editId}
          saving={saving}
          onSave={savePartner}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* ══════════ DISCOUNT CLASS FORM MODAL ══════════ */}
      {showDcForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              {dcEditId ? "Editează clasă discount" : "Clasă discount nouă"}
            </h2>
            <div className="space-y-3">
              <Field label="Nume *" value={dcForm.name} onChange={(v: string) => setDcForm({ ...dcForm, name: v })} />
              <Field label="Descriere" value={dcForm.description || ""} onChange={(v: string) => setDcForm({ ...dcForm, description: v })} />
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Procent discount (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={dcForm.discount_pct}
                  onChange={(e) => setDcForm({ ...dcForm, discount_pct: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#feab1f] focus:outline-none focus:ring-2 focus:ring-[#feab1f]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Se aplică la</label>
                <select
                  value={dcForm.applies_to}
                  onChange={(e) => setDcForm({ ...dcForm, applies_to: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none"
                >
                  <option value="BOTH">Toți</option>
                  <option value="CLIENT">Doar clienți</option>
                  <option value="SUPPLIER">Doar furnizori</option>
                </select>
              </div>
              {dcEditId && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={dcForm.is_active} onChange={(e) => setDcForm({ ...dcForm, is_active: e.target.checked })} />
                  Activ
                </label>
              )}
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setShowDcForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Anulează
              </button>
              <button onClick={saveDc} disabled={dcSaving} className="rounded-xl bg-[#feab1f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e09a1a] disabled:opacity-50">
                {dcSaving ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared Field ──────────────────────────────────────── */

function Field({ label, value, onChange, type = "text", placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#feab1f] focus:outline-none focus:ring-2 focus:ring-[#feab1f]/20"
      />
    </div>
  );
}

/* ── Partner Form Modal ────────────────────────────────── */

function PartnerFormModal({
  form, setForm, banks, setBanks, contacts, setContacts,
  discountClasses, isEdit, saving, onSave, onClose,
}: {
  form: any; setForm: (f: any) => void;
  banks: any[]; setBanks: (b: any[]) => void;
  contacts: any[]; setContacts: (c: any[]) => void;
  discountClasses: DiscountClass[];
  isEdit: boolean; saving: boolean; onSave: () => void; onClose: () => void;
}) {
  const [section, setSection] = useState<"general" | "address" | "commercial" | "banks" | "contacts">("general");
  const f = (key: string) => form[key] ?? "";
  const set = (key: string, val: any) => setForm({ ...form, [key]: val });

  const sections = [
    { key: "general", label: "General" },
    { key: "address", label: "Adresă" },
    { key: "commercial", label: "Comercial" },
    { key: "banks", label: "Bănci" },
    { key: "contacts", label: "Contacte" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? "Editează partener" : "Partener nou"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 border-b border-slate-100 bg-slate-50 px-6 py-2">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${section === s.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* ── GENERAL ── */}
          {section === "general" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Tip partener *</label>
                  <select value={f("partner_type")} onChange={(e) => set("partner_type", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none">
                    <option value="CLIENT">Client</option>
                    <option value="SUPPLIER">Furnizor</option>
                    <option value="BOTH">Client & Furnizor</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Tip entitate</label>
                  <select value={f("kind")} onChange={(e) => set("kind", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none">
                    <option value="COMPANY">Persoană juridică (SRL/SA)</option>
                    <option value="PFA">PFA</option>
                    <option value="INDIVIDUAL">Persoană fizică</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Nume partener *" value={f("display_name")} onChange={(v) => set("display_name", v)} className="col-span-2" />
                <Field label="Cod intern" value={f("code")} onChange={(v) => set("code", v)} placeholder="ex: AUT" />
              </div>

              <Field label="Denumire legală" value={f("legal_name")} onChange={(v) => set("legal_name", v)} />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Cod Fiscal / CUI" value={f("tax_id")} onChange={(v) => set("tax_id", v)} placeholder="ex: 5137115" />
                <Field label="Registrul comerțului" value={f("reg_no")} onChange={(v) => set("reg_no", v)} placeholder="ex: J35/128/1994" />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.is_vat_payer === true} onChange={(e) => set("is_vat_payer", e.target.checked)} />
                  Plătitor TVA
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.vat_on_receipt === true} onChange={(e) => set("vat_on_receipt", e.target.checked)} />
                  TVA la încasare
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.split_vat === true} onChange={(e) => set("split_vat", e.target.checked)} />
                  Split TVA
                </label>
              </div>

              {form.is_vat_payer && (
                <Field label="Plătitor TVA din data" value={f("vat_since")} onChange={(v) => set("vat_since", v)} type="date" />
              )}

              <Field label="Agent" value={f("agent_name")} onChange={(v) => set("agent_name", v)} placeholder="ex: Calancea Florin" />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" value={f("email")} onChange={(v) => set("email", v)} type="email" />
                <Field label="Telefon" value={f("phone")} onChange={(v) => set("phone", v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Website" value={f("website")} onChange={(v) => set("website", v)} placeholder="www.example.ro" />
                <Field label="Telefon SMS" value={f("sms_phone")} onChange={(v) => set("sms_phone", v)} />
              </div>
            </div>
          )}

          {/* ── ADDRESS ── */}
          {section === "address" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Țara" value={f("country")} onChange={(v) => set("country", v)} />
                <Field label="Județ" value={f("county")} onChange={(v) => set("county", v)} placeholder="ex: TIMIS" />
                <Field label="Localitate" value={f("city")} onChange={(v) => set("city", v)} placeholder="ex: Timisoara" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Zona" value={f("zone")} onChange={(v) => set("zone", v)} placeholder="ex: Aradului" />
                <Field label="Cod poștal" value={f("postal_code")} onChange={(v) => set("postal_code", v)} placeholder="300642" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Tip stradă</label>
                  <select value={f("street_type")} onChange={(e) => set("street_type", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none">
                    <option value="Strada">Strada</option>
                    <option value="Bulevardul">Bulevardul</option>
                    <option value="Aleea">Aleea</option>
                    <option value="Calea">Calea</option>
                    <option value="Piata">Piața</option>
                    <option value="Soseaua">Șoseaua</option>
                    <option value="Intrarea">Intrarea</option>
                    <option value="Fundatura">Fundătura</option>
                  </select>
                </div>
                <Field label="Nume stradă" value={f("street_name")} onChange={(v) => set("street_name", v)} className="col-span-2" placeholder="ex: Miresei" />
                <Field label="Număr" value={f("street_number")} onChange={(v) => set("street_number", v)} placeholder="12A" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <Field label="Bloc" value={f("block")} onChange={(v) => set("block", v)} />
                <Field label="Scara" value={f("staircase")} onChange={(v) => set("staircase", v)} />
                <Field label="Etaj" value={f("floor")} onChange={(v) => set("floor", v)} />
                <Field label="Apartament" value={f("apartment")} onChange={(v) => set("apartment", v)} />
              </div>
              <Field label="Alte detalii adresă" value={f("address_details")} onChange={(v) => set("address_details", v)} placeholder="Timisoara, Str.Miresei, Nr.12A" />

              <Field label="Mod livrare" value={f("delivery_method")} onChange={(v) => set("delivery_method", v)} placeholder="ex: Livrare cu masina ATR" />
            </div>
          )}

          {/* ── COMMERCIAL ── */}
          {section === "commercial" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Zile credit (implicit)" value={String(f("credit_days") || 0)} onChange={(v) => set("credit_days", Number(v) || 0)} type="number" />
                <Field label="Max zile credit" value={String(f("max_credit_days") || "")} onChange={(v) => set("max_credit_days", v ? Number(v) : null)} type="number" />
                <Field label="Credit maxim (lei)" value={String(f("credit_limit") || 0)} onChange={(v) => set("credit_limit", Number(v) || 0)} type="number" />
              </div>

              <Field label="Mod plată" value={f("payment_method")} onChange={(v) => set("payment_method", v)} placeholder="ex: SE ACHITA CU OP" />

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.has_credit === true} onChange={(e) => set("has_credit", e.target.checked)} />
                  Cu credit
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.blocked_billing === true} onChange={(e) => set("blocked_billing", e.target.checked)} />
                  Blocat la facturare
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Clasă discount</label>
                <select
                  value={f("discount_class_id") || ""}
                  onChange={(e) => set("discount_class_id", e.target.value || null)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none"
                >
                  <option value="">— Fără clasă —</option>
                  {discountClasses.filter((dc) => dc.is_active).map((dc) => (
                    <option key={dc.id} value={dc.id}>
                      {dc.name} ({dc.discount_pct}%) — {dc.applies_to === "CLIENT" ? "Clienți" : dc.applies_to === "SUPPLIER" ? "Furnizori" : "Toți"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── BANKS ── */}
          {section === "banks" && (
            <div className="space-y-4">
              {banks.map((b, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Cont bancar #{i + 1}</span>
                    <button onClick={() => setBanks(banks.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">
                      Șterge
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bancă *" value={b.bank_name || ""} onChange={(v) => { const n = [...banks]; n[i] = { ...n[i], bank_name: v }; setBanks(n); }} />
                    <Field label="Filiala" value={b.branch || ""} onChange={(v) => { const n = [...banks]; n[i] = { ...n[i], branch: v }; setBanks(n); }} />
                  </div>
                  <Field label="IBAN *" value={b.iban || ""} onChange={(v) => { const n = [...banks]; n[i] = { ...n[i], iban: v }; setBanks(n); }} placeholder="ROxx xxxx xxxx xxxx xxxx" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Cod SWIFT" value={b.swift_code || ""} onChange={(v) => { const n = [...banks]; n[i] = { ...n[i], swift_code: v }; setBanks(n); }} />
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Moneda</label>
                      <select value={b.currency || "LEI"} onChange={(e) => { const n = [...banks]; n[i] = { ...n[i], currency: e.target.value }; setBanks(n); }}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#feab1f] focus:outline-none">
                        <option>LEI</option>
                        <option>EUR</option>
                        <option>USD</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={b.is_default === true}
                      onChange={(e) => { const n = banks.map((bk, j) => ({ ...bk, is_default: j === i ? e.target.checked : false })); setBanks(n); }} />
                    Cont implicit
                  </label>
                </div>
              ))}
              <button
                onClick={() => setBanks([...banks, { bank_name: "", iban: "", currency: "LEI", is_default: false }])}
                className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition w-full"
              >
                + Adaugă cont bancar
              </button>
            </div>
          )}

          {/* ── CONTACTS ── */}
          {section === "contacts" && (
            <div className="space-y-4">
              {contacts.map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Contact #{i + 1}</span>
                    <button onClick={() => setContacts(contacts.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">
                      Șterge
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Titlu" value={c.title || ""} onChange={(v) => { const n = [...contacts]; n[i] = { ...n[i], title: v }; setContacts(n); }} placeholder="Dl./D-na" />
                    <Field label="Nume *" value={c.last_name || ""} onChange={(v) => { const n = [...contacts]; n[i] = { ...n[i], last_name: v }; setContacts(n); }} />
                    <Field label="Prenume *" value={c.first_name || ""} onChange={(v) => { const n = [...contacts]; n[i] = { ...n[i], first_name: v }; setContacts(n); }} />
                  </div>
                  <Field label="Funcție" value={c.role || ""} onChange={(v) => { const n = [...contacts]; n[i] = { ...n[i], role: v }; setContacts(n); }} placeholder="ex: Director General" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Telefon" value={c.phone || ""} onChange={(v) => { const n = [...contacts]; n[i] = { ...n[i], phone: v }; setContacts(n); }} />
                    <Field label="Email" value={c.email || ""} onChange={(v) => { const n = [...contacts]; n[i] = { ...n[i], email: v }; setContacts(n); }} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={c.is_primary === true}
                      onChange={(e) => { const n = contacts.map((ct, j) => ({ ...ct, is_primary: j === i ? e.target.checked : false })); setContacts(n); }} />
                    Contact principal
                  </label>
                </div>
              ))}
              <button
                onClick={() => setContacts([...contacts, { last_name: "", first_name: "", is_primary: false }])}
                className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition w-full"
              >
                + Adaugă contact
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Anulează
          </button>
          <button onClick={onSave} disabled={saving} className="rounded-xl bg-[#feab1f] px-6 py-2 text-sm font-bold text-white hover:bg-[#e09a1a] disabled:opacity-50 transition">
            {saving ? "Se salvează..." : isEdit ? "Actualizează" : "Creează"}
          </button>
        </div>
      </div>
    </div>
  );
}
