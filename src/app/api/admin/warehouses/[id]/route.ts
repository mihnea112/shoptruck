// src/app/api/admin/warehouses/[id]/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

type Ctx = { params: Promise<{ id: string }> };

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// GET /api/admin/warehouses/[id]
// Returns warehouse details + stock rows + assigned users
export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req, ["admin"]);
    const { id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    const whRows = await sql`
      SELECT id, code, name, address, is_active, created_at
      FROM warehouse WHERE id = ${id}::uuid LIMIT 1
    `;
    const wh = (whRows as any[])[0];
    if (!wh) return json({ ok: false, error: "Depozit inexistent." }, 404);

    // Stock rows for this warehouse
    const stockRows = await sql`
      SELECT
        ib.product_id,
        ib.stock_on_hand,
        ib.stock_reserved,
        (ib.stock_on_hand - ib.stock_reserved) AS stock_available,
        ib.updated_at,
        p.name        AS product_name,
        p.sku         AS product_sku,
        p.uom         AS product_uom,
        COALESCE(b.name, '') AS brand_name
      FROM inventory_balance ib
      JOIN product p ON p.id = ib.product_id
      LEFT JOIN brand b ON b.id = p.brand_id
      WHERE ib.warehouse_id = ${id}::uuid
        AND (
          ${q} = ''
          OR p.name ILIKE '%' || ${q} || '%'
          OR p.sku  ILIKE '%' || ${q} || '%'
        )
      ORDER BY p.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Assigned users
    const userRows = await sql`
      SELECT
        wu.user_id,
        wu.role,
        wu.created_at,
        COALESCE(pr.full_name, '') AS full_name,
        COALESCE(pr.email, '')     AS email
      FROM warehouse_user wu
      JOIN profile pr ON pr.user_id = wu.user_id
      WHERE wu.warehouse_id = ${id}::uuid
      ORDER BY pr.full_name ASC
    `;

    return json({
      ok: true,
      warehouse: wh,
      stock: stockRows,
      users: userRows,
      limit,
      offset,
    });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "Eroare." },
      Number(e?.status ?? 500),
    );
  }
}

// PATCH /api/admin/warehouses/[id]  — update warehouse details
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req, ["admin"]);
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const name = body?.name != null ? String(body.name).trim() : null;
    const address = body?.address != null ? String(body.address).trim() : null;
    const is_active = body?.is_active != null ? Boolean(body.is_active) : null;

    await sql`
      UPDATE warehouse SET
        name      = COALESCE(${name},      name),
        address   = COALESCE(${address},   address),
        is_active = COALESCE(${is_active}, is_active),
        updated_at = now()
      WHERE id = ${id}::uuid
    `;

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, 500);
  }
}
