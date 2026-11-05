"use client";

import { useCallback, useEffect, useState } from "react";

type Attachment = {
  id: string;
  url: string | null;
  file_name: string | null;
  note: string | null;
  created_at: string;
};

/** Nameplate photos attached to a customer account: upload, preview, delete. */
export default function NameplatesPanel({ accountId }: { accountId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);

  const base = `/api/admin/accounts/${accountId}/attachments`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Eroare la încărcare.");
      setItems(data.items || []);
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcare.");
    }
  }, [base]);

  useEffect(() => {
    setItems([]);
    setError(null);
    load();
  }, [load]);

  async function upload(files: FileList | File[]) {
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const upRes = await fetch(base, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "upload-url", ext }),
        });
        const up = await upRes.json();
        if (!upRes.ok || !up.ok) throw new Error(up.error || "Nu s-a putut pregăti încărcarea.");

        const put = await fetch(up.signedUrl, {
          method: "PUT",
          headers: { "content-type": f.type || "application/octet-stream" },
          body: f,
        });
        if (!put.ok) throw new Error(`Încărcare eșuată (${put.status}).`);

        const regRes = await fetch(base, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "register", storage_path: up.path, file_name: f.name }),
        });
        const reg = await regRes.json();
        if (!regRes.ok || !reg.ok) throw new Error(reg.error || "Nu s-a putut salva.");
      }
      await load();
    } catch (e: any) {
      setError(e?.message || "Eroare la încărcare.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Ștergi această imagine?")) return;
    const res = await fetch(`${base}?id=${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return setError(data.error || "Nu s-a putut șterge.");
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  async function saveNote(id: string, note: string) {
    await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, note }),
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">
          Plăcuțe de identificare ({items.length})
        </div>
        <label className="cursor-pointer rounded-full bg-[#feab1f] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#e09800]">
          {busy ? "Se încarcă…" : "+ Adaugă imagine"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="hidden"
            onChange={(e) => {
              if (e.currentTarget.files?.length) upload(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {items.length === 0 ? (
        <div className="text-xs text-slate-600">Nicio imagine salvată pentru acest client.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setPreview(a)}
                className="block h-28 w-full bg-slate-100"
              >
                {a.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.file_name || "Plăcuță"} className="h-full w-full object-cover" />
                )}
              </button>
              <div className="space-y-1 p-2">
                <input
                  defaultValue={a.note ?? ""}
                  placeholder="Notă (ex. Liebherr L514)"
                  onBlur={(e) => saveNote(a.id, e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#feab1f]"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>{new Date(a.created_at).toLocaleDateString("ro-RO")}</span>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="font-semibold text-red-600 hover:underline"
                  >
                    Șterge
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview?.url && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={preview.file_name || "Plăcuță"}
            className="max-h-full max-w-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
