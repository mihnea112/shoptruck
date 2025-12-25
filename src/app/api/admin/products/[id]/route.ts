import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };
async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params);
  return String((p as any).id);
}

export async function GET(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  const rows = await sql`
    SELECT
      id, sku, slug, name, description,
      brand_id, tax_rate_id,
      code, code_normalized, external_code,
      price_gross, uom,
      weight_kg, length_mm, width_mm, height_mm,
      is_active, created_at, updated_at
    FROM product
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const p = (rows as any[])?.[0];
  if (!p) return json({ ok: false, error: "Produs inexistent." }, 404);

  const cats = await sql`
    SELECT category_id
    FROM product_category
    WHERE product_id = ${id}::uuid
  `;

  return json({
    ok: true,
    item: p,
    category_ids: (cats as any[]).map((r) => r.category_id),
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      415
    );
  }

  const body = await req.json().catch(() => null);

  const sku = String(body?.sku ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const slug = String(body?.slug ?? "").trim();
  const description = body?.description == null ? null : String(body.description);

  const priceGross = Number(String(body?.price_gross ?? "0").replace(",", "."));
  const isActive = body?.is_active !== false;

  const brandId = body?.brand_id ? String(body.brand_id) : null;
  const taxRateId = body?.tax_rate_id ? String(body.tax_rate_id) : null;

  const code = body?.code ? String(body.code).trim() : null;
  const codeNorm = body?.code_normalized ? String(body.code_normalized).trim() : null;
  const externalCode = body?.external_code ? String(body.external_code).trim() : null;

  const uom = body?.uom ? String(body.uom).trim() : "buc";

  const weightKg =
    body?.weight_kg == null || body.weight_kg === ""
      ? null
      : Number(String(body.weight_kg).replace(",", "."));

  const lengthMm = body?.length_mm == null || body.length_mm === "" ? null : Number(body.length_mm);
  const widthMm = body?.width_mm == null || body.width_mm === "" ? null : Number(body.width_mm);
  const heightMm = body?.height_mm == null || body.height_mm === "" ? null : Number(body.height_mm);

  const categoryIds: string[] = Array.isArray(body?.category_ids)
    ? body.category_ids.map((x: any) => String(x)).filter(Boolean)
    : [];

  if (!sku || sku.length < 2) return json({ ok: false, error: "SKU invalid." }, 400);
  if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  if (!slug) return json({ ok: false, error: "Slug invalid." }, 400);
  if (!taxRateId) return json({ ok: false, error: "Selectează TVA." }, 400);
  if (!Number.isFinite(priceGross) || priceGross < 0) return json({ ok: false, error: "Preț invalid." }, 400);

  if (weightKg != null && (!Number.isFinite(weightKg) || weightKg < 0))
    return json({ ok: false, error: "Greutate invalidă." }, 400);

  for (const [label, v] of [
    ["Lungime", lengthMm],
    ["Lățime", widthMm],
    ["Înălțime", heightMm],
  ] as const) {
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      return json({ ok: false, error: `${label} invalidă.` }, 400);
    }
  }

  try {
    const rows = await sql`
      WITH upd AS (
        UPDATE product
        SET
          sku = ${sku},
          slug = ${slug},
          name = ${name},
          description = ${description},
          brand_id = ${brandId},
          tax_rate_id = ${taxRateId},
          code = ${code},
          code_normalized = ${codeNorm},
          external_code = ${externalCode},
          price_gross = ${priceGross},
          uom = ${uom},
          weight_kg = ${weightKg},
          length_mm = ${lengthMm},
          width_mm = ${widthMm},
          height_mm = ${heightMm},
          is_active = ${isActive},
          updated_at = now()
        WHERE id = ${id}::uuid
        RETURNING id
      ),
      del AS (
        DELETE FROM product_category
        WHERE product_id = (SELECT id FROM upd)
        RETURNING 1
      ),
      cats AS (
        SELECT unnest(${categoryIds}::uuid[]) AS category_id
      ),
      ins AS (
        INSERT INTO product_category (product_id, category_id)
        SELECT (SELECT id FROM upd), cats.category_id
        FROM cats
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      SELECT (SELECT id FROM upd) AS id
    `;

    const okId = (rows as any[])?.[0]?.id as string | undefined;
    if (!okId) return json({ ok: false, error: "Produs inexistent." }, 404);

    return json({ ok: true, id: okId });
  } catch (e: any) {
    const msg = e?.code === "23505" ? "SKU sau slug deja există." : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  try {
    // explicit cleanup (works even if you don't have ON DELETE CASCADE)
    const rows = await sql`
      WITH del_cat AS (
        DELETE FROM product_category WHERE product_id = ${id}::uuid
        RETURNING 1
      ),
      del_prod AS (
        DELETE FROM product WHERE id = ${id}::uuid
        RETURNING id
      )
      SELECT (SELECT id FROM del_prod) AS id
    `;

    const deleted = (rows as any[])?.[0]?.id as string | undefined;
    if (!deleted) return json({ ok: false, error: "Produs inexistent." }, 404);
    return json({ ok: true, id: deleted });
  } catch {
    return json({ ok: false, error: "Eroare la ștergere." }, 500);
  }
}