import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";
import { decryptPII } from "@/lib/crypto/pii";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) return json({ ok: false, error: "Neautorizat." }, 401);

    const { id } = await ctx.params;

    const accounts = await sql`
      SELECT id, display_name, email, phone, tax_id, reg_no,
             billing_line1, billing_city, billing_zip
      FROM account WHERE user_id = ${user.userId}::uuid LIMIT 1
    `;
    if (!accounts.length) return json({ ok: false, error: "Cont inexistent." }, 400);
    const acct = accounts[0];

    const orders = await sql`
      SELECT o.id, o.status, o.notes, o.delivery_method, o.payment_method,
             o.created_at
      FROM public."order" o
      WHERE o.id = ${id}::uuid AND o.account_id = ${acct.id}::uuid
      LIMIT 1
    `;
    if (!orders.length) return json({ ok: false, error: "Comandă negăsită." }, 404);
    const order = orders[0];

    const items = await sql`
      SELECT
        oi.product_id,
        oi.qty,
        oi.unit_price_net,
        oi.tax_rate,
        oi.line_net,
        oi.line_tax,
        oi.line_gross,
        p.name as product_name,
        p.sku as product_sku,
        p.uom as product_uom
      FROM public.order_item oi
      JOIN product p ON p.id = oi.product_id
      WHERE oi.order_id = ${id}::uuid
      ORDER BY oi.created_at ASC
    `;

    const totalNet = items.reduce((s: number, i: any) => s + Number(i.line_net), 0);
    const totalTax = items.reduce((s: number, i: any) => s + Number(i.line_tax), 0);
    const totalGross = items.reduce((s: number, i: any) => s + Number(i.line_gross), 0);

    const taxRate = items.length > 0 ? Number(items[0].tax_rate) : 0.19;
    const taxRatePct = taxRate <= 1 ? taxRate * 100 : taxRate;

    return json({
      ok: true,
      data: {
        invoiceType: "definitiva" as const,
        series: "SHT",
        number: parseInt(order.id.replace(/-/g, "").slice(0, 8), 16) % 100000,
        invoiceDate: new Date(order.created_at).toISOString().slice(0, 10),
        dueDate: null,
        taxRatePct,
        deliveryMethod: order.delivery_method === "pickup" ? "ridicare din depozit" : "curier",
        paymentMethod: order.payment_method === "card" ? "card" : "OP",
        plateNo: "",
        customer: {
          display_name: acct.display_name || "",
          vat_id: decryptPII(acct.tax_id) || null,
          reg_no: decryptPII(acct.reg_no) || null,
          phone: decryptPII(acct.phone) || null,
          email: acct.email || null,
          address: decryptPII(acct.billing_line1) || null,
          city: acct.billing_city || null,
        },
        items: items.map((i: any) => ({
          code: i.product_sku || "",
          name: i.product_name || "",
          uom: i.product_uom || "buc",
          quantity: Number(i.qty),
          unitPriceNet: Number(i.unit_price_net),
          lineNet: Number(i.line_net),
          lineTax: Number(i.line_tax),
        })),
        totalNet,
        totalTax,
        totalGross,
      },
    });
  } catch (e: any) {
    console.error("[API user/orders/:id GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
