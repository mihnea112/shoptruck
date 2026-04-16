// src/app/api/admin/warehouses/[id]/stock/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

type Ctx = { params: Promise<{ id: string }> };

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

// PATCH /api/admin/warehouses/[id]/stock
// Body: { product_id: uuid, stock_on_hand: number }  // stock_on_hand can be negative for adjustments
// Upserts an inventory_balance row and lets the sync trigger
// update product.stock_on_hand automatically.
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req, ["admin", "warehouse_op"]);
    const { id: warehouse_id } = await ctx.params;

    const body       = await req.json().catch(() => null);
    const product_id = String(body?.product_id ?? "").trim();
    const raw        = body?.stock_on_hand;

    if (!product_id) return json({ ok: false, error: "product_id lipsă." }, 400);

    const qty = Number(String(raw ?? "").replace(",", "."));
    // Allow negative adjustments (e.g., corrections / backorders) but still respect reserved constraints below.
    if (!Number.isFinite(qty)) {
      return json({ ok: false, error: "Stoc invalid (număr)." }, 400);
    }

    // Verify warehouse exists
    const wh = await sql`SELECT id FROM warehouse WHERE id = ${warehouse_id}::uuid LIMIT 1`;
    if (!(wh as any[]).length) return json({ ok: false, error: "Depozit inexistent." }, 404);

    // Pre-validate: refuse if qty < current stock_reserved (would violate DB constraint)
    const existing = await sql`
      SELECT stock_reserved FROM inventory_balance
      WHERE warehouse_id = ${warehouse_id}::uuid AND product_id = ${product_id}::uuid
      LIMIT 1
    `;
    const currentReserved = Number((existing as any[])[0]?.stock_reserved ?? 0);
    if (qty < currentReserved) {
      return json(
        {
          ok: false,
          error: `Stocul fizic (${qty}) nu poate fi mai mic decat cantitatea rezervata (${currentReserved}). Elibereaza rezervarile inainte de a reduce stocul.`,
        },
        400
      );
    }

    // Safe upsert — constraint cannot fire because qty >= currentReserved
    await sql`
      INSERT INTO inventory_balance (warehouse_id, product_id, stock_on_hand, stock_reserved)
      VALUES (${warehouse_id}::uuid, ${product_id}::uuid, ${qty}, 0)
      ON CONFLICT (warehouse_id, product_id)
      DO UPDATE SET
        stock_on_hand = ${qty},
        updated_at = now()
    `;

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, 500);
  }
}