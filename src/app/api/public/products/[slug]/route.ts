// src/app/api/public/products/[slug]/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

const BUCKET =
  process.env.NEXT_PUBLIC_PRODUCT_IMAGES_BUCKET || "product-images";

function ceilToLeu(n: number) {
  return Math.ceil(n);
}
function normalizeTaxRate(rate: number) {
  return rate <= 1 ? rate : rate / 100;
}
function toPublicUrl(storagePath: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!supabaseUrl || !storagePath) return null;
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const sql = `
    SELECT
      p.id,
      p.slug,
      p.name,
      p.buy_price_net,
      p.profit_margin_pct,
      p.is_active,
      tr.rate AS tax_rate,

      b.name AS brand_name,
      c.name AS category_name,

      pc_primary.code_norm AS primary_code,

      img.primary_image_path,
      img.images_json

    FROM product p
    JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN category c ON c.id = p.category_id

    LEFT JOIN LATERAL (
      SELECT pc.code_norm
      FROM product_code j
      JOIN part_code pc ON pc.id = j.code_id
      WHERE j.product_id = p.id AND j.is_primary = true
      LIMIT 1
    ) pc_primary ON true

    LEFT JOIN LATERAL (
      SELECT
        (
          SELECT pi.storage_path
          FROM product_image pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST, pi.created_at ASC
          LIMIT 1
        ) AS primary_image_path,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'storage_path', pi.storage_path,
              'alt', pi.alt,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            )
            ORDER BY pi.is_primary DESC, pi.sort_order ASC NULLS LAST, pi.created_at ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::jsonb
        ) AS images_json
      FROM product_image pi
      WHERE pi.product_id = p.id
    ) img ON true

    WHERE p.slug = $1
    LIMIT 1
  `;

  try {
    const { rows } = await pool.query(sql, [slug]);
    const r = rows?.[0];
    if (!r) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 },
      );
    }

    // If you want public pages to show only active products:
    if (!r.is_active) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 },
      );
    }

    const taxFrac = normalizeTaxRate(Number(r.tax_rate));
    const sellNet =
      Number(r.buy_price_net) * (1 + Number(r.profit_margin_pct) / 100);
    const sellGross = ceilToLeu(sellNet * (1 + taxFrac));

    const imagesJson = r.images_json ?? [];
    const imagesArr = Array.isArray(imagesJson) ? imagesJson : [];
    const images = imagesArr
      .map((x: any) => {
        const storage_path = String(x?.storage_path ?? "").trim();
        if (!storage_path) return null;
        return {
          storage_path,
          url: toPublicUrl(storage_path),
          alt: x?.alt ?? null,
          is_primary: !!x?.is_primary,
          sort_order: x?.sort_order == null ? null : Number(x.sort_order),
        };
      })
      .filter(Boolean);

    const item = {
      id: r.id,
      slug: r.slug,
      name: r.name,

      short: null, // you don't have description
      description: null, // you don't have description

      brand_name: r.brand_name ?? null,
      category_name: r.category_name ?? null,
      primary_code: r.primary_code ?? null,

      price_gross: sellGross,

      primary_image_url: toPublicUrl(r.primary_image_path ?? null),
      images,

      in_stock: true, // until you add a stock table/field
    };

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 },
    );
  }
}
