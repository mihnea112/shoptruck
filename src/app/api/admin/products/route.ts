import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";
import { normalizeCode } from "@/lib/utils";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const brandId = (searchParams.get("brandId") || "").trim();
  const categoryId = (searchParams.get("categoryId") || "").trim();

  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

  const rows = await sql`
    SELECT
      p.id,
      p.sku,
      p.slug,
      p.name,
      p.price_gross,
      p.is_active,
      p.brand_id,
      COALESCE(b.name, '') AS brand_name,
      COALESCE(string_agg(DISTINCT c.name, ', '), '') AS categories
    FROM product p
    LEFT JOIN brand b ON b.id = p.brand_id
    LEFT JOIN product_category pc ON pc.product_id = p.id
    LEFT JOIN category c ON c.id = pc.category_id
    WHERE
      (
        ${q} = ''
        OR p.name ILIKE '%' || ${q} || '%'
        OR p.sku ILIKE '%' || ${q} || '%'
        OR p.slug ILIKE '%' || ${q} || '%'
      )
      AND (
        NULLIF(${brandId}, '') IS NULL
        OR p.brand_id = NULLIF(${brandId}, '')::uuid
      )
      AND (
        NULLIF(${categoryId}, '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM product_category pc2
          WHERE pc2.product_id = p.id
            AND pc2.category_id = NULLIF(${categoryId}, '')::uuid
        )
      )
    GROUP BY p.id, b.name
    ORDER BY p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return json({ ok: true, items: rows, limit, offset });
}

export async function POST(req: Request) {
  await requireAdmin(req);

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json({ ok: false, error: "Content-Type invalid. Folosește application/json." }, 415);
  }

  const body = await req.json().catch(() => null);

  // --- 1. Extragere si Validare Date ---
  const sku = String(body?.sku ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const slug = String(body?.slug ?? "").trim();
  const priceGross = Number(String(body?.price_gross ?? "0").replace(",", "."));
  const isActive = body?.is_active !== false;

  const brandId = body?.brand_id ? String(body.brand_id).trim() : "";
  const taxRateId = body?.tax_rate_id ? String(body.tax_rate_id).trim() : "";
  
  const description = body?.description ? String(body.description).trim() : null;
  const code = body?.code ? String(body.code).trim() : null;
  const codeNorm = body?.code_normalized ? String(body.code_normalized).trim() : null;
  const externalCode = body?.external_code ? String(body.external_code).trim() : null;
  
  const uom = body?.uom ? String(body.uom).trim() : "buc";
  
  const weightKg = body?.weight_kg ? Number(String(body.weight_kg).replace(",", ".")) : null;
  const lengthMm = body?.length_mm ? Number(body.length_mm) : null;
  const widthMm = body?.width_mm ? Number(body.width_mm) : null;
  const heightMm = body?.height_mm ? Number(body.height_mm) : null;

  const categoryIds: string[] = Array.isArray(body?.category_ids)
    ? body.category_ids.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  if (!sku || sku.length < 2) return json({ ok: false, error: "SKU invalid." }, 400);
  if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  if (!slug) return json({ ok: false, error: "Slug invalid." }, 400);
  if (!taxRateId) return json({ ok: false, error: "Selectează TVA." }, 400);
  if (!Number.isFinite(priceGross) || priceGross < 0) return json({ ok: false, error: "Preț invalid." }, 400);

  const skuNormalized = normalizeCode(sku);

  try {
    // --- 2. Executie SQL (Tranzactie CTE) ---
    // AM INLOCUIT ON CONFLICT CU O VERIFICARE "WHERE NOT EXISTS" PENTRU A EVITA EROAREA
    
    const result = await sql`
      WITH new_prod AS (
        INSERT INTO product (
          sku, slug, name, description,
          brand_id, tax_rate_id, 
          code, code_normalized, external_code,
          price_gross, uom, 
          weight_kg, length_mm, width_mm, height_mm,
          is_active
        )
        VALUES (
          ${sku},
          ${slug},
          ${name},
          ${description},
          NULLIF(${brandId}, '')::uuid,
          ${taxRateId}::uuid,
          ${code}, ${codeNorm}, ${externalCode},
          ${priceGross}, ${uom},
          ${weightKg}, ${lengthMm}, ${widthMm}, ${heightMm},
          ${isActive}
        )
        RETURNING id, sku
      ),
      ins_cats AS (
        INSERT INTO product_category (product_id, category_id)
        SELECT (SELECT id FROM new_prod), unnest(${categoryIds}::uuid[])
        ON CONFLICT DO NOTHING
      ),
      ins_sku_code AS (
        INSERT INTO product_code (product_id, code, code_normalized, code_type, is_primary)
        SELECT id, sku, ${skuNormalized}, 'SKU', true
        FROM new_prod
        WHERE NOT EXISTS (
            SELECT 1 FROM product_code WHERE code_normalized = ${skuNormalized}
        )
      )
      SELECT id FROM new_prod
    `;

    const id = (result as any[])?.[0]?.id as string | undefined;

    if (!id) return json({ ok: false, error: "Eroare la creare produs." }, 500);

    return json({ ok: true, id });

  } catch (e: any) {
    console.error("Create Product Error:", e);
    const msg = e?.code === "23505" ? "SKU sau slug deja există." : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}