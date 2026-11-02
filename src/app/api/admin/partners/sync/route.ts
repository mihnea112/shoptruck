import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/**
 * POST /api/admin/partners/sync
 *
 * Syncs existing data into the partner table:
 * 1. All accounts → partner (CLIENT, discount 0)
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

    // ── 2. Sync clients from the account table ──────────────
    // (the old profile-based steps keyed partner.account_id on profile.user_id, which
    // differs from account.id and created a duplicate partner for every client)
    const accounts = await sql`
      SELECT
        a.id, a.kind, a.display_name, a.legal_name,
        a.email, a.phone, a.tax_id, a.reg_no, a.is_vat_payer
      FROM account a
      WHERE NOT EXISTS (
        SELECT 1 FROM partner p WHERE p.account_id = a.id OR p.account_id = a.user_id
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
