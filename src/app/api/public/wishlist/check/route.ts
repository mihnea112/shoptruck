import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// GET /api/public/wishlist/check?product_id=... - Check if product is in wishlist
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return json({ ok: false, error: "Neautorizat." }, 401);
    }

    const url = new URL(req.url);
    const product_id = url.searchParams.get("product_id");

    if (!product_id) {
      return json(
        { ok: false, error: "product_id este necesar." },
        400
      );
    }

    const result = await sql`
      SELECT id FROM customer_wishlist
      WHERE customer_id = ${user.userId}::uuid
      AND product_id = ${product_id}::uuid
      LIMIT 1
    `;

    return json({
      ok: true,
      is_favorited: result.length > 0,
    });
  } catch (e: any) {
    console.error("[API wishlist check GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
