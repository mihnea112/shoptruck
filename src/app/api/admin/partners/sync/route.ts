import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";
import { encryptPII, decryptPII } from "@/lib/crypto/pii";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/**
 * POST /api/admin/partners/sync
 *
 * Syncs existing data into the partner table:
 * 1. All company profiles → partner (CLIENT, discount 0)
 * 2. All distinct supplier names from goods_receipt → partner (SUPPLIER)
 *
 * Uses ON CONFLICT to avoid duplicates on re-sync.
 */
export async function POST(req: Request) {
  try {
    await requireStaff(req);

    let clientsAdded = 0;
    let suppliersAdded = 0;
    let skipped = 0;

    // ── 1. Sync company profiles as CLIENTs ──────────────────
    // Pull all profiles with kind='company' (or COMPANY)
    const companyProfiles = await sql`
      SELECT
        p.user_id,
        p.email,
        p.display_name,
        p.legal_name,
        p.phone,
        p.tax_id,
        p.reg_no,
        p.notes,
        p.full_name
      FROM profile p
      WHERE LOWER(p.kind) = 'company'
        AND p.is_active = true
    ` as any[];

    for (const prof of companyProfiles) {
      const displayName = prof.display_name || prof.legal_name || prof.full_name || prof.email;
      if (!displayName) { skipped++; continue; }

      // Check if partner already exists (by account link or tax_id match)
      const existing = await sql`
        SELECT id FROM partner
        WHERE account_id = ${prof.user_id}::uuid
           OR (tax_id IS NOT NULL AND tax_id = ${prof.tax_id} AND tax_id != '')
        LIMIT 1
      ` as any[];

      if (existing.length > 0) { skipped++; continue; }

      await sql`
        INSERT INTO partner (
          partner_type, kind, display_name, legal_name,
          email, phone, tax_id, reg_no,
          account_id, credit_days, credit_limit
        ) VALUES (
          'CLIENT', 'COMPANY', ${displayName}, ${prof.legal_name || displayName},
          ${prof.email}, ${encryptPII(prof.phone)}, ${encryptPII(prof.tax_id)}, ${encryptPII(prof.reg_no)},
          ${prof.user_id}::uuid, 0, 0
        )
      `;
      clientsAdded++;
    }

    // ── 2. Sync individual profiles as CLIENTs ───────────────
    const individualProfiles = await sql`
      SELECT
        p.user_id,
        p.email,
        p.display_name,
        p.full_name,
        p.phone
      FROM profile p
      WHERE (LOWER(p.kind) = 'individual' OR LOWER(p.kind) = 'customer')
        AND p.is_active = true
    ` as any[];

    for (const prof of individualProfiles) {
      const displayName = prof.display_name || prof.full_name || prof.email;
      if (!displayName) { skipped++; continue; }

      const existing = await sql`
        SELECT id FROM partner WHERE account_id = ${prof.user_id}::uuid LIMIT 1
      ` as any[];

      if (existing.length > 0) { skipped++; continue; }

      await sql`
        INSERT INTO partner (
          partner_type, kind, display_name,
          email, phone, account_id, credit_days, credit_limit
        ) VALUES (
          'CLIENT', 'INDIVIDUAL', ${displayName},
          ${prof.email}, ${encryptPII(prof.phone)}, ${prof.user_id}::uuid, 0, 0
        )
      `;
      clientsAdded++;
    }

    // ── 3. Sync supplier names from goods_receipt ────────────
    const suppliers = await sql`
      SELECT DISTINCT supplier_name
      FROM goods_receipt
      WHERE supplier_name IS NOT NULL AND supplier_name != ''
      ORDER BY supplier_name
    ` as any[];

    for (const s of suppliers) {
      const name = (s.supplier_name || "").trim();
      if (!name) { skipped++; continue; }

      // Check if already exists by display_name match
      const existing = await sql`
        SELECT id FROM partner
        WHERE display_name = ${name}
          AND (partner_type = 'SUPPLIER' OR partner_type = 'BOTH')
        LIMIT 1
      ` as any[];

      if (existing.length > 0) { skipped++; continue; }

      await sql`
        INSERT INTO partner (
          partner_type, kind, display_name, legal_name,
          credit_days, credit_limit
        ) VALUES (
          'SUPPLIER', 'COMPANY', ${name}, ${name},
          0, 0
        )
      `;
      suppliersAdded++;
    }

    // ── 4. Sync from account table (if any exist there) ─────
    const accounts = await sql`
      SELECT
        a.id, a.kind, a.display_name, a.legal_name,
        a.email, a.phone, a.tax_id, a.reg_no, a.is_vat_payer
      FROM account a
      WHERE NOT EXISTS (
        SELECT 1 FROM partner p WHERE p.account_id = a.id
      )
    ` as any[];

    for (const acc of accounts) {
      const displayName = acc.display_name || acc.legal_name || acc.email;
      if (!displayName) { skipped++; continue; }

      const kind = (acc.kind || "").toUpperCase() === "COMPANY" ? "COMPANY" : "INDIVIDUAL";

      await sql`
        INSERT INTO partner (
          partner_type, kind, display_name, legal_name,
          email, phone, tax_id, reg_no, is_vat_payer,
          account_id, credit_days, credit_limit
        ) VALUES (
          'CLIENT', ${kind}, ${displayName}, ${acc.legal_name || displayName},
          ${acc.email}, ${acc.phone}, ${acc.tax_id}, ${acc.reg_no},
          ${acc.is_vat_payer === true}, ${acc.id}::uuid, 0, 0
        )
      `;
      clientsAdded++;
    }

    return json({
      ok: true,
      synced: { clients_added: clientsAdded, suppliers_added: suppliersAdded, skipped },
    });
  } catch (e: any) {
    console.error("Partner sync error:", e);
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}
