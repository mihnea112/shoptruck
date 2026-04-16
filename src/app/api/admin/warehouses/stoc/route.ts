// src/app/api/admin/depozit/stoc/route.ts
// Warehouse-operator-aware stock API.
// - WAREHOUSE_OP: automatically scoped to their assigned warehouse
// - ADMIN: can pass ?warehouse_id= to target any warehouse, or gets all warehouses

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { getSessionUser } from "@/lib/auth/server";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// Resolve which warehouse(s) the current user can manage
async function resolveWarehouse(
  userId: string,
  roles: string[],
  requestedId: string | null,
): Promise<{ warehouseId: string | null; error: string | null }> {
  const isAdmin = roles.includes("ADMIN");

  if (isAdmin) {
    // Admin can target any warehouse
    return { warehouseId: requestedId, error: null };
  }

  // Warehouse op — find their assigned warehouse
  const rows = await sql`
    SELECT wu.warehouse_id
    FROM warehouse_user wu
    JOIN warehouse w ON w.id = wu.warehouse_id
    WHERE wu.user_id = ${userId}::uuid
      AND w.is_active = true
    ORDER BY wu.created_at ASC
    LIMIT 1
  `;

  const assigned = (rows as any[])[0]?.warehouse_id ?? null;
  if (!assigned) {
    return {
      warehouseId: null,
      error:
        "Nu ești asignat la niciun depozit activ. Contactează administratorul.",
    };
  }

  return { warehouseId: assigned, error: null };
}

// GET — list stock for the resolved warehouse
export async function GET(req: Request) {
  try {
    await requireStaff(req, ["admin", "warehouse_op"]);

    const session = await getSessionUser();
    if (!session) return json({ ok: false, error: "Neautorizat." }, 401);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const requestedId = searchParams.get("warehouse_id") || null;
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const onlyLow = searchParams.get("low_stock") === "1"; // filter: available <= threshold

    const roles = (session.roles || []).map((r) => String(r).toUpperCase());

    const { warehouseId, error: whError } = await resolveWarehouse(
      session.userId,
      roles,
      requestedId,
    );

    if (whError) return json({ ok: false, error: whError }, 403);
    if (!warehouseId)
      return json({ ok: false, error: "Depozit negăsit." }, 404);

    // Warehouse info
    const whRows = await sql`
      SELECT id, code, name, address, is_active
      FROM warehouse
      WHERE id = ${warehouseId}::uuid
      LIMIT 1
    `;
    const warehouse = (whRows as any[])[0];
    if (!warehouse)
      return json({ ok: false, error: "Depozit inexistent." }, 404);

    // Stock rows
    const stockRows = await sql`
      SELECT
        ib.product_id,
        ib.stock_on_hand,
        ib.stock_reserved,
        (ib.stock_on_hand - ib.stock_reserved) AS stock_available,
        ib.updated_at,
        p.name                AS product_name,
        p.sku                 AS product_sku,
        p.uom                 AS product_uom,
        COALESCE(b.name, '')  AS brand_name,
        c.name                AS category_name
      FROM inventory_balance ib
      JOIN product p    ON p.id = ib.product_id
      LEFT JOIN brand b ON b.id = p.brand_id
      LEFT JOIN category c ON c.id = p.category_id
      WHERE ib.warehouse_id = ${warehouseId}::uuid
        AND (
          ${q} = ''
          OR p.name ILIKE '%' || ${q} || '%'
          OR p.sku  ILIKE '%' || ${q} || '%'
          OR COALESCE(b.name, '') ILIKE '%' || ${q} || '%'
        )
        AND (
          ${onlyLow} = false
          OR (ib.stock_on_hand - ib.stock_reserved) <= 0
        )
      ORDER BY p.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Summary stats
    const statsRows = await sql`
      SELECT
        COUNT(*)::int                                          AS total_products,
        COALESCE(SUM(ib.stock_on_hand), 0)                   AS total_on_hand,
        COALESCE(SUM(ib.stock_reserved), 0)                  AS total_reserved,
        COALESCE(SUM(ib.stock_on_hand - ib.stock_reserved), 0) AS total_available,
        COUNT(*) FILTER (
          WHERE (ib.stock_on_hand - ib.stock_reserved) <= 0
        )::int                                                AS out_of_stock_count
      FROM inventory_balance ib
      WHERE ib.warehouse_id = ${warehouseId}::uuid
    `;

    return json({
      ok: true,
      warehouse,
      stock: stockRows,
      stats: (statsRows as any[])[0] ?? {},
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

// PATCH — update stock_on_hand for a product in this warehouse
// Body: { product_id, stock_on_hand, warehouse_id? (admin only) }
export async function PATCH(req: Request) {
  try {
    await requireStaff(req, ["admin", "warehouse_op"]);

    const session = await getSessionUser();
    if (!session) return json({ ok: false, error: "Neautorizat." }, 401);

    const body = await req.json().catch(() => null);
    const productId = String(body?.product_id ?? "").trim();
    const requestedId = body?.warehouse_id
      ? String(body.warehouse_id).trim()
      : null;
    const rawQty = body?.stock_on_hand;

    if (!productId) return json({ ok: false, error: "product_id lipsă." }, 400);

    const qty = Number(String(rawQty ?? "").replace(",", "."));
    if (!Number.isFinite(qty) || qty < 0)
      return json({ ok: false, error: "Stoc invalid (număr >= 0)." }, 400);

    const roles = (session.roles || []).map((r) => String(r).toUpperCase());

    const { warehouseId, error: whError } = await resolveWarehouse(
      session.userId,
      roles,
      requestedId,
    );

    if (whError) return json({ ok: false, error: whError }, 403);
    if (!warehouseId)
      return json({ ok: false, error: "Depozit negăsit." }, 404);

    // Verify product exists
    const prod =
      await sql`SELECT id FROM product WHERE id = ${productId}::uuid LIMIT 1`;
    if (!(prod as any[]).length)
      return json({ ok: false, error: "Produs inexistent." }, 404);

    // Pre-validate: refuse if qty < current stock_reserved (would violate DB constraint)
    const existing = await sql`
      SELECT stock_reserved FROM inventory_balance
      WHERE warehouse_id = ${warehouseId}::uuid AND product_id = ${productId}::uuid
      LIMIT 1
    `;
    const currentReserved = Number((existing as any[])[0]?.stock_reserved ?? 0);
    if (qty < currentReserved) {
      return json(
        {
          ok: false,
          error: `Stocul fizic (${qty}) nu poate fi mai mic decat cantitatea rezervata (${currentReserved}). Elibereaza rezervarile inainte de a reduce stocul.`,
        },
        400,
      );
    }

    // Safe upsert — constraint cannot fire because qty >= currentReserved
    await sql`
      INSERT INTO inventory_balance (warehouse_id, product_id, stock_on_hand, stock_reserved)
      VALUES (${warehouseId}::uuid, ${productId}::uuid, ${qty}, 0)
      ON CONFLICT (warehouse_id, product_id)
      DO UPDATE SET
        stock_on_hand = ${qty},
        updated_at    = now()
    `;

    return json({
      ok: true,
      warehouse_id: warehouseId,
      product_id: productId,
      stock_on_hand: qty,
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, 500);
  }
}
