import "server-only";
import { sql } from "@/lib/db";
import { decryptPII } from "@/lib/crypto/pii";
import { buildInvoiceXml, type UblCustomer, type UblInvoiceLine } from "./ubl";
import { uploadInvoice, validateXml, checkStatus, listMessages, downloadResponse } from "./client";
import { getSeller } from "./config";

async function loadInvoice(id: string) {
  const rows = (await sql`
    SELECT
      i.id, i.invoice_type, i.series, i.number, i.invoice_date, i.due_date,
      i.tax_rate_pct, i.total_net, i.total_tax, i.total_gross, i.notes,
      i.is_b2c, i.anaf_upload_id, i.anaf_download_id, i.anaf_status, i.anaf_status_detail,
      i.anaf_uploaded_at, i.anaf_checked_at,
      a.kind AS account_kind, a.display_name, a.legal_name, a.tax_id, a.reg_no, a.is_vat_payer,
      a.billing_line1, a.billing_city, a.billing_country
    FROM invoice i
    JOIN account a ON a.id = i.account_id
    WHERE i.id = ${id}::uuid
    LIMIT 1
  `) as any[];
  return rows[0] || null;
}

async function loadItems(id: string) {
  return (await sql`
    SELECT code, name, uom, quantity, unit_price_net, line_net, tax_rate
    FROM invoice_item
    WHERE invoice_id = ${id}::uuid
    ORDER BY sort_order ASC
  `) as any[];
}

export type SendResult =
  | { ok: true; uploadId: string; status: "trimisa" }
  | { ok: false; error: string; validationErrors?: string[] };

/**
 * Builds the UBL XML for an invoice, validates it against ANAF's /validare endpoint, and —
 * only if valid — submits it via upload/uploadb2c. Used both by the manual admin "Trimite la
 * ANAF" action and by the automatic post-payment flow.
 */
export async function sendInvoiceToAnaf(invoiceId: string): Promise<SendResult> {
  const inv = await loadInvoice(invoiceId);
  if (!inv) return { ok: false, error: "Factura nu a fost gasita." };

  if (inv.invoice_type === "proforma") {
    return { ok: false, error: "Facturile proforma nu se trimit la e-Factura (nu sunt document fiscal)." };
  }
  if (inv.anaf_status === "trimisa" || inv.anaf_status === "ok") {
    return { ok: false, error: "Factura a fost deja trimisa la ANAF." };
  }

  const items = await loadItems(invoiceId);
  if (!items.length) return { ok: false, error: "Factura nu are produse." };

  const isCompany = String(inv.account_kind || "").toUpperCase() === "COMPANY";
  const cif = decryptPII(inv.tax_id);

  const customer: UblCustomer = {
    isCompany,
    displayName: inv.display_name,
    legalName: inv.legal_name || inv.display_name,
    cif: cif ? cif.replace(/^RO/i, "").trim() : null,
    isVatPayer: Boolean(inv.is_vat_payer),
    address: decryptPII(inv.billing_line1),
    city: inv.billing_city,
    country: inv.billing_country || "RO",
  };

  const lines: UblInvoiceLine[] = items.map((it: any) => ({
    name: it.name,
    code: it.code,
    uom: it.uom,
    quantity: Number(it.quantity),
    unitPriceNet: Number(it.unit_price_net),
    lineNet: Number(it.line_net),
    taxRatePct: Number(inv.tax_rate_pct),
  }));

  const invoiceDate = new Date(inv.invoice_date).toISOString().slice(0, 10);
  const dueDate = inv.due_date ? new Date(inv.due_date).toISOString().slice(0, 10) : null;

  const xml = buildInvoiceXml({
    id: `${inv.series}-${inv.number}`,
    issueDate: invoiceDate,
    dueDate,
    taxRatePct: Number(inv.tax_rate_pct),
    totalNet: Number(inv.total_net),
    totalTax: Number(inv.total_tax),
    totalGross: Number(inv.total_gross),
    notes: inv.notes,
    customer,
    lines,
  });

  const isB2C = !isCompany;
  const seller = getSeller();
  if (!seller.cif) return { ok: false, error: "ANAF_SELLER_CIF nu este configurat." };

  const validation = await validateXml(xml, "FACT1");
  if (!validation.valid) {
    const detail = validation.errors.join("; ") || "XML invalid.";
    await sql`
      UPDATE invoice
      SET anaf_status = 'eroare', anaf_status_detail = ${detail}, anaf_xml = ${xml}, is_b2c = ${isB2C}
      WHERE id = ${invoiceId}::uuid
    `;
    return { ok: false, error: `XML invalid: ${detail}`, validationErrors: validation.errors };
  }

  const result = await uploadInvoice(xml, seller.cif, isB2C);

  if (!result.ok) {
    await sql`
      UPDATE invoice
      SET anaf_status = 'eroare', anaf_status_detail = ${result.error}, anaf_xml = ${xml}, is_b2c = ${isB2C}
      WHERE id = ${invoiceId}::uuid
    `;
    return { ok: false, error: result.error };
  }

  await sql`
    UPDATE invoice
    SET anaf_upload_id = ${result.uploadId},
        anaf_status = 'trimisa',
        anaf_status_detail = NULL,
        anaf_xml = ${xml},
        is_b2c = ${isB2C},
        anaf_uploaded_at = now(),
        anaf_checked_at = now()
    WHERE id = ${invoiceId}::uuid
  `;

  return { ok: true, uploadId: result.uploadId, status: "trimisa" };
}

export type StatusCheckResult = {
  ok: true;
  status: string | null;
  detail?: string | null;
  uploadId?: string | null;
  downloadId?: string | null;
  checkedAt?: string | null;
};

/** Re-checks ANAF's processing status for an already-uploaded invoice and persists the result. */
export async function refreshAnafStatus(invoiceId: string): Promise<StatusCheckResult | { ok: false; error: string }> {
  const inv = await loadInvoice(invoiceId);
  if (!inv) return { ok: false, error: "Factura nu a fost gasita." };

  if (!inv.anaf_upload_id) return { ok: true, status: null };

  if (inv.anaf_status !== "trimisa") {
    return {
      ok: true,
      status: inv.anaf_status,
      detail: inv.anaf_status_detail,
      uploadId: inv.anaf_upload_id,
      checkedAt: inv.anaf_checked_at,
    };
  }

  const result = await checkStatus(inv.anaf_upload_id);

  if (result.stare === "in_prelucrare") {
    await sql`UPDATE invoice SET anaf_checked_at = now() WHERE id = ${invoiceId}::uuid`;
    return { ok: true, status: "trimisa", checkedAt: new Date().toISOString() };
  }

  let downloadId = result.downloadId;
  if (!downloadId) {
    const seller = getSeller();
    const messages = await listMessages(seller.cif, 60);
    downloadId = messages.find((m) => m.idSolicitare === inv.anaf_upload_id)?.id;
  }

  const newStatus = result.stare === "ok" ? "ok" : "nok";

  let responseZipB64: string | null = null;
  if (downloadId) {
    try {
      responseZipB64 = (await downloadResponse(downloadId)).toString("base64");
    } catch (e: any) {
      console.error("[efactura] descarcare failed:", e?.message);
    }
  }

  await sql`
    UPDATE invoice
    SET anaf_status = ${newStatus},
        anaf_download_id = ${downloadId || null},
        anaf_response_xml = ${responseZipB64},
        anaf_checked_at = now()
    WHERE id = ${invoiceId}::uuid
  `;

  return { ok: true, status: newStatus, downloadId, checkedAt: new Date().toISOString() };
}
