import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// POST /api/public/cart/sync - Sync guest cart to authenticated user's cart
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return json({ ok: false, error: "Neautorizat." }, 401);
    }

    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return json({ ok: false, error: "items trebuie să fie un array." }, 400);
    }

    // Sync each item from localStorage to database
    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || typeof quantity !== "number" || quantity <= 0) {
        continue; // Skip invalid items
      }

      // Insert or update cart item
      await sql`
        INSERT INTO customer_cart (customer_id, product_id, quantity)
        VALUES (${user.userId}::uuid, ${product_id}::uuid, ${quantity}::int)
        ON CONFLICT (customer_id, product_id)
        DO UPDATE SET quantity = customer_cart.quantity + ${quantity}::int, updated_at = NOW()
      `;
    }

    return json({
      ok: true,
      synced: items.length,
      message: `${items.length} produs${items.length !== 1 ? "e" : ""} sincronizate.`,
    });
  } catch (e: any) {
    console.error("[API cart sync POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
