import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/api";
import { sql } from "@/lib/db";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff(req, ["admin", "sales", "sales_rep"]);
  const { id } = await params;

  const rows = (await sql`
    SELECT
      i.id, i.invoice_type, i.series, i.number,
      i.invoice_date, i.due_date,
      i.delivery_method, i.payment_method, i.plate_no,
      i.tax_rate_pct,
      i.total_net, i.total_tax, i.total_gross,
      i.notes,
      a.display_name, a.tax_id, a.reg_no, a.email, a.phone,
      a.billing_line1, a.billing_city, a.billing_zip, a.billing_country,
      v.plate_no AS v_plate, v.make, v.model, v.chassis_vin, v.engine_code, v.year
    FROM invoice i
    JOIN account a ON a.id = i.account_id
    LEFT JOIN vehicle v ON v.id = i.vehicle_id
    WHERE i.id = ${id}::uuid
    LIMIT 1
  `) as any[];

  if (!rows.length) return json({ error: "Factura nu a fost gasita." }, 404);
  const inv = rows[0];

  const items = (await sql`
    SELECT code, name, uom, quantity, unit_price_net, line_net, line_tax
    FROM invoice_item
    WHERE invoice_id = ${id}::uuid
    ORDER BY sort_order ASC
  `) as any[];

  const invoiceDate = inv.invoice_date
    ? new Date(inv.invoice_date).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";
  const dueDate = inv.due_date
    ? new Date(inv.due_date).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return json({
    ok: true,
    data: {
      invoiceType: inv.invoice_type,
      series: inv.series,
      number: inv.number,
      invoiceDate,
      dueDate,
      taxRatePct: Number(inv.tax_rate_pct),
      deliveryMethod: inv.delivery_method || "",
      paymentMethod: inv.payment_method || "",
      plateNo: inv.plate_no || inv.v_plate || "",
      customer: {
        display_name: inv.display_name,
        vat_id: inv.tax_id,
        reg_no: inv.reg_no,
        phone: inv.phone,
        email: inv.email,
        address: inv.billing_line1,
        city: inv.billing_city,
        county: inv.billing_country,
      },
      items: items.map((it: any) => ({
        code: it.code || "",
        name: it.name,
        uom: it.uom || "BUC",
        quantity: Number(it.quantity),
        unitPriceNet: Number(it.unit_price_net),
        lineNet: Number(it.line_net),
        lineTax: Number(it.line_tax),
      })),
      totalNet: Number(inv.total_net),
      totalTax: Number(inv.total_tax),
      totalGross: Number(inv.total_gross),
    },
  });
}
