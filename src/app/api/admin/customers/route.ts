import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    await requireStaff(req);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limitRaw = Number(searchParams.get("limit") || 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    if (q.length < 2) return json({ ok: true, items: [] });

    const term = `%${q}%`;

    // Schema (din dump):
    // customer(id, kind, user_id)
    // customer_company(customer_id, company_name, vat_id, reg_no, contact_name, contact_phone, contact_email)
    // customer_individual(customer_id, first_name, last_name, phone)
    // app_user(id, email)
    const rows = await sql`
      SELECT
        c.id,
        c.kind,
        COALESCE(cc.company_name, CONCAT(ci.first_name, ' ', ci.last_name)) AS display_name,
        cc.vat_id,
        cc.reg_no,
        COALESCE(ci.phone, cc.contact_phone) AS phone,
        COALESCE(cc.contact_email::text, au.email::text) AS email
      FROM customer c
      LEFT JOIN customer_company cc ON cc.customer_id = c.id
      LEFT JOIN customer_individual ci ON ci.customer_id = c.id
      LEFT JOIN app_user au ON au.id = c.user_id
      WHERE
        -- company matches
        (cc.company_name ILIKE ${term})
        OR (cc.vat_id ILIKE ${term})
        OR (cc.reg_no ILIKE ${term})
        OR (cc.contact_name ILIKE ${term})
        OR (cc.contact_phone ILIKE ${term})
        OR (cc.contact_email::text ILIKE ${term})
        OR (au.email::text ILIKE ${term})
        -- individual matches
        OR (ci.first_name ILIKE ${term})
        OR (ci.last_name ILIKE ${term})
        OR (CONCAT(ci.first_name, ' ', ci.last_name) ILIKE ${term})
        OR (ci.phone ILIKE ${term})
      ORDER BY display_name NULLS LAST
      LIMIT ${limit}
    `;

    return json({ ok: true, items: rows });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}