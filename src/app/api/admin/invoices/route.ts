import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { sql } from "@/lib/db";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/* ── GET: list invoices ── */
export async function GET(req: Request) {
  await requireStaff(req, ["admin", "sales", "sales_rep"]);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const q = (searchParams.get("q") || "").trim();

  const like = q ? `%${q}%` : null;

  const rows = like
    ? ((await sql`
        SELECT
          i.id, i.invoice_type, i.series, i.number, i.invoice_date, i.due_date,
          i.delivery_method, i.payment_method, i.plate_no,
          i.total_net, i.total_tax, i.total_gross,
          i.created_at,
          a.display_name AS customer_name,
          a.tax_id AS customer_vat,
          p.full_name AS created_by_name
        FROM invoice i
        JOIN account a ON a.id = i.account_id
        LEFT JOIN profile p ON p.user_id = i.created_by
        WHERE a.display_name ILIKE ${like}
           OR i.series || ' ' || i.number::text ILIKE ${like}
           OR i.number::text = ${q}
        ORDER BY i.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `) as any[])
    : ((await sql`
        SELECT
          i.id, i.invoice_type, i.series, i.number, i.invoice_date, i.due_date,
          i.delivery_method, i.payment_method, i.plate_no,
          i.total_net, i.total_tax, i.total_gross,
          i.created_at,
          a.display_name AS customer_name,
          a.tax_id AS customer_vat,
          p.full_name AS created_by_name
        FROM invoice i
        JOIN account a ON a.id = i.account_id
        LEFT JOIN profile p ON p.user_id = i.created_by
        ORDER BY i.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `) as any[]);

  return json({ ok: true, items: rows });
}

/* ── POST: create invoice from order ── */
export async function POST(req: Request) {
  const user = await requireStaff(req, ["admin", "sales", "sales_rep"]);

  const body = await req.json().catch(() => null);
  const orderId = String(body?.orderId ?? "").trim();
  const invoiceType: string = body?.invoiceType === "proforma" ? "proforma" : "definitiva";
  const deliveryMethod = String(body?.deliveryMethod ?? "").trim();
  const paymentMethod = String(body?.paymentMethod ?? "").trim();
  const dueDays = Number(body?.dueDays) || null;

  if (!orderId) return json({ error: "orderId este obligatoriu." }, 400);
  if (!deliveryMethod) return json({ error: "Modalitatea de livrare este obligatorie." }, 400);
  if (!paymentMethod) return json({ error: "Modalitatea de plata este obligatorie." }, 400);

  // Fetch order with account + vehicle
  const orders = (await sql`
    SELECT
      o.id, o.offer_id, o.account_id, o.vehicle_id, o.notes,
      a.display_name, a.tax_id, a.reg_no, a.email, a.phone,
      a.billing_line1, a.billing_city, a.billing_zip, a.billing_country,
      v.plate_no, v.make, v.model, v.chassis_vin, v.engine_code, v.year
    FROM "order" o
    JOIN account a ON a.id = o.account_id
    LEFT JOIN vehicle v ON v.id = o.vehicle_id
    WHERE o.id = ${orderId}::uuid
    LIMIT 1
  `) as any[];

  if (!orders.length) return json({ error: "Comanda nu a fost gasita." }, 404);
  const order = orders[0];

  const orderItems = (await sql`
    SELECT
      oi.product_id, p.name, oi.qty, oi.unit_price_net,
      oi.tax_rate, oi.line_net, oi.line_tax,
      p.sku, p.uom
    FROM order_item oi
    LEFT JOIN product p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId}::uuid
    ORDER BY oi.created_at ASC
  `) as any[];

  if (!orderItems.length) return json({ error: "Comanda nu are produse." }, 400);

  // Compute totals from items
  let totalNet = 0, totalTax = 0;
  for (const item of orderItems) {
    totalNet += Number(item.line_net ?? 0);
    totalTax += Number(item.line_tax ?? 0);
  }
  const totalGross = totalNet + totalTax;

  // Generate series + number
  const year = new Date().getFullYear();
  const series = `CCATR${year}`;

  const nextNumRows = (await sql`
    SELECT COALESCE(MAX(number), 0) + 1 AS next_num
    FROM invoice WHERE series = ${series}
  `) as any[];
  const invoiceNumber = nextNumRows[0]?.next_num ?? 1;

  const invoiceDate = new Date().toISOString().split("T")[0];
  const dueDate = dueDays
    ? new Date(Date.now() + dueDays * 86400000).toISOString().split("T")[0]
    : null;

  // Tax rate from first item
  const taxFrac = Number(orderItems[0]?.tax_rate ?? 0.19);
  const taxRatePct = taxFrac <= 1 ? Math.round(taxFrac * 100) : taxFrac;

  // Insert invoice
  const inserted = (await sql`
    INSERT INTO invoice (
      order_id, offer_id, account_id, vehicle_id, invoice_type,
      series, number, invoice_date, due_date,
      delivery_method, payment_method, plate_no, tax_rate_pct,
      total_net, total_tax, total_gross, notes, created_by
    ) VALUES (
      ${orderId}::uuid, ${order.offer_id || null}::uuid, ${order.account_id}::uuid,
      ${order.vehicle_id || null}::uuid,
      ${invoiceType}, ${series}, ${invoiceNumber},
      ${invoiceDate}::date, ${dueDate}::date,
      ${deliveryMethod}, ${paymentMethod},
      ${order.plate_no || ""}, ${taxRatePct},
      ${totalNet}, ${totalTax}, ${totalGross},
      ${order.notes || null}, ${user.userId}::uuid
    ) RETURNING id
  `) as any[];

  const invoiceId = inserted[0]?.id;

  // Insert items
  for (let i = 0; i < orderItems.length; i++) {
    const item = orderItems[i];
    await sql`
      INSERT INTO invoice_item (
        invoice_id, product_id, code, name, uom,
        quantity, unit_price_net, line_net, line_tax, sort_order
      ) VALUES (
        ${invoiceId}::uuid,
        ${item.product_id}::uuid,
        ${item.sku || ""},
        ${item.name},
        ${item.uom || "BUC"},
        ${Number(item.qty)},
        ${Number(item.unit_price_net)},
        ${Number(item.line_net)},
        ${Number(item.line_tax)},
        ${i}
      )
    `;
  }

  return json({
    ok: true,
    invoice: {
      id: invoiceId,
      series,
      number: invoiceNumber,
      invoiceType,
      invoiceDate,
      dueDate,
    },
  });
}
