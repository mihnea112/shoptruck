import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

function toImgUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Already a full URL (external images from old site)
  if (/^https?:\/\//i.test(path)) return path;
  // Build Supabase public URL
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

export async function GET(req: Request) {
  await requireStaff(req, ["admin", "sales", "sales_rep", "warehouse", "warehouse_op"]);

  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  if (!qRaw) return json({ ok: true, items: [] });

  const qNorm = normalizeCode(qRaw);
  const qLike = `%${qRaw}%`;

  // NOTE: no ::text casts on uuid columns (they defeat the indexes and made this query time
  // out on a 50k-product catalog). Codes live in product_code.code_id as raw text; legacy rows
  // point at part_code instead, so both are searched.
  const qNormLike = qNorm ? `%${qNorm}%` : null;
  const rows = await sql`
    WITH hits AS (
      SELECT p.id FROM product p
      WHERE p.is_active = true
        AND (p.sku ILIKE ${qLike} OR p.slug ILIKE ${qLike} OR p.name ILIKE ${qLike})
      UNION
      SELECT pc.product_id FROM product_code pc
      WHERE pc.code_id ILIKE ${qLike}
         OR (${qNormLike}::text IS NOT NULL
             AND regexp_replace(lower(pc.code_id), '[^a-z0-9]', '', 'g') LIKE ${qNormLike})
      UNION
      SELECT pc.product_id FROM product_code pc
      JOIN part_code c ON c.id::text = pc.code_id
      WHERE c.code_norm = ${qNorm} OR c.code_raw ILIKE ${qLike}
         OR (${qNormLike}::text IS NOT NULL AND c.code_norm LIKE ${qNormLike})
    )
    SELECT
      p.id, p.sku, p.slug, p.name,
      p.buy_price_net, p.profit_margin_pct, p.is_active,
      p.stock_on_hand, p.stock_reserved,
      (p.stock_on_hand - p.stock_reserved) AS stock_available,
      p.uom,
      COALESCE(b.name, '') AS brand_name,
      tr.name AS tax_name,
      tr.rate AS tax_rate,
      (CEILING((p.buy_price_net * (1 + (p.profit_margin_pct / 100.0))) * 100) / 100.0) AS price,
      (tr.rate * 100)::int AS vat_percent,
      img.storage_path AS primary_image_path,
      pc_primary.code AS primary_code
    FROM hits h
    JOIN product p ON p.id = h.id AND p.is_active = true
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN LATERAL (
      SELECT pi.storage_path FROM product_image pi
      WHERE pi.product_id = p.id
      ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
      LIMIT 1
    ) img ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(pc2.code_norm, j.code_id) AS code
      FROM product_code j
      LEFT JOIN part_code pc2 ON pc2.id::text = j.code_id
      WHERE j.product_id = p.id AND j.is_primary = true LIMIT 1
    ) pc_primary ON true
    ORDER BY p.name
    LIMIT 20
  `;

  // Generate signed URLs for Supabase-stored images (works even if bucket is private)
  const sb = supabaseAdmin();
  const items = await Promise.all(
    (rows as any[]).map(async (x) => {
      const rawPath = x.primary_image_path ?? null;
      let imageUrl = toImgUrl(rawPath); // works for external URLs

      // For relative paths (Supabase Storage), generate a signed URL (60 min)
      if (rawPath && !/^https?:\/\//i.test(rawPath)) {
        const { data } = await sb.storage
          .from("product-images")
          .createSignedUrl(rawPath, 3600);
        if (data?.signedUrl) imageUrl = data.signedUrl;
      }

      return {
        ...x,
        primary_image_path: imageUrl ?? rawPath,
        image_url: imageUrl,
      };
    }),
  );

  return json({ ok: true, items });
}
