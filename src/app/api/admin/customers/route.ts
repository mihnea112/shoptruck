import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeKind(v: unknown): "COMPANY" | "INDIVIDUAL" | null {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  if (s === "COMPANY" || s === "FIRMA") return "COMPANY";
  if (s === "INDIVIDUAL" || s === "PERSON" || s === "PERSOANA" || s === "PF") return "INDIVIDUAL";
  return null;
}

function cleanText(v: unknown, max = 200) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function toBool(v: unknown) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "da") return true;
  if (s === "false" || s === "0" || s === "no" || s === "nu") return false;
  return null;
}

export async function GET(req: Request) {
  try {
    await requireStaff(req);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const limitRaw = Number(searchParams.get("limit") || 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 50)
      : 20;

    // For autocomplete UX: don’t hit DB on tiny queries
    if (q.length < 2) return json({ ok: true, items: [] });

    const term = `%${q}%`;

    // New schema:
    // account(id, kind, display_name, legal_name, email, phone, tax_id, reg_no, is_vat_payer, ...)
    const rows = await sql`
      SELECT
        a.id,
        a.kind,
        a.display_name,
        a.legal_name,
        a.email,
        a.phone,
        a.tax_id,
        a.reg_no,
        a.is_vat_payer,
        a.created_at
      FROM account a
      WHERE
        a.display_name ILIKE ${term}
        OR (a.legal_name IS NOT NULL AND a.legal_name ILIKE ${term})
        OR (a.email IS NOT NULL AND a.email ILIKE ${term})
        OR (a.phone IS NOT NULL AND a.phone ILIKE ${term})
        OR (a.tax_id IS NOT NULL AND a.tax_id ILIKE ${term})
        OR (a.reg_no IS NOT NULL AND a.reg_no ILIKE ${term})
      ORDER BY a.display_name NULLS LAST
      LIMIT ${limit}
    `;

    return json({ ok: true, items: rows, limit });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff(req);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json(
        { ok: false, error: "Content-Type invalid. Folosește application/json." },
        415
      );
    }

    const body = await req.json().catch(() => null);
    const kind = normalizeKind(body?.kind) ?? normalizeKind(body?.type);

    if (!kind) {
      return json(
        { ok: false, error: "Tip client invalid. Folosește COMPANY sau INDIVIDUAL." },
        400
      );
    }

    // Common fields
    const displayName = cleanText(body?.display_name ?? body?.displayName ?? body?.name, 200);
    const legalName = cleanText(body?.legal_name ?? body?.legalName, 200);
    const email = cleanText(body?.email, 200);
    const phone = cleanText(body?.phone, 60);

    // Company-ish
    const taxId = cleanText(body?.tax_id ?? body?.taxId ?? body?.vat_id ?? body?.vatId, 60);
    const regNo = cleanText(body?.reg_no ?? body?.regNo, 80);

    const isVatPayerRaw = toBool(body?.is_vat_payer ?? body?.isVatPayer);
    const isVatPayer = isVatPayerRaw ?? false;

    // Address fields
    const billingLine1 = cleanText(body?.billing_line1 ?? body?.billingLine1, 300);
    const billingCity = cleanText(body?.billing_city ?? body?.billingCity, 100);
    const billingZip = cleanText(body?.billing_zip ?? body?.billingZip, 20);
    const billingCountry = cleanText(body?.billing_country ?? body?.billingCountry, 100) ?? "Romania";

    if (!displayName || displayName.length < 2) {
      return json({ ok: false, error: "Numele clientului este obligatoriu." }, 400);
    }

    if (!email) {
      return json({ ok: false, error: "Adresa de email este obligatorie." }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ ok: false, error: "Adresa de email nu este validă." }, 400);
    }

    // For INDIVIDUAL: legal_name optional; for COMPANY: legal_name defaults to display_name
    const finalLegalName = kind === "COMPANY" ? (legalName ?? displayName) : legalName;

    try {
      const rows = await sql`
        INSERT INTO account (
          kind,
          display_name,
          legal_name,
          email,
          phone,
          tax_id,
          reg_no,
          is_vat_payer,
          billing_line1,
          billing_city,
          billing_zip,
          billing_country,
          updated_at
        )
        VALUES (
          ${kind},
          ${displayName},
          ${finalLegalName},
          ${email},
          ${phone},
          ${taxId},
          ${regNo},
          ${isVatPayer},
          ${billingLine1},
          ${billingCity},
          ${billingZip},
          ${billingCountry},
          now()
        )
        RETURNING id
      `;

      const id = (rows as any[])?.[0]?.id as string | undefined;
      if (!id) return json({ ok: false, error: "Eroare internă." }, 500);

      return json({ ok: true, id, customerId: id }, 201);
    } catch (e: any) {
      // ux_account_tax_id can throw 23505
      const msg =
        e?.code === "23505"
          ? "Date duplicate (ex: CUI/VAT deja există)."
          : "Eroare internă.";
      return json({ ok: false, error: msg }, 500);
    }
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}