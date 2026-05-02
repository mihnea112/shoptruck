"use client";

import { useState, useEffect } from "react";

interface CombinedContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  tags: string[];
  is_unsubscribed: boolean;
  created_at: string;
  source: "account" | "email_contact" | "both";
  account_id?: string;
  phone?: string;
  kind?: "COMPANY" | "INDIVIDUAL";
}

export default function CombinedContactsUI() {
  const [contacts, setContacts] = useState<CombinedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [breakdown, setBreakdown] = useState({ account_only: 0, email_contact_only: 0, both: 0 });

  const limit = 50;

  const loadContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (sourceFilter) params.append("source", sourceFilter);
      params.append("limit", String(limit));
      params.append("offset", String(offset));

      const res = await fetch(`/api/admin/email/contacts-combined?${params}`);
      const data = await res.json();

      if (data.ok) {
        setContacts(data.items || []);
        setTotal(data.total || 0);
        setBreakdown(data.source_breakdown || {});
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la încărcarea contactelor." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la încărcarea contactelor." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [search, sourceFilter, offset]);

  const handleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      const accountOnly = contacts
        .filter((c) => c.source === "account" && !c.id.startsWith("account"))
        .map((c) => c.account_id || c.id);
      setSelectedIds(new Set(accountOnly));
    }
  };

  const handleToggleSelect = (contact: CombinedContact) => {
    if (contact.source === "both" || contact.source === "email_contact") {
      return; // Can't import these, already in email_contact
    }

    const newSelected = new Set(selectedIds);
    const id = contact.account_id || contact.id;

    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }

    setSelectedIds(newSelected);
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      setMessage({ type: "error", text: "Selectați cel puțin un contact de importat." });
      return;
    }

    if (!confirm(`Importați ${selectedIds.size} clienți în lista de email?`)) return;

    setImporting(true);

    try {
      const res = await fetch("/api/admin/email/contacts-combined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import-customers",
          account_ids: Array.from(selectedIds),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage({
          type: "success",
          text: `Importat ${data.imported} clienți, ${data.skipped} deja existenți.`,
        });
        setSelectedIds(new Set());
        loadContacts();
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la import." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la import." });
    } finally {
      setImporting(false);
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "account":
        return <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Doar client</span>;
      case "email_contact":
        return <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Doar email</span>;
      case "both":
        return <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">Ambele</span>;
      default:
        return null;
    }
  };

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const importableCount = contacts.filter((c) => c.source === "account").length;
  const selectedImportable = Array.from(selectedIds).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Contacte combinate</h2>
        <p className="mt-2 text-slate-600">
          Clienți din bază + listă email cu deduplicare
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-slate-900">{total}</div>
          <div className="text-sm text-slate-600">Total unic</div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-2xl font-bold text-blue-700">{breakdown.account_only}</div>
          <div className="text-sm text-blue-600">Doar clienți</div>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="text-2xl font-bold text-green-700">{breakdown.email_contact_only}</div>
          <div className="text-sm text-green-600">Doar email</div>
        </div>
        <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
          <div className="text-2xl font-bold text-purple-700">{breakdown.both}</div>
          <div className="text-sm text-purple-600">În ambele</div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-2xl border p-4 ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <input
          type="text"
          placeholder="Cauta email, nume..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />

        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setOffset(0);
          }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Toate sursele</option>
          <option value="account">Doar clienți</option>
          <option value="email_contact">Doar email</option>
          <option value="both">Ambele</option>
        </select>

        <div className="flex gap-2">
          {importableCount > 0 && (
            <button
              onClick={handleImport}
              disabled={importing || selectedImportable === 0}
              className="flex-1 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 transition disabled:opacity-50 hover:bg-amber-500"
            >
              {importing
                ? "Se importă..."
                : `Importă ${selectedImportable > 0 ? `(${selectedImportable})` : ""}`}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Încarcă...</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nu sunt contacte</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {importableCount > 0 && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedImportable === importableCount && importableCount > 0}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Nume</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Sursă</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Tip</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-slate-200 transition hover:bg-slate-50">
                    {importableCount > 0 && (
                      <td className="px-6 py-3">
                        {contact.source === "account" && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(contact.account_id || contact.id)}
                            onChange={() => handleToggleSelect(contact)}
                            className="rounded border-slate-300"
                          />
                        )}
                      </td>
                    )}
                    <td className="px-6 py-3 text-slate-900 font-mono text-xs">{contact.email}</td>
                    <td className="px-6 py-3 text-slate-600">
                      {contact.first_name || contact.last_name
                        ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                        : "-"}
                    </td>
                    <td className="px-6 py-3">{getSourceBadge(contact.source)}</td>
                    <td className="px-6 py-3 text-slate-600 text-xs">
                      {contact.kind ? (contact.kind === "COMPANY" ? "Firmă" : "Persoană") : "-"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          contact.is_unsubscribed
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {contact.is_unsubscribed ? "Dezabonat" : "Activ"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Pagina {currentPage} din {pages} ({total} total)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition disabled:opacity-50 hover:bg-slate-50"
                >
                  Înapoi
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition disabled:opacity-50 hover:bg-slate-50"
                >
                  Înainte
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
