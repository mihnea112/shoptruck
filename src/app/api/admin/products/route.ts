import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

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

  const sku = String(body?.sku ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const slug = String(body?.slug ?? "").trim();
  const priceGross = Number(String(body?.price_gross ?? "0").replace(",", "."));
  const isActive = body?.is_active !== false;

  const brandId = body?.brand_id ? String(body.brand_id).trim() : "";
  const taxRateId = body?.tax_rate_id ? String(body.tax_rate_id).trim() : "";

  const categoryIds: string[] = Array.isArray(body?.category_ids)
    ? body.category_ids.map((x: any) => String(x).trim()).filter(Boolean)
    : [];

  if (!sku || sku.length < 2) return json({ ok: false, error: "SKU invalid." }, 400);
  if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  if (!slug) return json({ ok: false, error: "Slug invalid." }, 400);
  if (!taxRateId) return json({ ok: false, error: "Selectează TVA." }, 400);
  if (!Number.isFinite(priceGross) || priceGross < 0) return json({ ok: false, error: "Preț invalid." }, 400);

  try {
    // 1) create product
    const created = await sql`
      INSERT INTO product (sku, slug, name, brand_id, tax_rate_id, price_gross, is_active)
      VALUES (
        ${sku},
        ${slug},
        ${name},
        NULLIF(${brandId}, '')::uuid,
        ${taxRateId}::uuid,
        ${priceGross},
        ${isActive}
      )
      RETURNING id
    `;

    const id = (created as any[])?.[0]?.id as string | undefined;
    if (!id) return json({ ok: false, error: "Eroare la creare produs." }, 500);

    // 2) link categories (only if provided)
    if (categoryIds.length > 0) {
      await sql`
        INSERT INTO product_category (product_id, category_id)
        SELECT ${id}::uuid, x::uuid
        FROM unnest(${categoryIds}::text[]) AS x
        ON CONFLICT DO NOTHING
      `;
    }

    return json({ ok: true, id });
  } catch (e: any) {
    const msg = e?.code === "23505" ? "SKU sau slug deja există." : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}