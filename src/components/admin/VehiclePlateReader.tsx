"use client";

import { useState } from "react";

export type PlateData = {
  chassis_vin: string | null;
  make: string | null;
  model: string | null;
  series: string | null;
  engine_code: string | null;
  year: number | null;
  engine_capacity: number | null;
  engine_power_kw: number | null;
  plate_no: string | null;
  notes: string | null;
};

// Downscale so OCR stays fast while the text remains readable.
async function toCanvas(file: File, maxSide = 2000): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const MAKES = [
  "Liebherr", "Volvo", "Caterpillar", "CAT", "Scania", "MAN", "Mercedes-Benz", "Mercedes", "DAF",
  "Iveco", "Renault", "Komatsu", "JCB", "Hitachi", "Case", "New Holland", "Fendt", "John Deere",
  "Claas", "Manitou", "Bobcat", "Doosan", "Hyundai", "Kubota", "Schmitz", "Krone", "Kogel", "Kögel",
  "Wielton", "Bomag", "Hamm", "Dynapac", "Terex", "Atlas", "Merlo", "Massey Ferguson", "Deutz",
];

// VINs never contain I, O, Q: OCR confuses them with 1 and 0.
function fixVin(s: string) {
  return s.replace(/[IL]/g, "1").replace(/[OQ]/g, "0");
}

/** Best-effort extraction from raw OCR text; returns only what looks reliable. */
function parsePlate(raw: string): PlateData {
  const text = raw.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: PlateData = {
    chassis_vin: null, make: null, model: null, series: null, engine_code: null,
    year: null, engine_capacity: null, engine_power_kw: null, plate_no: null, notes: null,
  };

  // VIN: 17 chars, no I/O/Q
  const vinRe = /[A-HJ-NPR-Z0-9]{17}/;
  const compact = lines.map((l) => fixVin(l.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  for (const c of [...compact, compact.join("")]) {
    const m = c.match(vinRe);
    // a real VIN has plenty of digits; this rejects 17-letter header text
    if (m && (m[0].match(/\d/g) || []).length >= 5) {
      out.chassis_vin = m[0];
      break;
    }
  }

  // kW
  const kw = text.match(/(\d{2,3})\s*kW/i);
  if (kw) out.engine_power_kw = Number(kw[1]);

  // Year: next to manufacture keywords, else a lone plausible year
  const yearRe = /\b(19[89]\d|20[0-3]\d)\b/;
  const yearLine = lines.findIndex((l) => /manufact|fabrication|baujahr|bj\.?|year/i.test(l));
  const near = yearLine >= 0 ? lines.slice(Math.max(0, yearLine - 1), yearLine + 3).join(" ") : "";
  const ym = near.match(yearRe) || text.match(yearRe);
  if (ym) out.year = Number(ym[1]);

  // Make
  const low = text.toLowerCase();
  const make = MAKES.find((m) => new RegExp(`\\b${m.toLowerCase()}\\b`).test(low));
  if (make) out.make = make === "Kogel" ? "Kögel" : make;

  // Model: short letters+digits token (e.g. L514); skip the VIN and plain numbers
  for (const l of lines) {
    for (const t of l.toUpperCase().split(/\s+/)) {
      if (/^[A-Z]{1,3}-?\d{2,4}[A-Z]?$/.test(t) && !(out.chassis_vin || "").includes(t)) {
        out.model = t;
        break;
      }
    }
    if (out.model) break;
  }

  const cc = text.match(/(\d{3,5})\s*(cm3|cm³|ccm|cc)\b/i);
  if (cc) out.engine_capacity = Number(cc[1]);

  return out;
}

/**
 * Upload a nameplate photo, optionally save it on the customer, and read the
 * vehicle data from it (OCR in the browser). Plates differ, so only what is
 * recognised with confidence is returned.
 */
export default function VehiclePlateReader({
  accountId,
  onResult,
}: {
  accountId?: string;
  onResult: (d: PlateData) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveToCustomer(f: File) {
    if (!accountId) return;
    const base = `/api/admin/accounts/${accountId}/attachments`;
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const up = await (
      await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "upload-url", ext }),
      })
    ).json();
    if (!up.ok) throw new Error(up.error || "Nu s-a putut salva imaginea.");
    const put = await fetch(up.signedUrl, {
      method: "PUT",
      headers: { "content-type": f.type || "application/octet-stream" },
      body: f,
    });
    if (!put.ok) throw new Error("Nu s-a putut salva imaginea.");
    const reg = await (
      await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "register", storage_path: up.path, file_name: f.name }),
      })
    ).json();
    if (!reg.ok) throw new Error(reg.error || "Nu s-a putut salva imaginea.");
    setSaved(true);
  }

  async function pick(f: File) {
    setFile(f);
    setSaved(false);
    setMessage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    try {
      await saveToCustomer(f);
    } catch (e: any) {
      setMessage({ ok: false, text: e?.message || "Nu s-a putut salva imaginea." });
    }
  }

  async function read() {
    if (!file) return;
    setReading(true);
    setMessage(null);
    try {
      const canvas = await toCanvas(file);
      // loaded on demand so it doesn't weigh on the rest of the page
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      let text = "";
      try {
        const res = await worker.recognize(canvas);
        text = res.data.text || "";
      } finally {
        await worker.terminate();
      }

      const d: PlateData = parsePlate(text);
      onResult(d);

      const found = [
        d.chassis_vin && "VIN",
        d.make && "marcă",
        d.model && "model",
        d.series && "serie",
        d.engine_code && "motor",
        d.year && `an ${d.year}`,
        d.engine_capacity && "capacitate",
        d.engine_power_kw && `${d.engine_power_kw} kW`,
        d.plate_no && "nr. înmatriculare",
      ].filter(Boolean);
      setMessage({
        ok: found.length > 0,
        text:
          found.length > 0
            ? `Completat: ${found.join(", ")}. Verifică datele înainte de salvare.${d.notes ? ` Notă: ${d.notes}` : ""}`
            : "Nu am găsit date lizibile în imagine.",
      });
    } catch (e: any) {
      setMessage({ ok: false, text: e?.message || "Eroare la citire." });
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
          Încarcă poză plăcuță
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) pick(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={read}
          disabled={!file || reading}
          className="rounded-full bg-[#feab1f] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#e09800] disabled:opacity-50"
        >
          {reading ? "Se citește…" : "Citește datele din poză"}
        </button>
        {file && (
          <span className="text-xs text-slate-700">
            {file.name}
            {saved ? " · salvată la client" : accountId ? "" : " · alege un client ca să o salvezi"}
          </span>
        )}
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Plăcuță" className="mt-3 max-h-40 rounded-lg border border-slate-200" />
      )}

      {message && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
