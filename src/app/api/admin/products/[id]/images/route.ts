import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ["ADMIN", "SALES_REP"]); // view ok
    const { id: productId } = await ctx.params;

    const rows = await sql`
      select id, product_id, storage_path, alt, sort_order, is_primary, created_at
      from product_image
      where product_id = ${productId}::uuid
      order by is_primary desc, sort_order asc, created_at asc
    `;

    return json({ ok: true, items: rows });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ["ADMIN"]);
    const { id: productId } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const storagePath = String(body?.storage_path || "").trim();
    const alt = body?.alt != null ? String(body.alt).trim() : null;
    const sortOrder = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 0;
    const isPrimary = body?.is_primary === true;

    if (!storagePath) return json({ ok: false, error: "storage_path lipsă." }, 400);

    const rows = await sql`
      insert into product_image (product_id, storage_path, alt, sort_order, is_primary)
      values (${productId}::uuid, ${storagePath}, ${alt}, ${sortOrder}, ${isPrimary})
      returning id
    `;

    return json({ ok: true, id: (rows as any[])?.[0]?.id });
  } catch (e: any) {
    const msg = e?.code === "23505"
      ? "Imagine primary deja existentă sau duplicat."
      : (e?.message || "Eroare.");
    return json({ ok: false, error: msg }, 500);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ["ADMIN"]);
    const { id: productId } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const imageId = String(searchParams.get("imageId") || "").trim();
    if (!imageId) return json({ ok: false, error: "imageId lipsă." }, 400);

    // Find image to verify it exists and belongs to this product
    const checkRows = await sql`
      select id from product_image
      where id = ${imageId}::uuid and product_id = ${productId}::uuid
      limit 1
    `;
    if ((checkRows as any[]).length === 0) {
      return json({ ok: false, error: "Imagine inexistentă." }, 404);
    }

    // Remove primary from all images for this product, then set this one as primary
    await sql`
      update product_image
      set is_primary = false
      where product_id = ${productId}::uuid and is_primary = true
    `;

    await sql`
      update product_image
      set is_primary = true
      where id = ${imageId}::uuid
    `;

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ["ADMIN"]);
    const { id: productId } = await ctx.params;

    const { searchParams } = new URL(req.url);
    const imageId = String(searchParams.get("imageId") || "").trim();
    if (!imageId) return json({ ok: false, error: "imageId lipsă." }, 400);

    // find image row
    const rows = await sql`
      select id, storage_path
      from product_image
      where id = ${imageId}::uuid and product_id = ${productId}::uuid
      limit 1
    `;
    const row = (rows as any[])?.[0];
    if (!row) return json({ ok: false, error: "Imagine inexistentă." }, 404);

    // delete db row
    await sql`delete from product_image where id = ${imageId}::uuid`;

    // delete from storage (best-effort)
    const sb = supabaseAdmin();
    await sb.storage.from("product-images").remove([row.storage_path]);

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, Number(e?.status ?? 500));
  }
}