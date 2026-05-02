"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const CombinedContactsUI = dynamic(() => import("./combined-ui"), { ssr: false });

interface Contact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  tags: string[];
  is_unsubscribed: boolean;
  created_at: string;
}

export default function ContactsUI() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [allTags, setAllTags] = useState<string[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [addFormData, setAddFormData] = useState({ email: "", first_name: "", last_name: "", tags: "" });
  const [csvContent, setCsvContent] = useState("");
  const [csvPreview, setCsvPreview] = useState<Contact[]>([]);
  const [importing, setImporting] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [view, setView] = useState<"contacts" | "combined">("contacts");

  // Load contacts
  const loadContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (tagFilter) params.append("tags", tagFilter);
      params.append("limit", String(limit));
      params.append("offset", String(offset));

      const res = await fetch(`/api/admin/email/contacts?${params}`);
      const data = await res.json();

      if (data.ok) {
        setContacts(data.items || []);
        setTotal(data.total || 0);

        // Extract all unique tags
        const tags = new Set<string>();
        (data.items || []).forEach((c: Contact) => {
          c.tags.forEach((t) => tags.add(t));
        });
        setAllTags(Array.from(tags).sort());
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
  }, [search, tagFilter, offset]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingContact(true);

    try {
      const tags = addFormData.tags.split(",").map((t) => t.trim()).filter((t) => t);

      const res = await fetch("/api/admin/email/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: addFormData.email,
          first_name: addFormData.first_name || undefined,
          last_name: addFormData.last_name || undefined,
          tags,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: "Contact adăugat cu succes." });
        setAddFormData({ email: "", first_name: "", last_name: "", tags: "" });
        setShowAddModal(false);
        loadContacts();
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la adăugarea contactului." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la adăugarea contactului." });
    } finally {
      setAddingContact(false);
    }
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);

    try {
      const res = await fetch("/api/admin/email/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data = await res.json();

      if (data.ok) {
        setMessage({
          type: "success",
          text: `CSV importat: ${data.inserted} noi, ${data.updated} actualizați.`,
        });
        setCsvContent("");
        setCsvPreview([]);
        setShowImportModal(false);
        loadContacts();
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la importarea CSV." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la importarea CSV." });
    } finally {
      setImporting(false);
    }
  };

  const handleCsvChange = (content: string) => {
    setCsvContent(content);

    // Generate preview
    const lines = content.trim().split("\n").slice(0, 6); // First 5 data rows + header
    const preview: Contact[] = [];

    if (lines.length > 1) {
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const email = values[headers.indexOf("email")] || "";
        if (email) {
          preview.push({
            id: `preview-${i}`,
            email,
            first_name: values[headers.indexOf("first_name")] || "",
            last_name: values[headers.indexOf("last_name")] || "",
            tags: (values[headers.indexOf("tags")] || "").split(",").map((t) => t.trim()).filter((t) => t),
            is_unsubscribed: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    setCsvPreview(preview);
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Sigur doriți să dezabonați acest contact?")) return;

    try {
      const res = await fetch(`/api/admin/email/contacts/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: "Contact șters cu succes." });
        loadContacts();
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la ștergerea contactului." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la ștergerea contactului." });
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setOffset(0);
  };

  const handleTagFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTagFilter(e.target.value);
    setOffset(0);
  };

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (view === "combined") {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header with tabs */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-3xl font-bold text-slate-900">Contacte Email</h1>
              <button
                onClick={() => setView("contacts")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                ← Înapoi la contacte
              </button>
            </div>
          </div>

          <CombinedContactsUI />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Contacte Email</h1>
            <p className="mt-2 text-slate-600">Gestionați lista de contacte pentru campanii email</p>
          </div>
          <button
            onClick={() => setView("combined")}
            className="rounded-2xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            Contacte combinate
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 rounded-2xl border p-4 ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filters and Actions */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div>
            <input
              type="text"
              placeholder="Cauta email, nume..."
              value={search}
              onChange={handleSearch}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-500 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex gap-2">
            {allTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={handleTagFilter}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Toate tag-urile</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowImportModal(true)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Importă CSV
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-500"
            >
              Adaugă contact
            </button>
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
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Email</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Nume</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Tag-uri</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Acțiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-slate-200 transition hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-900">{contact.email}</td>
                      <td className="px-6 py-3 text-slate-600">
                        {contact.first_name || contact.last_name
                          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                          : "-"}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
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
                      <td className="px-6 py-3">
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-sm text-red-600 transition hover:text-red-700"
                        >
                          Șterge
                        </button>
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

        {/* Add Contact Modal */}
        {showAddModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Adaugă contact</h2>

              <form onSubmit={handleAddContact}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-900 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={addFormData.email}
                    onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">
                      Prenume
                    </label>
                    <input
                      type="text"
                      value={addFormData.first_name}
                      onChange={(e) => setAddFormData({ ...addFormData, first_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1">
                      Nume
                    </label>
                    <input
                      type="text"
                      value={addFormData.last_name}
                      onChange={(e) => setAddFormData({ ...addFormData, last_name: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-1">
                    Tag-uri (separate by comma)
                  </label>
                  <input
                    type="text"
                    value={addFormData.tags}
                    onChange={(e) => setAddFormData({ ...addFormData, tags: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="ex: vip, generator"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    disabled={addingContact}
                    className="flex-1 rounded-xl bg-amber-400 px-4 py-2 font-semibold text-slate-900 transition disabled:opacity-50 hover:bg-amber-500"
                  >
                    {addingContact ? "Adaugă..." : "Adaugă"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import CSV Modal */}
        {showImportModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4 z-50">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="mb-4 text-xl font-bold text-slate-900">Importă contacte din CSV</h2>

              <form onSubmit={handleImportCSV}>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-900 mb-1">
                    CSV (Coloane: email, first_name, last_name, tags)
                  </label>
                  <textarea
                    value={csvContent}
                    onChange={(e) => handleCsvChange(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="email,first_name,last_name,tags&#10;john@example.com,John,Doe,vip&#10;jane@example.com,Jane,Smith,generator,vip"
                  />
                </div>

                {csvPreview.length > 0 && (
                  <div className="mb-6">
                    <h3 className="mb-2 font-semibold text-slate-900">Preview (primele 5 rânduri):</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-900">Email</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-900">Nume</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-900">Tag-uri</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((c) => (
                            <tr key={c.id} className="border-b border-slate-200">
                              <td className="px-3 py-2 text-slate-900">{c.email}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {c.first_name || c.last_name ? `${c.first_name} ${c.last_name}` : "-"}
                              </td>
                              <td className="px-3 py-2">{c.tags.join(", ") || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Anulează
                  </button>
                  <button
                    type="submit"
                    disabled={importing || csvContent.trim().length === 0}
                    className="flex-1 rounded-xl bg-amber-400 px-4 py-2 font-semibold text-slate-900 transition disabled:opacity-50 hover:bg-amber-500"
                  >
                    {importing ? "Importă..." : "Importă"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
