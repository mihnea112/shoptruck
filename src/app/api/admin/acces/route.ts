import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

// GET — list ALL users from profile (staff + customers)
export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const rows = await sql`
      SELECT
        p.user_id,
        COALESCE(p.full_name, '') AS full_name,
        COALESCE(p.email, '')     AS email,
        COALESCE(p.roles, '{}')   AS roles,
        COALESCE(p.is_active, true) AS is_active,
        p.created_at
      FROM profile p
      ORDER BY
        CASE WHEN array_length(p.roles, 1) > 0 THEN 0 ELSE 1 END,
        p.full_name ASC,
        p.email ASC
    `;

    return json({ ok: true, items: rows });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}

// PATCH — update roles + active status for a user
export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => null);
    const userId = String(body?.userId ?? body?.user_id ?? "").trim();
    const isActive = body?.is_active != null ? Boolean(body.is_active) : null;
    const roles = Array.isArray(body?.roles)
      ? body.roles.map((r: any) => String(r).trim().toUpperCase()).filter(Boolean)
      : null;

    if (!userId) return json({ ok: false, error: "userId lipsă." }, 400);

    await sql`
      UPDATE profile SET
        roles      = CASE WHEN ${roles !== null} THEN ${roles}::text[]   ELSE roles      END,
        is_active  = CASE WHEN ${isActive !== null} THEN ${isActive}     ELSE is_active  END,
        updated_at = now()
      WHERE user_id = ${userId}::uuid
    `;

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, 500);
  }
}
