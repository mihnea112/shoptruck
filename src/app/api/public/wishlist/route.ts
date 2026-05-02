import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// GET /api/public/wishlist - Get customer's wishlist
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return json({ ok: false, error: "Neautorizat." }, 401);
    }

    const items = await sql`
      SELECT
        wl.id,
        wl.product_id,
        wl.added_at,
        p.name,
        p.slug,
        b.name as brand_name,
        pc.code_norm as primary_code,
        pi.primary_image_path,
        CEIL(p.buy_price_net * (1 + p.profit_margin_pct/100.0) *
          (1 + CASE WHEN tr.rate <= 1 THEN tr.rate ELSE tr.rate/100 END)) AS price_gross
      FROM customer_wishlist wl
      JOIN product p ON p.id = wl.product_id
      JOIN tax_rate tr ON tr.id = p.tax_rate_id
      LEFT JOIN brand b ON b.id = p.brand_id
      LEFT JOIN LATERAL (
        SELECT pc.code_norm FROM product_code j
        JOIN part_code pc ON pc.id = j.code_id
        WHERE j.product_id = p.id AND j.is_primary = true LIMIT 1
      ) pc ON true
      LEFT JOIN LATERAL (
        SELECT pi.storage_path AS primary_image_path
        FROM product_image pi WHERE pi.product_id = p.id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1
      ) pi ON true
      WHERE wl.customer_id = ${user.userId}::uuid
      ORDER BY wl.added_at DESC
    `;

    return json({
      ok: true,
      items: items.map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        name: row.name,
        slug: row.slug,
        brand_name: row.brand_name || null,
        primary_code: row.primary_code || null,
        price_gross: Number(row.price_gross),
        primary_image_path: row.primary_image_path || null,
        added_at: row.added_at,
      })),
      total: items.length,
    });
  } catch (e: any) {
    console.error("[API wishlist GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

// POST /api/public/wishlist - Add to wishlist
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return json({ ok: false, error: "Neautorizat." }, 401);
    }

    const body = await req.json();
    const { product_id } = body;

    if (!product_id || typeof product_id !== "string") {
      return json(
        { ok: false, error: "product_id este necesar și trebuie să fie string." },
        400
      );
    }

    // Verify product exists
    const product = await sql`
      SELECT id FROM product WHERE id = ${product_id}::uuid AND is_active = true
    `;

    if (!product.length) {
      return json({ ok: false, error: "Produs nu a fost găsit." }, 404);
    }

    // Insert or ignore if already exists
    const result = await sql`
      INSERT INTO customer_wishlist (customer_id, product_id)
      VALUES (${user.userId}::uuid, ${product_id}::uuid)
      ON CONFLICT (customer_id, product_id) DO NOTHING
      RETURNING id
    `;

    return json({
      ok: true,
      added: result.length > 0,
      message: result.length > 0
        ? "Adăugat la dorințe."
        : "Deja în dorințe.",
    });
  } catch (e: any) {
    console.error("[API wishlist POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

// DELETE /api/public/wishlist/[product_id] - Remove from wishlist
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return json({ ok: false, error: "Neautorizat." }, 401);
    }

    const url = new URL(req.url);
    const product_id = url.searchParams.get("product_id");

    if (!product_id) {
      return json(
        { ok: false, error: "product_id este necesar." },
        400
      );
    }

    const result = await sql`
      DELETE FROM customer_wishlist
      WHERE customer_id = ${user.userId}::uuid
      AND product_id = ${product_id}::uuid
      RETURNING id
    `;

    return json({
      ok: true,
      deleted: result.length > 0,
      message: result.length > 0
        ? "Eliminat din dorințe."
        : "Nu era în dorințe.",
    });
  } catch (e: any) {
    console.error("[API wishlist DELETE]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

