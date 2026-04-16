// src/app/api/admin/warehouses/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    await requireStaff(req, ["admin", "sales_rep"]);

    const rows = await sql`
      SELECT
        w.id,
        w.code,
        w.name,
        w.address,
        w.is_active,
        w.created_at,
        COUNT(DISTINCT ib.product_id)::int          AS products_count,
        COALESCE(SUM(ib.stock_on_hand), 0)          AS total_on_hand,
        COALESCE(SUM(ib.stock_reserved), 0)         AS total_reserved,
        COUNT(DISTINCT wu.user_id)::int             AS users_count
      FROM warehouse w
      LEFT JOIN inventory_balance ib ON ib.warehouse_id = w.id
      LEFT JOIN warehouse_user wu    ON wu.warehouse_id  = w.id
      GROUP BY w.id
      ORDER BY w.created_at ASC
    `;

    return json({ ok: true, items: rows });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "Eroare." },
      Number(e?.status ?? 500),
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const body = await req.json().catch(() => null);
    const code = String(body?.code ?? "")
      .trim()
      .toUpperCase();
    const name = String(body?.name ?? "").trim();
    const address = body?.address ? String(body.address).trim() : null;
    const is_active = body?.is_active !== false;

    if (!code || code.length < 2)
      return json(
        { ok: false, error: "Codul este obligatoriu (min 2 caractere)." },
        400,
      );
    if (!name || name.length < 2)
      return json({ ok: false, error: "Numele este obligatoriu." }, 400);

    const rows = await sql`
      INSERT INTO warehouse (code, name, address, is_active)
      VALUES (${code}, ${name}, ${address}, ${is_active})
      RETURNING id
    `;

    return json({ ok: true, id: (rows as any[])[0]?.id });
  } catch (e: any) {
    const msg =
      e?.code === "23505"
        ? "Codul de depozit există deja."
        : e?.message || "Eroare.";
    return json({ ok: false, error: msg }, 500);
  }
}
