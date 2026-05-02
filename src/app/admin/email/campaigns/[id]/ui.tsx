"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduled_at?: string;
  sent_count: number;
  failed_count: number;
  total_count: number;
  created_at: string;
  updated_at: string;
}

interface CampaignEditorUIProps {
  campaignId?: string;
  isNew: boolean;
}

export default function CampaignEditorUI({ campaignId, isNew }: CampaignEditorUIProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    subject: "",
    body_html: "",
    body_text: "",
    scheduled_at: "",
    tone: "professional",
    keyPoints: "",
  });

  const [showPreview, setShowPreview] = useState(false);

  // Load campaign if editing
  useEffect(() => {
    if (isNew) {
      setLoading(false);
      loadContactCount();
    } else if (campaignId) {
      loadCampaign();
    }
  }, []);

  // Load contact count whenever page loads
  useEffect(() => {
    loadContactCount();
  }, []);

  const loadCampaign = async () => {
    try {
      const res = await fetch(`/api/admin/email/campaigns/${campaignId}`);
      const data = await res.json();

      if (data.ok) {
        setCampaign(data.campaign);
        setForm({
          name: data.campaign.name,
          subject: data.campaign.subject,
          body_html: data.campaign.body_html,
          body_text: data.campaign.body_text,
          scheduled_at: data.campaign.scheduled_at || "",
          tone: "professional",
          keyPoints: "",
        });
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la încărcarea campaniei." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la încărcarea campaniei." });
    } finally {
      setLoading(false);
    }
  };

  const loadContactCount = async () => {
    try {
      const res = await fetch("/api/admin/email/contacts?limit=1&offset=0");
      const data = await res.json();
      if (data.ok) {
        setContactCount(data.total || 0);
      }
    } catch (error) {
      console.error("Error loading contact count:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isNew) {
        // Create new campaign
        const res = await fetch("/api/admin/email/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            subject: form.subject,
            body_html: form.body_html,
            body_text: form.body_text,
          }),
        });

        const data = await res.json();

        if (data.ok) {
          setMessage({ type: "success", text: "Campanie creată cu succes." });
          router.push(`/admin/email/campaigns/${data.id}`);
        } else {
          setMessage({ type: "error", text: data.error || "Eroare la salvare." });
        }
      } else {
        // Update existing campaign
        const res = await fetch(`/api/admin/email/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            subject: form.subject,
            body_html: form.body_html,
            body_text: form.body_text,
            scheduled_at: form.scheduled_at || null,
          }),
        });

        const data = await res.json();

        if (data.ok) {
          setMessage({ type: "success", text: "Campanie salvată cu succes." });
          setCampaign(data.campaign);
        } else {
          setMessage({ type: "error", text: data.error || "Eroare la salvare." });
        }
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la salvare." });
    } finally {
      setSaving(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!campaign) return;
    if (!confirm(`Trimiteți campania la ${contactCount} contacte?`)) return;

    setSending(true);

    try {
      const res = await fetch(`/api/admin/email/campaigns/${campaign.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.ok) {
        setMessage({ type: "success", text: "Campanie trimisă! Procesarea va continua în fundal." });
        loadCampaign();
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la trimitere." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la trimitere." });
    } finally {
      setSending(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!form.subject || !form.keyPoints) {
      setMessage({
        type: "error",
        text: "Completați subiectul și punctele cheie.",
      });
      return;
    }

    setGeneratingAI(true);

    try {
      const res = await fetch("/api/admin/email/compose-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject,
          tone: form.tone,
          keyPoints: form.keyPoints,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setForm({
          ...form,
          body_html: data.body_html,
          body_text: data.body_text,
        });
        setMessage({ type: "success", text: "Email generat cu IA cu succes." });
      } else {
        setMessage({ type: "error", text: data.error || "Eroare la generare IA." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Eroare la generare IA." });
    } finally {
      setGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Încarcă...</div>
      </div>
    );
  }

  const isEditable = !campaign || campaign.status === "draft";

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isNew ? "Campanie nouă" : "Editează campanie"}
            </h1>
            {campaign && (
              <p className="mt-2 text-slate-600">
                Status: <span className="font-semibold">{campaign.status}</span>
              </p>
            )}
          </div>
          <Link
            href="/admin/email/campaigns"
            className="text-slate-600 transition hover:text-slate-900"
          >
            ← Înapoi
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

        {campaign && campaign.status !== "draft" && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            Campania nu este în draft. Doar vizualizare.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Nume campanie *
              </label>
              <input
                type="text"
                required
                disabled={!isEditable}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Subiect email *
              </label>
              <input
                type="text"
                required
                disabled={!isEditable}
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* AI Compose Section */}
          {isEditable && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Compune cu IA</h2>

              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Ton
                  </label>
                  <select
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="professional">Profesional</option>
                    <option value="friendly">Prietenos</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Puncte cheie *
                </label>
                <textarea
                  disabled={!isEditable}
                  value={form.keyPoints}
                  onChange={(e) => setForm({ ...form, keyPoints: e.target.value })}
                  rows={3}
                  placeholder="Ex: Reducere 30%, Livrare gratis, Ofertă limitată"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={generatingAI || !form.subject}
                className="rounded-xl bg-amber-400 px-6 py-2 font-semibold text-slate-900 transition disabled:opacity-50 hover:bg-amber-500"
              >
                {generatingAI ? "Se generează..." : "Generează cu IA"}
              </button>
            </div>
          )}

          {/* HTML Body */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Corp HTML *
            </label>
            <textarea
              required
              disabled={!isEditable}
              value={form.body_html}
              onChange={(e) => setForm({ ...form, body_html: e.target.value })}
              rows={12}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
            />
          </div>

          {/* Plain Text Body */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Corp text plain *
            </label>
            <textarea
              required
              disabled={!isEditable}
              value={form.body_text}
              onChange={(e) => setForm({ ...form, body_text: e.target.value })}
              rows={8}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm text-slate-900 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-100"
            />
          </div>

          {/* Preview */}
          {form.body_html && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm font-semibold text-amber-600 transition hover:text-amber-700"
              >
                {showPreview ? "▼" : "▶"} Preview HTML
              </button>

              {showPreview && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-96 overflow-y-auto">
                  <div
                    dangerouslySetInnerHTML={{ __html: form.body_html }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Send Options */}
          {!isNew && campaign && isEditable && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Opțiuni trimitere</h2>

              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-4">
                  Contacte active: <span className="font-bold text-slate-900">{contactCount}</span>
                </p>

                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleSendCampaign}
                    disabled={sending}
                    className="rounded-xl bg-green-600 px-6 py-2 font-semibold text-white transition disabled:opacity-50 hover:bg-green-700"
                  >
                    {sending ? "Trimitere..." : "Trimite acum"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          {isEditable && (
            <div className="flex gap-2">
              <Link
                href="/admin/email/campaigns"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-6 py-2 text-center font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Anulează
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-amber-400 px-6 py-2 font-semibold text-slate-900 transition disabled:opacity-50 hover:bg-amber-500"
              >
                {saving ? "Salvează..." : "Salvează"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
