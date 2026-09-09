import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/**
 * GET /api/admin/partners/defaults?orderId=xxx
 *
 * Returns the partner's commercial defaults (delivery_method, payment_method, credit_days)
 * for the account associated with the given order.
 * Falls back to empty if no partner is found.
 */
export async function GET(req: Request) {
  try {
    await requireStaff(req);
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) return json({ ok: false, error: "orderId lipsă." }, 400);

    // Get account_id from order, then find partner by account_id
    const rows = await sql`
      SELECT
        p.delivery_method,
        p.payment_method,
        p.credit_days,
        p.credit_limit,
        p.has_credit,
        p.blocked_billing,
        dc.name AS discount_class_name,
        dc.discount_pct
      FROM "order" o
      JOIN partner p ON p.account_id = o.account_id AND p.is_active = true
      LEFT JOIN discount_class dc ON dc.id = p.discount_class_id
      WHERE o.id = ${orderId}::uuid
      LIMIT 1
    ` as any[];

    if (!rows.length) {
      return json({ ok: true, defaults: null });
    }

    return json({ ok: true, defaults: rows[0] });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}
