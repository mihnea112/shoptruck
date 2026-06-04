// src/app/api/admin/products/[id]/discount/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

// GET - Get discount info for a product
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT
        p.id, p.name, p.discount_price, p.discount_active,
        CEIL(p.buy_price_net * (1 + p.profit_margin_pct/100.0) *
          (1 + CASE WHEN tr.rate <= 1 THEN tr.rate ELSE tr.rate/100 END)) AS sell_gross,
        CASE
          WHEN p.discount_price IS NOT NULL AND p.discount_price > 0
          THEN ROUND((1 - p.discount_price::NUMERIC / (CEIL(p.buy_price_net * (1 + p.profit_margin_pct/100.0) *
            (1 + CASE WHEN tr.rate <= 1 THEN tr.rate ELSE tr.rate/100 END)))::NUMERIC) * 100)
          ELSE 0
        END AS discount_percentage
      FROM product p
      JOIN tax_rate tr ON tr.id = p.tax_rate_id
      WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, product: rows[0] });
  } catch (e: any) {
    console.error("[API discount GET]", e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

// PUT - Update discount for a product
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { discount_price, discount_active } = await req.json();

    // Validate
    if (discount_active && (!discount_price || discount_price <= 0)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Discount price must be greater than 0 when discount is active",
        },
        { status: 400 }
      );
    }

    const { rows } = await pool.query(
      `UPDATE product
      SET discount_price = $1, discount_active = $2
      WHERE id = $3
      RETURNING id, name, discount_price, discount_active,
        (SELECT CEIL(buy_price_net * (1 + profit_margin_pct/100.0) *
          (1 + CASE WHEN rate <= 1 THEN rate ELSE rate/100 END))
         FROM tax_rate WHERE id = product.tax_rate_id) AS sell_gross`,
      [discount_price || null, discount_active || false, id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const product = rows[0];
    const discount_percentage =
      discount_active && discount_price
        ? Math.round((1 - discount_price / product.sell_gross) * 100)
        : 0;

    return NextResponse.json({
      ok: true,
      product: { ...product, discount_percentage },
    });
  } catch (e: any) {
    console.error("[API discount PUT]", e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

// DELETE - Remove discount from a product
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { rows } = await pool.query(
      `UPDATE product
      SET discount_price = NULL, discount_active = false
      WHERE id = $1
      RETURNING id, name,
        (SELECT CEIL(buy_price_net * (1 + profit_margin_pct/100.0) *
          (1 + CASE WHEN rate <= 1 THEN rate ELSE rate/100 END))
         FROM tax_rate WHERE id = product.tax_rate_id) AS sell_gross`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Discount removed",
      product: rows[0],
    });
  } catch (e: any) {
    console.error("[API discount DELETE]", e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
