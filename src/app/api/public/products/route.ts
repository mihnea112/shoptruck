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

function ceilToLeu(n: number) {
  return Math.ceil(n);
}

function normalizeTaxRate(rate: number) {
  return rate <= 1 ? rate : rate / 100;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 8), 50);
  const q = (searchParams.get("q") || "").trim();

  const whereQ = q
    ? `AND (
        p.name ILIKE $2 OR
        p.sku ILIKE $2 OR
        p.slug ILIKE $2 OR
        COALESCE(pc_primary.code_norm, '') ILIKE $2
      )`
    : "";

  const values: any[] = [limit];
  if (q) values.push(`%${q}%`);

  const sql = `
    SELECT
      p.id,
      p.slug,
      p.name,
      p.buy_price_net,
      p.profit_margin_pct,
      tr.rate as tax_rate,
      pc_primary.code_norm as primary_code,
      img.primary_image_path,
      img.images_json
    FROM product p
    JOIN tax_rate tr ON tr.id = p.tax_rate_id
    LEFT JOIN LATERAL (
      SELECT pc.code_norm
      FROM product_code j
      JOIN part_code pc ON pc.id = j.code_id
      WHERE j.product_id = p.id AND j.is_primary = true
      LIMIT 1
    ) pc_primary ON true

    -- ✅ FIX: your table is public.product_image (singular)
    LEFT JOIN LATERAL (
      SELECT
        (
          SELECT pi.storage_path
          FROM public.product_image pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
          LIMIT 1
        ) AS primary_image_path,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'storage_path', pi.storage_path,
              'is_primary', pi.is_primary,
              'sort_order', pi.sort_order
            )
            ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::jsonb
        ) AS images_json
      FROM public.product_image pi
      WHERE pi.product_id = p.id
    ) img ON true

    WHERE p.is_active = true
    ${whereQ}
    ORDER BY p.created_at DESC
    LIMIT $1
  `;

  try {
    const { rows } = await pool.query(sql, values);

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    const bucket = process.env.NEXT_PUBLIC_PRODUCT_IMAGES_BUCKET || "product-images";

    const toPublicUrl = (storagePath: string | null) => {
      if (!storagePath) return null;
      const raw = String(storagePath).trim();
      if (!raw) return null;

      // If DB already stores full URL, keep it
      if (/^https?:\/\//i.test(raw)) return raw;

      if (!supabaseUrl) return null;

      // Normalize
      let p = raw.replace(/^\/+/, "");
      if (p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1);
      if (p.startsWith(`product-images/`)) p = p.slice(`product-images/`.length);

      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${p}`;
    };

    const items = rows.map((r) => {
      const taxFrac = normalizeTaxRate(Number(r.tax_rate));
      const sellNet = Number(r.buy_price_net) * (1 + Number(r.profit_margin_pct) / 100);
      const sellGross = ceilToLeu(sellNet * (1 + taxFrac));

      const primaryUrl = toPublicUrl(r.primary_image_path);

      // pg returns jsonb already as object in most setups; still defensive
      const imagesRaw = r.images_json;
      const imagesArr = Array.isArray(imagesRaw)
        ? imagesRaw
        : imagesRaw && typeof imagesRaw === "object"
        ? imagesRaw
        : [];

      const images = (Array.isArray(imagesArr) ? imagesArr : [])
        .map((x: any) => {
          const storage_path = String(x?.storage_path ?? "").trim();
          if (!storage_path) return null;
          return {
            storage_path,
            url: toPublicUrl(storage_path),
            is_primary: !!x?.is_primary,
            sort_order: x?.sort_order == null ? null : Number(x.sort_order),
          };
        })
        .filter(Boolean);

      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        short: null,
        price_gross: sellGross,
        primary_image_url: primaryUrl,
        image_url: primaryUrl,
        images,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}