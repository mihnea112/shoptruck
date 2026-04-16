// src/app/api/public/products/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

function toPublicUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const categoryId = (searchParams.get("categoryId") || "").trim();
  const brandId = (searchParams.get("brandId") || "").trim();
  const sort = searchParams.get("sort") || "newest";
  const limit = Math.min(Number(searchParams.get("limit") || 24), 100);
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

  const where: string[] = ["p.is_active = true"];
  const values: any[] = [];
  let idx = 1;

  if (q) {
    where.push(
      `(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR COALESCE(b.name,'') ILIKE $${idx} OR COALESCE(pc_primary.code_norm,'') ILIKE $${idx})`,
    );
    values.push(`%${q}%`);
    idx++;
  }
  if (categoryId) {
    where.push(
      `(p.category_id = $${idx}::uuid OR c.parent_id = $${idx}::uuid)`,
    );
    values.push(categoryId);
    idx++;
  }
  if (brandId) {
    where.push(`p.brand_id = $${idx}::uuid`);
    values.push(brandId);
    idx++;
  }

  const orderBy =
    sort === "price_asc"
      ? "sell_gross ASC"
      : sort === "price_desc"
        ? "sell_gross DESC"
        : sort === "name"
          ? "p.name ASC"
          : "p.created_at DESC";

  const sql = `
    SELECT
      p.id, p.slug, p.name, p.sku,
      p.buy_price_net, p.profit_margin_pct,
      p.stock_on_hand, p.stock_reserved,
      tr.rate AS tax_rate,
      COALESCE(b.name,'') AS brand_name,
      COALESCE(c.name,'') AS category_name,
      b.id AS brand_id,
      c.id AS category_id,
      pc_primary.code_norm AS primary_code,
      img.primary_image_path,
      CEIL(p.buy_price_net * (1 + p.profit_margin_pct/100.0) *
        (1 + CASE WHEN tr.rate <= 1 THEN tr.rate ELSE tr.rate/100 END)) AS sell_gross,
      COUNT(*) OVER() AS total_count
    FROM product p
    JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN brand b    ON b.id = p.brand_id
    LEFT JOIN category c ON c.id = p.category_id
    LEFT JOIN LATERAL (
      SELECT pc.code_norm FROM product_code j
      JOIN part_code pc ON pc.id = j.code_id
      WHERE j.product_id = p.id AND j.is_primary = true LIMIT 1
    ) pc_primary ON true
    LEFT JOIN LATERAL (
      SELECT pi.storage_path AS primary_image_path
      FROM product_image pi WHERE pi.product_id = p.id
      ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC LIMIT 1
    ) img ON true
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  values.push(limit, offset);

  try {
    const { rows } = await pool.query(sql, values);
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const items = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      sku: r.sku,
      brand_name: r.brand_name || null,
      brand_id: r.brand_id || null,
      category_name: r.category_name || null,
      category_id: r.category_id || null,
      primary_code: r.primary_code || null,
      price_gross: Number(r.sell_gross),
      stock_available: Math.max(
        0,
        Number(r.stock_on_hand) - Number(r.stock_reserved),
      ),
      primary_image_url: toPublicUrl(r.primary_image_path),
    }));
    return NextResponse.json({ ok: true, items, total, limit, offset });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
