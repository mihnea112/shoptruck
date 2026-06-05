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
  if (!storagePath) return null;
  // Already a full URL (e.g. external images from old site)
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!supabaseUrl) return null;
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
      p.sku,
      p.description,
      p.buy_price_net,
      p.profit_margin_pct,
      p.is_active,
      p.stock_on_hand,
      p.stock_reserved,
      p.discount_price,
      p.discount_active,
      tr.rate AS tax_rate,

      b.name AS brand_name,
      c.name AS category_name,

      pc_primary.code_id AS primary_code,

      CASE
        WHEN p.discount_active AND p.discount_price > 0
        THEN ROUND((1 - p.discount_price::NUMERIC / (CEIL(p.buy_price_net * (1 + p.profit_margin_pct/100.0) *
          (1 + CASE WHEN tr.rate <= 1 THEN tr.rate ELSE tr.rate/100 END)))::NUMERIC) * 100)
        ELSE 0
      END AS discount_percentage,

      img.primary_image_path,
      img.images_json,

      codes.all_codes_json

    FROM product p
    JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN category c ON c.id = p.category_id

    LEFT JOIN LATERAL (
      SELECT j.code_id
      FROM product_code j
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

    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'code', COALESCE(pc.code_norm, prc.code_id),
              'is_primary', prc.is_primary,
              'code_kind', prc.code_kind
            )
            ORDER BY prc.is_primary DESC, COALESCE(pc.code_norm, prc.code_id) ASC
          ) FILTER (WHERE prc.code_id IS NOT NULL),
          '[]'::jsonb
        ) AS all_codes_json
      FROM product_code prc
      LEFT JOIN part_code pc ON pc.id = prc.code_id::uuid
      WHERE prc.product_id = p.id
    ) codes ON true

    WHERE p.slug = $1
    LIMIT 1
  `;

  const warehouseSql = `
    SELECT
      w.id, w.name, w.code,
      COALESCE(ib.stock_on_hand, 0)  AS stock_on_hand,
      COALESCE(ib.stock_reserved, 0) AS stock_reserved,
      GREATEST(0, COALESCE(ib.stock_on_hand,0) - COALESCE(ib.stock_reserved,0)) AS stock_available
    FROM warehouse w
    LEFT JOIN inventory_balance ib
      ON ib.warehouse_id = w.id
      AND ib.product_id = (SELECT id FROM product WHERE slug = $1 LIMIT 1)
    WHERE w.is_active = true
    ORDER BY w.created_at ASC
  `;

  const suggestedProductsSql = `
    WITH current_product AS (
      SELECT id, slug, brand_id, category_id FROM product WHERE slug = $1 LIMIT 1
    ),
    current_codes AS (
      SELECT DISTINCT prc.code_id
      FROM product_code prc
      WHERE prc.product_id = (SELECT id FROM current_product)
    )
    SELECT DISTINCT ON (p.id)
      p.id,
      p.slug,
      p.name,
      p.buy_price_net,
      p.profit_margin_pct,
      p.discount_price,
      p.discount_active,
      tr.rate AS tax_rate,
      b.name AS brand_name,
      pi.storage_path,
      -- Priority: 1 if code match, 2 if category/brand match
      CASE
        WHEN EXISTS (
          SELECT 1 FROM product_code prc2
          WHERE prc2.product_id = p.id
            AND prc2.code_id IN (SELECT code_id FROM current_codes)
        ) THEN 1
        ELSE 2
      END AS match_priority
    FROM product p
    JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN product_image pi ON pi.product_id = p.id AND pi.is_primary = true
    WHERE p.is_active = true
      AND p.slug != $1
      AND (
        -- Match 1: Products with same codes
        EXISTS (
          SELECT 1 FROM product_code prc2
          WHERE prc2.product_id = p.id
            AND prc2.code_id IN (SELECT code_id FROM current_codes)
        )
        OR
        -- Match 2: Products in same category or brand
        (p.category_id = (SELECT category_id FROM current_product) OR p.brand_id = (SELECT brand_id FROM current_product))
      )
    ORDER BY p.id, match_priority ASC, RANDOM()
    LIMIT 12
  `;

  const relatedProductsSql = `
    SELECT
      p.id,
      p.slug,
      p.name,
      p.buy_price_net,
      p.profit_margin_pct,
      p.discount_price,
      p.discount_active,
      tr.rate AS tax_rate,
      b.name AS brand_name,
      pi.storage_path
    FROM product p
    JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN product_image pi ON pi.product_id = p.id AND pi.is_primary = true
    WHERE p.is_active = true
      AND p.slug != $1
      AND p.id IN (
        SELECT prc2.product_id
        FROM product_code prc2
        WHERE prc2.code_id IN (
          SELECT code_id FROM product_code
          WHERE product_id = (SELECT id FROM product WHERE slug = $1 LIMIT 1)
        )
      )
    ORDER BY RANDOM()
    LIMIT 12
  `;

  try {
    const [{ rows }, { rows: whRows }] = await Promise.all([
      pool.query(sql, [slug]),
      pool.query(warehouseSql, [slug]),
    ]);
    const r = rows?.[0];
    if (!r) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 },
      );
    }

    // Get suggested products separately, with error handling
    let suggestedRows: any[] = [];
    try {
      const suggestedResult = await pool.query(suggestedProductsSql, [slug]);
      suggestedRows = suggestedResult.rows || [];
    } catch (e) {
      console.error("[Suggested Products Query Error]", e);
      suggestedRows = [];
    }

    // Get related products separately, with error handling
    let relatedRows: any[] = [];
    try {
      const relatedResult = await pool.query(relatedProductsSql, [slug]);
      relatedRows = relatedResult.rows || [];
    } catch (e) {
      console.error("[Related Products Query Error]", e);
      // Continue without related products if the query fails
      relatedRows = [];
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

    const codesJson = r.all_codes_json ?? [];
    const codesArr = Array.isArray(codesJson) ? codesJson : [];
    const equivalentCodes = codesArr
      .filter((c: any) => !c.is_primary && c.code)
      .map((c: any) => c.code);

    const primaryCode = r.primary_code && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.primary_code) ? (r.sku ?? null) : (r.primary_code ?? null);

    const item = {
      id: r.id,
      slug: r.slug,
      name: r.name,
      sku: r.sku ?? null,

      short: null,
      description: r.description ?? null,

      brand_name: r.brand_name ?? null,
      category_name: r.category_name ?? null,
      primary_code: primaryCode,
      equivalent_codes: equivalentCodes,
      all_codes: codesArr,

      price_gross: sellGross,
      discount_price: r.discount_price ?? null,
      discount_active: r.discount_active ?? false,
      discount_percentage: r.discount_percentage ?? 0,

      primary_image_url: toPublicUrl(r.primary_image_path ?? null),
      images,

      stock_available: Math.max(
        0,
        Number(r.stock_on_hand ?? 0) - Number(r.stock_reserved ?? 0),
      ),
      in_stock:
        Number(r.stock_on_hand ?? 0) - Number(r.stock_reserved ?? 0) > 0,
    };

    // Process suggested products
    const suggestedProducts = (suggestedRows as any[]).map((sp) => {
      const spTaxFrac = normalizeTaxRate(Number(sp.tax_rate));
      const spSellNet =
        Number(sp.buy_price_net) * (1 + Number(sp.profit_margin_pct) / 100);
      const spSellGross = ceilToLeu(spSellNet * (1 + spTaxFrac));

      const discountPercentage = sp.discount_active && sp.discount_price > 0
        ? Math.round((1 - sp.discount_price / spSellGross) * 100)
        : 0;

      return {
        id: sp.id,
        slug: sp.slug,
        name: sp.name,
        brand_name: sp.brand_name ?? null,
        price_gross: spSellGross,
        discount_price: sp.discount_price ?? null,
        discount_active: sp.discount_active ?? false,
        discount_percentage: discountPercentage,
        image_url: toPublicUrl(sp.storage_path ?? null),
      };
    });

    // Process related products
    const relatedProducts = (relatedRows as any[]).map((rp) => {
      const rpTaxFrac = normalizeTaxRate(Number(rp.tax_rate));
      const rpSellNet =
        Number(rp.buy_price_net) * (1 + Number(rp.profit_margin_pct) / 100);
      const rpSellGross = ceilToLeu(rpSellNet * (1 + rpTaxFrac));

      const discountPercentage = rp.discount_active && rp.discount_price > 0
        ? Math.round((1 - rp.discount_price / rpSellGross) * 100)
        : 0;

      return {
        id: rp.id,
        slug: rp.slug,
        name: rp.name,
        brand_name: rp.brand_name ?? null,
        price_gross: rpSellGross,
        discount_price: rp.discount_price ?? null,
        discount_active: rp.discount_active ?? false,
        discount_percentage: discountPercentage,
        image_url: toPublicUrl(rp.storage_path ?? null),
      };
    });

    return NextResponse.json({
      ok: true,
      item,
      warehouses: whRows,
      suggestedProducts,
      relatedProducts,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 },
    );
  }
}
