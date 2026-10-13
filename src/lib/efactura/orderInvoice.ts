import "server-only";
import { sql } from "@/lib/db";
import { sendInvoiceToAnaf } from "./send";

export type OrderInvoiceResult =
  | { ok: true; invoiceId: string; anafStatus: "trimisa" }
  | { ok: true; invoiceId: string; anafStatus: null; anafError: string }
  | { ok: false; error: string };

/**
 * Creates a "definitiva" invoice for a paid order (if one doesn't already exist) and submits
 * it to e-Factura. Called from the EuPlatesc payment callback right after an order is marked
 * paid — idempotent, so retried/duplicate webhook deliveries are safe.
 */
export async function createAndSendInvoiceForOrder(orderId: string): Promise<OrderInvoiceResult> {
  const existing = (await sql`
    SELECT id, anaf_status FROM invoice WHERE order_id = ${orderId}::uuid AND invoice_type = 'definitiva' LIMIT 1
  `) as any[];

  let invoiceId: string;

  if (existing.length) {
    invoiceId = existing[0].id;
    if (existing[0].anaf_status === "trimisa" || existing[0].anaf_status === "ok") {
      return { ok: true, invoiceId, anafStatus: "trimisa" };
    }
  } else {
    const orders = (await sql`
      SELECT o.id, o.account_id, o.vehicle_id, o.notes, o.delivery_method, o.payment_method
      FROM "order" o
      WHERE o.id = ${orderId}::uuid
      LIMIT 1
    `) as any[];
    if (!orders.length) return { ok: false, error: "Comanda nu a fost gasita." };
    const order = orders[0];

    const orderItems = (await sql`
      SELECT oi.product_id, p.name, oi.qty, oi.unit_price_net, oi.tax_rate, oi.line_net, oi.line_tax, p.sku, p.uom
      FROM order_item oi
      LEFT JOIN product p ON p.id = oi.product_id
      WHERE oi.order_id = ${orderId}::uuid
      ORDER BY oi.created_at ASC
    `) as any[];
    if (!orderItems.length) return { ok: false, error: "Comanda nu are produse." };

    let totalNet = 0, totalTax = 0;
    for (const item of orderItems) {
      totalNet += Number(item.line_net ?? 0);
      totalTax += Number(item.line_tax ?? 0);
    }
    const totalGross = totalNet + totalTax;

    const year = new Date().getFullYear();
    const series = `CCATR${year}`;
    const nextNumRows = (await sql`
      SELECT COALESCE(MAX(number), 0) + 1 AS next_num FROM invoice WHERE series = ${series}
    `) as any[];
    const invoiceNumber = nextNumRows[0]?.next_num ?? 1;
    const invoiceDate = new Date().toISOString().split("T")[0];

    const taxFrac = Number(orderItems[0]?.tax_rate ?? 0.19);
    const taxRatePct = taxFrac <= 1 ? Math.round(taxFrac * 100) : taxFrac;

    const inserted = (await sql`
      INSERT INTO invoice (
        order_id, account_id, vehicle_id, invoice_type,
        series, number, invoice_date,
        delivery_method, payment_method, tax_rate_pct,
        total_net, total_tax, total_gross, notes
      ) VALUES (
        ${orderId}::uuid, ${order.account_id}::uuid, ${order.vehicle_id || null}::uuid,
        'definitiva', ${series}, ${invoiceNumber}, ${invoiceDate}::date,
        ${order.delivery_method || ""}, ${order.payment_method || "card"}, ${taxRatePct},
        ${totalNet}, ${totalTax}, ${totalGross}, ${order.notes || null}
      ) RETURNING id
    `) as any[];
    invoiceId = inserted[0].id;

    for (let i = 0; i < orderItems.length; i++) {
      const item = orderItems[i];
      await sql`
        INSERT INTO invoice_item (
          invoice_id, product_id, code, name, uom,
          quantity, unit_price_net, line_net, line_tax, sort_order
        ) VALUES (
          ${invoiceId}::uuid, ${item.product_id}::uuid, ${item.sku || ""}, ${item.name},
          ${item.uom || "BUC"}, ${Number(item.qty)}, ${Number(item.unit_price_net)},
          ${Number(item.line_net)}, ${Number(item.line_tax)}, ${i}
        )
      `;
    }
  }

  const sendResult = await sendInvoiceToAnaf(invoiceId);
  if (!sendResult.ok) return { ok: true, invoiceId, anafStatus: null, anafError: sendResult.error };
  return { ok: true, invoiceId, anafStatus: "trimisa" };
}
