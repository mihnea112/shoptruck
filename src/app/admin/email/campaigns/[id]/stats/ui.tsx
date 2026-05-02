"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  sent_count: number;
  failed_count: number;
  total_count: number;
  created_at: string;
}

interface FailedSend {
  id: string;
  email: string;
  error_text: string;
  created_at: string;
}

interface StatsUIProps {
  campaignId: string;
}

export default function StatsUI({ campaignId }: StatsUIProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [failedSends, setFailedSends] = useState<FailedSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFailed, setLoadingFailed] = useState(true);

  useEffect(() => {
    loadCampaign();
    loadFailedSends();

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      loadCampaign();
      loadFailedSends();
    }, 5000);

    return () => clearInterval(interval);
  }, [campaignId]);

  const loadCampaign = async () => {
    try {
      const res = await fetch(`/api/admin/email/campaigns/${campaignId}`);
      const data = await res.json();

      if (data.ok) {
        setCampaign(data.campaign);
      }
    } catch (error) {
      console.error("Error loading campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFailedSends = async () => {
    try {
      const res = await fetch(
        `/api/admin/email/campaign-sends?campaign_id=${campaignId}&status=failed&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setFailedSends(data.items || []);
        }
      }
    } catch (error) {
      console.error("Error loading failed sends:", error);
    } finally {
      setLoadingFailed(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Încarcă...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-600">Campanie nu găsită.</p>
        </div>
      </div>
    );
  }

  const pendingCount = campaign.total_count - campaign.sent_count - campaign.failed_count;
  const successRate = campaign.total_count > 0
    ? Math.round((campaign.sent_count / campaign.total_count) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Statistici campanie</h1>
              <p className="mt-2 text-slate-600">{campaign.name}</p>
            </div>
            <Link
              href={`/admin/email/campaigns/${campaignId}`}
              className="text-slate-600 transition hover:text-slate-900"
            >
              ← Înapoi la editor
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          {/* Total */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-3xl font-bold text-slate-900">{campaign.total_count}</div>
            <div className="text-sm text-slate-600">Total contacte</div>
          </div>

          {/* Sent */}
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
            <div className="text-3xl font-bold text-green-700">{campaign.sent_count}</div>
            <div className="text-sm text-green-600">Trimise cu succes</div>
          </div>

          {/* Failed */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="text-3xl font-bold text-red-700">{campaign.failed_count}</div>
            <div className="text-sm text-red-600">Eșecuri</div>
          </div>

          {/* Pending */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-3xl font-bold text-amber-700">{pendingCount}</div>
            <div className="text-sm text-amber-600">În așteptare</div>
          </div>

          {/* Success Rate */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="text-3xl font-bold text-blue-700">{successRate}%</div>
            <div className="text-sm text-blue-600">Rata succes</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Progres trimitere</h2>

          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>Progres general</span>
            <span>{campaign.sent_count + campaign.failed_count}/{campaign.total_count}</span>
          </div>

          <div className="h-4 rounded-full bg-slate-100 overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
              style={{
                width: `${campaign.total_count > 0
                  ? ((campaign.sent_count + campaign.failed_count) / campaign.total_count) * 100
                  : 0
                }%`,
              }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>✓ Trimise</span>
                <span>{campaign.sent_count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{
                    width: `${campaign.total_count > 0
                      ? (campaign.sent_count / campaign.total_count) * 100
                      : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>✗ Eșecuri</span>
                <span>{campaign.failed_count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{
                    width: `${campaign.total_count > 0
                      ? (campaign.failed_count / campaign.total_count) * 100
                      : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>⏳ Așteptare</span>
                <span>{pendingCount}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{
                    width: `${campaign.total_count > 0
                      ? (pendingCount / campaign.total_count) * 100
                      : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Failed Sends Table */}
        {campaign.failed_count > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Eșecuri recente</h2>
            </div>

            {loadingFailed ? (
              <div className="p-8 text-center text-slate-500">Încarcă...</div>
            ) : failedSends.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Nu sunt detalii despre eșecuri disponibile
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Email</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Eroare</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-900">Dată</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedSends.map((send) => (
                      <tr key={send.id} className="border-b border-slate-200 transition hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-900">{send.email}</td>
                        <td className="px-6 py-3 text-red-600 font-mono text-xs">
                          {send.error_text || "-"}
                        </td>
                        <td className="px-6 py-3 text-slate-600 text-xs">
                          {new Date(send.created_at).toLocaleDateString("ro-RO", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Auto-refresh info */}
        <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          ℹ️ Statisticile se actualizează automat la fiecare 5 secunde
        </div>
      </div>
    </div>
  );
}
