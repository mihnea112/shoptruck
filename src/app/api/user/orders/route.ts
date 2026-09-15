import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return json({ ok: false, error: "Neautorizat." }, 401);

    const accounts = await sql`
      SELECT id FROM account WHERE user_id = ${user.userId}::uuid LIMIT 1
    `;
    if (!accounts.length) return json({ ok: true, items: [] });
    const accountId = accounts[0].id;

    const orders = await sql`
      SELECT
        o.id,
        o.status,
        o.delivery_method,
        o.payment_method,
        o.payment_status,
        o.created_at,
        COALESCE(SUM(oi.line_net), 0) as total_net,
        COALESCE(SUM(oi.line_tax), 0) as total_tax,
        COALESCE(SUM(oi.line_gross), 0) as total_gross,
        COALESCE(SUM(oi.qty), 0)::int as items_count
      FROM public."order" o
      LEFT JOIN public.order_item oi ON oi.order_id = o.id
      WHERE o.account_id = ${accountId}::uuid
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    return json({
      ok: true,
      items: orders.map((o: any) => ({
        id: o.id,
        status: o.status,
        deliveryMethod: o.delivery_method || "courier",
        paymentMethod: o.payment_method || "transfer",
        paymentStatus: o.payment_status || null,
        createdAt: o.created_at,
        totalNet: Number(o.total_net),
        totalTax: Number(o.total_tax),
        totalGross: Number(o.total_gross),
        itemsCount: Number(o.items_count),
      })),
    });
  } catch (e: any) {
    console.error("[API user/orders GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
