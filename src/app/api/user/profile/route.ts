import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireCustomer } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function PUT(req: Request) {
  try {
    const user = await requireCustomer(req);

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Cerere invalidă" }, 400);

    const { firstName, lastName, email, phone, address, city, postalCode, country, companyName, legalName, taxId, regNo } = body;

    const fullName = `${lastName || ""} ${firstName || ""}`.trim() || null;
    const displayName = companyName || fullName || null;

    // Update the account table (single source of truth)
    const updated = await sql`
      UPDATE account SET
        display_name = ${displayName},
        legal_name = ${legalName || displayName},
        full_name = ${fullName},
        email = ${email || null},
        phone = ${phone || null},
        tax_id = ${taxId || null},
        reg_no = ${regNo || null},
        billing_line1 = ${address || null},
        billing_city = ${city || null},
        billing_zip = ${postalCode || null},
        billing_country = ${country || null},
        updated_at = now()
      WHERE user_id = ${user.userId}::uuid
      RETURNING id
    ` as any[];

    if (updated.length === 0) {
      // No account row yet — create one
      await sql`
        INSERT INTO account (user_id, kind, display_name, legal_name, full_name, email, phone, tax_id, reg_no, billing_line1, billing_city, billing_zip, billing_country, roles, is_active)
        VALUES (
          ${user.userId}::uuid,
          ${companyName ? "COMPANY" : "INDIVIDUAL"},
          ${displayName},
          ${legalName || displayName},
          ${fullName},
          ${email || null},
          ${phone || null},
          ${taxId || null},
          ${regNo || null},
          ${address || null},
          ${city || null},
          ${postalCode || null},
          ${country || null},
          ARRAY[]::TEXT[],
          true
        )
      `;
    }

    return json({ ok: true, message: "Profil actualizat cu succes" }, 200);
  } catch (e: any) {
    console.error("[API user profile PUT]", e);
    return json({ error: e?.message || "Eroare la salvare" }, e?.status ?? 500);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireCustomer(req);

    const accRows = await sql`
      SELECT id, kind, display_name, legal_name, full_name, email, phone, tax_id, reg_no,
             billing_line1, billing_city, billing_zip, billing_country
      FROM account
      WHERE user_id = ${user.userId}::uuid
      LIMIT 1
    ` as any[];

    const acc = accRows[0];

    if (!acc) {
      return json({
        firstName: "",
        lastName: "",
        email: user.email,
        phone: "",
        address: "",
        city: "",
        postalCode: "",
        country: "România",
        kind: null,
        companyName: "",
        legalName: "",
        taxId: "",
        regNo: "",
      });
    }

    const nameParts = (acc.full_name || acc.display_name || "").trim().split(/\s+/);
    const lastName = nameParts[0] || "";
    const firstName = nameParts.slice(1).join(" ") || "";
    const kindLower = (acc.kind || "").toLowerCase();

    return json({
      firstName,
      lastName,
      email: acc.email || user.email,
      phone: acc.phone || "",
      address: acc.billing_line1 || "",
      city: acc.billing_city || "",
      postalCode: acc.billing_zip || "",
      country: acc.billing_country || "România",
      kind: kindLower || null,
      companyName: kindLower === "company" ? acc.display_name : "",
      legalName: acc.legal_name || "",
      taxId: acc.tax_id || "",
      regNo: acc.reg_no || "",
    });
  } catch (e: any) {
    console.error("[API user profile GET]", e);
    return json({ error: e?.message || "Eroare la citire" }, e?.status ?? 500);
  }
}
