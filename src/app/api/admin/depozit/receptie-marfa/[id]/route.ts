import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/auth/api";
import { sql } from "@/lib/db";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireWarehouse(req);
  const { id } = await params;

  const receipts = (await sql`
    SELECT
      gr.id,
      gr.document_number,
      gr.supplier_name,
      gr.note,
      gr.source,
      gr.created_at,
      p.full_name AS created_by_name
    FROM goods_receipt gr
    LEFT JOIN profile p ON p.user_id = gr.uploaded_by
    WHERE gr.id = ${id}::uuid
    LIMIT 1
  `) as any[];

  if (!receipts.length) return json({ error: "Recepția nu a fost găsită." }, 404);

  const items = (await sql`
    SELECT
      gri.id,
      gri.code,
      gri.name,
      gri.quantity,
      gri.buy_price,
      gri.action,
      pr.name AS product_name,
      pr.stock_on_hand AS current_stock
    FROM goods_receipt_item gri
    LEFT JOIN product pr ON pr.id = gri.product_id
    WHERE gri.receipt_id = ${id}::uuid
    ORDER BY gri.created_at ASC
  `) as any[];

  return json({ ok: true, receipt: receipts[0], items });
}
