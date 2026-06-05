import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req, ["ADMIN"]);
    const { id: productId } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);

    let imageId = String(body?.imageId || "").trim();
    if (!imageId) {
      imageId = String(searchParams.get("imageId") || "").trim();
    }

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
