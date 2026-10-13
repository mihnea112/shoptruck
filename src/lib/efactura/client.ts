import "server-only";
import { XMLParser } from "fast-xml-parser";
import { getAccessToken } from "./oauth";
import { isEfacturaEnv } from "./config";

/**
 * Thin wrapper over ANAF's RO e-Factura REST API (OAuth2 variant, api.anaf.ro).
 * Endpoints and response shapes follow ANAF's published "Prezentare servicii web ... RO e-Factura" spec.
 *
 * NOTE: `upload`/`stareMesaj`/`validare` responses are XML with a single <header> element carrying
 * attributes (ExecutionStatus / stare / index_incarcare / id_descarcare / errors). `listaMesajeFactura`
 * returns JSON. `descarcare` returns a raw zip. Attribute names here match ANAF's current spec —
 * verify against the test environment before relying on this in production, ANAF has changed
 * response shapes across versions before.
 */

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function apiBase() {
  return `https://api.anaf.ro/${isEfacturaEnv()}/FCTEL/rest`;
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export type UploadResult =
  | { ok: true; uploadId: string }
  | { ok: false; error: string };

/** Uploads a UBL invoice XML. Pass isB2C=true to use the B2C reporting endpoint instead of the standard B2B one. */
export async function uploadInvoice(xml: string, cif: string, isB2C: boolean): Promise<UploadResult> {
  const path = isB2C ? "uploadb2c" : "upload";
  const params = new URLSearchParams({ standard: "UBL", cif });
  const res = await authedFetch(`${apiBase()}/${path}?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: xml,
  });
  const text = await res.text();

  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 500)}` };

  let parsed: any;
  try {
    parsed = xmlParser.parse(text);
  } catch {
    return { ok: false, error: `Raspuns neasteptat de la ANAF: ${text.slice(0, 500)}` };
  }

  const header = parsed?.header;
  if (!header) return { ok: false, error: `Raspuns neasteptat de la ANAF: ${text.slice(0, 500)}` };

  const status = header["@_ExecutionStatus"];
  if (status === "0" && header["@_index_incarcare"]) {
    return { ok: true, uploadId: String(header["@_index_incarcare"]) };
  }

  const errors = header.Errors;
  const errList = Array.isArray(errors) ? errors : errors ? [errors] : [];
  const errMsg = errList.map((e: any) => e["@_errorMessage"]).filter(Boolean).join("; ") || text.slice(0, 500);
  return { ok: false, error: errMsg };
}

export type MessageStatus = "ok" | "nok" | "in_prelucrare" | "eroare";

export type StatusResult = {
  stare: MessageStatus;
  downloadId?: string;
  raw: string;
};

/** Checks the processing status of a previously uploaded invoice. */
export async function checkStatus(uploadId: string): Promise<StatusResult> {
  const res = await authedFetch(`${apiBase()}/stareMesaj?id_incarcare=${encodeURIComponent(uploadId)}`);
  const text = await res.text();

  let parsed: any;
  try {
    parsed = xmlParser.parse(text);
  } catch {
    return { stare: "eroare", raw: text };
  }

  const header = parsed?.header;
  const stareRaw = String(header?.["@_stare"] || "").toLowerCase();
  const downloadId = header?.["@_id_descarcare"] ? String(header["@_id_descarcare"]) : undefined;

  let stare: MessageStatus = "eroare";
  if (stareRaw === "ok") stare = "ok";
  else if (stareRaw === "nok") stare = "nok";
  else if (stareRaw.includes("prelucrare")) stare = "in_prelucrare";

  return { stare, downloadId, raw: text };
}

export type MesajListItem = {
  id: string;
  idSolicitare: string;
  tip: string;
  detalii: string;
  cifEmitent?: string;
  cifBeneficiar?: string;
  dataCreare?: string;
};

/** Lists messages (responses) available for download in the last `days` days for the given CIF. */
export async function listMessages(cif: string, days: number, filtru?: "E" | "T" | "P" | "R"): Promise<MesajListItem[]> {
  const params = new URLSearchParams({ zile: String(days), cif });
  if (filtru) params.set("filtru", filtru);
  const res = await authedFetch(`${apiBase()}/listaMesajeFactura?${params.toString()}`);
  const data = await res.json().catch(() => null);
  const mesaje = data?.mesaje;
  if (!Array.isArray(mesaje)) return [];
  return mesaje.map((m: any) => ({
    id: String(m.id),
    idSolicitare: String(m.id_solicitare),
    tip: String(m.tip || ""),
    detalii: String(m.detalii || ""),
    cifEmitent: m.cif_emitent,
    cifBeneficiar: m.cif_beneficiar,
    dataCreare: m.data_creare,
  }));
}

/** Downloads the response zip (signed invoice, or error report, + MF signature) for a message id. */
export async function downloadResponse(id: string): Promise<Buffer> {
  const res = await authedFetch(`${apiBase()}/descarcare?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Descarcare ANAF esuata: HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export type ValidationResult = { valid: boolean; errors: string[]; raw: string };

/** Validates a UBL XML without submitting it. `standard` is FACT1 (invoice) or FCN (credit note). */
export async function validateXml(xml: string, standard: "FACT1" | "FCN" = "FACT1"): Promise<ValidationResult> {
  const res = await authedFetch(`${apiBase()}/validare/${standard}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: xml,
  });
  const text = await res.text();

  let parsed: any;
  try {
    parsed = xmlParser.parse(text);
  } catch {
    return { valid: false, errors: [text.slice(0, 1000)], raw: text };
  }

  const header = parsed?.header;
  const state = String(header?.["@_stare"] || "").toLowerCase();
  if (state === "ok") return { valid: true, errors: [], raw: text };

  const errors = header?.Errors;
  const errList = Array.isArray(errors) ? errors : errors ? [errors] : [];
  return {
    valid: false,
    errors: errList.map((e: any) => e["@_errorMessage"]).filter(Boolean),
    raw: text,
  };
}
