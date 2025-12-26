import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

// Helper auth
async function checkAuth(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (user.kind !== "staff") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ț/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- GET: Detalii produs ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await checkAuth(req);
  if (authRes) return authRes;

  const { id } = await params;

  try {
    // UPDATED: Table names singular (product, brand, product_code)
    const productRows = await sql`
      SELECT 
        p.*,
        b.name as brand_name,
        json_agg(
            json_build_object(
                'id', pc.id,
                'code', pc.code,
                'code_type', pc.code_type,
                'is_primary', pc.is_primary
            )
        ) FILTER (WHERE pc.id IS NOT NULL) as codes
      FROM product p
      LEFT JOIN brand b ON p.brand_id = b.id
      LEFT JOIN product_code pc ON p.id = pc.product_id
      WHERE p.id = ${id}
      GROUP BY p.id, b.name
    `;

    if (productRows.length === 0) {
      return NextResponse.json({ ok: false, error: "Produsul nu există." }, { status: 404 });
    }

    const product = productRows[0];

    // UPDATED: product_category (singular assumed)
    // Daca tabelul de legatura are alt nume (ex: products_categories), trebuie ajustat aici
    const catRows = await sql`
      SELECT category_id FROM product_category WHERE product_id = ${id}
    `;
    const category_ids = catRows.map((r: any) => r.category_id);

    return NextResponse.json({
      ok: true,
      item: product,
      category_ids,
    });
  } catch (err: any) {
    console.error("GET product error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// --- PATCH: Actualizare produs ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await checkAuth(req);
  if (authRes) return authRes;

  const { id } = await params;

  try {
    const body = await req.json();
    
    if (!body.sku || !body.name) {
      return NextResponse.json({ ok: false, error: "SKU și Nume sunt obligatorii." }, { status: 400 });
    }

    const newSlug = body.slug ? body.slug : slugify(body.name);

    // UPDATED: Table 'product'
    await sql`
      UPDATE product
      SET
        sku = ${body.sku},
        name = ${body.name},
        slug = ${newSlug},
        description = ${body.description || null},
        price_gross = ${body.price_gross || 0},
        tax_rate_id = ${body.tax_rate_id},
        is_active = ${body.is_active ?? true},
        external_code = ${body.external_code || null},
        brand_id = ${body.brand_id || null},
        uom = ${body.uom || 'buc'},
        weight_kg = ${body.weight_kg || null},
        length_mm = ${body.length_mm || null},
        width_mm = ${body.width_mm || null},
        height_mm = ${body.height_mm || null},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // UPDATED: Table 'product_category'
    if (Array.isArray(body.category_ids)) {
      await sql`DELETE FROM product_category WHERE product_id = ${id}`;
      for (const catId of body.category_ids) {
        await sql`
          INSERT INTO product_category (product_id, category_id)
          VALUES (${id}, ${catId})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    // UPDATED: Table 'product' (code fields)
    if (body.code) {
       await sql`
         UPDATE product 
         SET code = ${body.code}, 
             code_normalized = ${body.code_normalized || body.code}
         WHERE id = ${id}
       `;
    }

    // UPDATED: Table 'product_code'
    if (Array.isArray(body.equivalent_codes)) {
      await sql`
        DELETE FROM product_code 
        WHERE product_id = ${id} AND is_primary = false
      `;

      for (const c of body.equivalent_codes) {
        if (c && typeof c === 'string') {
           const cNorm = c.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
           await sql`
             INSERT INTO product_code (product_id, code, code_normalized, code_type, is_primary)
             VALUES (${id}, ${c}, ${cNorm}, 'other', false)
           `;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PATCH product error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// --- DELETE: Ștergere produs ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authRes = await checkAuth(req);
  if (authRes) return authRes;

  const { id } = await params;

  try {
    // UPDATED: Singular tables
    await sql`DELETE FROM product_category WHERE product_id = ${id}`;
    await sql`DELETE FROM product_code WHERE product_id = ${id}`;
    await sql`DELETE FROM product WHERE id = ${id}`;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE product error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}