"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  sent_count: number;
  failed_count: number;
  total_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function CampaignsUI() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      params.append("limit", String(limit));
      params.append("offset", String(offset));

      const res = await fetch(`/api/admin/email/campaigns?${params}`);
      const data = await res.json();

      if (data.ok) {
        setCampaigns(data.items || []);
        setTotal(data.total || 0);
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la încărcarea campaniilor." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la încărcarea campaniilor." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter, offset]);

  const handleDelete = async (id: string) => {
    if (!confirm("Sigur doriți să ștergeți această campanie?")) return;

    try {
      const res = await fetch(`/api/admin/email/campaigns/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: "Campanie ștersă cu succes." });
        loadCampaigns();
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la ștergerea campaniei." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la ștergerea campaniei." });
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      draft: { bg: "bg-slate-100", text: "text-slate-700", label: "Ciornă" },
      scheduled: { bg: "bg-blue-100", text: "text-blue-700", label: "Programat" },
      sending: { bg: "bg-amber-100", text: "text-amber-700", label: "Trimitere" },
      sent: { bg: "bg-green-100", text: "text-green-700", label: "Trimis" },
      cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Anulat" },
    };

    const badge = badges[status] || badges.draft;
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}>{badge.label}</span>;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ro-RO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Campanii Email</h1>
            <p className="mt-2 text-slate-600">Creează și trimite campanii email</p>
          </div>
          <Link
            href="/admin/email/campaigns/new"
            className="rounded-2xl bg-amber-400 px-6 py-2 font-semibold text-slate-900 transition hover:bg-amber-500"
          >
            Campanie nouă
          </Link>
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

        {/* Filter */}
        <div className="mb-6">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOffset(0);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Toate stările</option>
            <option value="draft">Ciornă</option>
            <option value="scheduled">Programat</option>
            <option value="sending">Trimitere</option>
            <option value="sent">Trimis</option>
            <option value="cancelled">Anulat</option>
          </select>
        </div>

        {/* Campaigns Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Încarcă...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Nu sunt campanii</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              {campaigns.map((campaign) => {
                const progress = campaign.total_count > 0
                  ? Math.round((campaign.sent_count / campaign.total_count) * 100)
                  : 0;

                return (
                  <div
                    key={campaign.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{campaign.name}</h3>
                        <p className="text-sm text-slate-600">{campaign.subject}</p>
                      </div>
                      {getStatusBadge(campaign.status)}
                    </div>

                    {/* Progress Bar */}
                    {campaign.total_count > 0 && (
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span>Progres</span>
                          <span>
                            {campaign.sent_count}/{campaign.total_count} ({progress}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-400 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-green-50 p-2">
                        <div className="text-sm font-bold text-green-700">{campaign.sent_count}</div>
                        <div className="text-xs text-green-600">Trimise</div>
                      </div>
                      <div className="rounded-lg bg-red-50 p-2">
                        <div className="text-sm font-bold text-red-700">{campaign.failed_count}</div>
                        <div className="text-xs text-red-600">Eșecuri</div>
                      </div>
                      <div className="rounded-lg bg-slate-100 p-2">
                        <div className="text-sm font-bold text-slate-700">{campaign.total_count}</div>
                        <div className="text-xs text-slate-600">Total</div>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="mb-4 text-xs text-slate-500">
                      Creat: {formatDate(campaign.created_at)}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/email/campaigns/${campaign.id}`}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Editează
                      </Link>

                      {campaign.status === "sending" || campaign.status === "sent" ? (
                        <Link
                          href={`/admin/email/campaigns/${campaign.id}/stats`}
                          className="flex-1 rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          Statistici
                        </Link>
                      ) : null}

                      {campaign.status === "sent" && campaign.failed_count === 0 && (
                        <button
                          onClick={() => handleDelete(campaign.id)}
                          className="flex-1 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Șterge
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
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
