import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function isUuid(v: string) {
  // simple UUID v4-ish validation (good enough for request validation)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

type BulkPatch = {
  brand_id?: string | null;
  category_id?: string | null;
  profit_margin_pct?: number | string | null;
  stock_on_hand?: number | string | null;
  // If you want to extend later:
  // is_active?: boolean;
  // tax_rate_id?: string | null;
  // uom?: string | null;
  // buy_price_net?: number | string | null;
};

export async function PATCH(req: NextRequest) {
  await requireStaff(req, ["ADMIN"]); // bulk operations: keep strict

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json({ ok: false, error: "Content-Type invalid. Folosește application/json." }, 415);
  }

  const body = await req.json().catch(() => null);

  const idsRaw = Array.isArray(body?.ids) ? body.ids : [];
  const ids = idsRaw
    .map((x: any) => String(x ?? "").trim())
    .filter(Boolean);

  const patch: BulkPatch = (body?.patch && typeof body.patch === "object") ? body.patch : {};

  if (!Array.isArray(ids) || ids.length === 0) {
    return json({ ok: false, error: "ids este obligatoriu (listă de UUID-uri)." }, 400);
  }
  if (ids.some((id) => !isUuid(id))) {
    return json({ ok: false, error: "Lista ids conține UUID-uri invalide." }, 400);
  }

  const hasBrand = Object.prototype.hasOwnProperty.call(patch, "brand_id");
  const hasCategory = Object.prototype.hasOwnProperty.call(patch, "category_id");
  const hasMargin = Object.prototype.hasOwnProperty.call(patch, "profit_margin_pct");
  const hasStock = Object.prototype.hasOwnProperty.call(patch, "stock_on_hand");

  if (!hasBrand && !hasCategory && !hasMargin && !hasStock) {
    return json({
      ok: false,
      error: "patch trebuie să conțină cel puțin unul din: brand_id, category_id, profit_margin_pct, stock_on_hand.",
    }, 400);
  }

  const brandId =
    hasBrand ? (patch.brand_id == null || String(patch.brand_id).trim() === "" ? null : String(patch.brand_id).trim()) : null;

  const categoryId =
    hasCategory ? (patch.category_id == null || String(patch.category_id).trim() === "" ? null : String(patch.category_id).trim()) : null;

  let margin: number | null = null;
  if (hasMargin) {
    if (patch.profit_margin_pct == null || String(patch.profit_margin_pct).trim() === "") {
      margin = null;
    } else {
      const m = Number(String(patch.profit_margin_pct).replace(",", "."));
      if (!Number.isFinite(m) || m < 0) {
        return json({ ok: false, error: "profit_margin_pct invalid (>= 0)." }, 400);
      }
      margin = m;
    }
  }

  let stockOnHand: number | null = null;
  if (hasStock) {
    if (patch.stock_on_hand == null || String(patch.stock_on_hand).trim() === "") {
      stockOnHand = null;
    } else {
      const s = Number(String(patch.stock_on_hand).replace(",", "."));
      if (!Number.isFinite(s) || s < 0) {
        return json({ ok: false, error: "stock_on_hand invalid (>= 0)." }, 400);
      }
      stockOnHand = s;
    }
  }

  if (hasBrand && brandId !== null && !isUuid(brandId)) {
    return json({ ok: false, error: "brand_id invalid." }, 400);
  }
  if (hasCategory && categoryId !== null && !isUuid(categoryId)) {
    return json({ ok: false, error: "category_id invalid." }, 400);
  }

  // Optional: Validate referenced brand/category exist (recommended)
  try {
    if (hasBrand && brandId) {
      const b = await sql`SELECT id FROM brand WHERE id = ${brandId}::uuid LIMIT 1`;
      if (!Array.isArray(b) || b.length === 0) return json({ ok: false, error: "Brand inexistent." }, 404);
    }
    if (hasCategory && categoryId) {
      const c = await sql`SELECT id FROM category WHERE id = ${categoryId}::uuid LIMIT 1`;
      if (!Array.isArray(c) || c.length === 0) return json({ ok: false, error: "Categorie inexistentă." }, 404);
    }
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare la validare." }, 500);
  }

  try {
    const rows = (await sql`
      UPDATE product
      SET
        brand_id = CASE
          WHEN ${hasBrand} THEN ${brandId ? sql`${brandId}::uuid` : null}
          ELSE brand_id
        END,
        category_id = CASE
          WHEN ${hasCategory} THEN ${categoryId ? sql`${categoryId}::uuid` : null}
          ELSE category_id
        END,
        profit_margin_pct = CASE
          WHEN ${hasMargin} THEN ${margin}
          ELSE profit_margin_pct
        END,
        stock_on_hand = CASE
          WHEN ${hasStock} THEN ${stockOnHand}
          ELSE stock_on_hand
        END,
        updated_at = now()
      WHERE id = ANY(${ids}::uuid[])
      RETURNING id
    `) as any[];

    return json({ ok: true, updated: rows?.length || 0, ids: (rows || []).map((r) => r.id) });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "Eroare internă." }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  await requireStaff(req, ["ADMIN"]); // delete is admin-only

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json({ ok: false, error: "Content-Type invalid. Folosește application/json." }, 415);
  }

  const body = await req.json().catch(() => null);

  const idsRaw = Array.isArray(body?.ids) ? body.ids : [];
  const ids = idsRaw
    .map((x: any) => String(x ?? "").trim())
    .filter(Boolean);

  if (!Array.isArray(ids) || ids.length === 0) {
    return json({ ok: false, error: "ids este obligatoriu (listă de UUID-uri)." }, 400);
  }
  if (ids.some((id) => !isUuid(id))) {
    return json({ ok: false, error: "Lista ids conține UUID-uri invalide." }, 400);
  }

  try {
    // If you have foreign keys without ON DELETE CASCADE,
    // you must delete dependent rows first (e.g. product_code / product_equivalent_code).
    // Example (uncomment if needed):
    // await sql`DELETE FROM product_equivalent_code WHERE product_id = ANY(${ids}::uuid[])`;

    const rows = (await sql`
      DELETE FROM product
      WHERE id = ANY(${ids}::uuid[])
      RETURNING id
    `) as any[];

    return json({ ok: true, deleted: rows?.length || 0, ids: (rows || []).map((r) => r.id) });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "Eroare internă." }, 500);
  }
}