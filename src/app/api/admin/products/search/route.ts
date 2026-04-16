import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeCode(q: string) {
  return q
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function GET(req: Request) {
  await requireStaff(req, ["admin", "sales_rep"]);

  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  if (!qRaw) return json({ ok: true, items: [] });

  const qNorm = normalizeCode(qRaw);
  const qLike = `%${qRaw}%`;

  const rows = await sql`
    WITH hit AS (
      SELECT p.id
      FROM product p
      WHERE p.sku ILIKE ${qLike}
         OR p.slug ILIKE ${qLike}
         OR p.name ILIKE ${qLike}

      UNION

      SELECT pc.product_id
      FROM product_code pc
      JOIN part_code c ON c.id = pc.code_id
      WHERE c.code_norm = ${qNorm}
         OR c.code_raw ILIKE ${qLike}

      LIMIT 20
    )
    SELECT
      p.id,
      p.sku,
      p.slug,
      p.name,
      p.buy_price_net,
      p.profit_margin_pct,
      p.is_active,
      p.stock_on_hand,
      p.stock_reserved,
      (p.stock_on_hand - p.stock_reserved) AS stock_available,
      p.uom,

      COALESCE(b.name, '') AS brand_name,

      tr.name AS tax_name,
      tr.rate AS tax_rate,

      (CEILING((p.buy_price_net * (1 + (p.profit_margin_pct / 100.0))) * 100) / 100.0) AS price,
      (tr.rate * 100)::int AS vat_percent,

      -- Primary image storage path (for building the public URL client-side)
      img.storage_path AS primary_image_path,

      -- Primary part code
      pc_primary.code_norm AS primary_code

    FROM hit
    JOIN product p ON p.id = hit.id
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN LATERAL (
      SELECT pi2.storage_path
      FROM product_image pi2
      WHERE pi2.product_id = p.id AND pi2.is_primary = true
      LIMIT 1
    ) img ON true
    LEFT JOIN LATERAL (
      SELECT pc2.code_norm
      FROM product_code j
      JOIN part_code pc2 ON pc2.id = j.code_id
      WHERE j.product_id = p.id AND j.is_primary = true
      LIMIT 1
    ) pc_primary ON true
    WHERE p.is_active = true
    ORDER BY p.name
  `;

  return json({ ok: true, items: rows });
}
