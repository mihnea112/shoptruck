import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/auth/api";
import { sql } from "@/lib/db";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  await requireWarehouse(req);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const q = (searchParams.get("q") || "").trim();

  let rows: any[];

  if (q) {
    const like = `%${q}%`;
    rows = (await sql`
      SELECT
        gr.id,
        gr.document_number,
        gr.supplier_name,
        gr.note,
        gr.source,
        gr.created_at,
        p.full_name AS created_by_name,
        COUNT(gri.id)::int AS items_count,
        COALESCE(SUM(gri.quantity), 0) AS total_quantity,
        COALESCE(SUM(gri.quantity * gri.buy_price), 0) AS total_value
      FROM goods_receipt gr
      LEFT JOIN profile p ON p.user_id = gr.uploaded_by
      LEFT JOIN goods_receipt_item gri ON gri.receipt_id = gr.id
      WHERE gr.document_number ILIKE ${like}
         OR gr.supplier_name ILIKE ${like}
         OR gr.note ILIKE ${like}
      GROUP BY gr.id, p.full_name
      ORDER BY gr.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as any[];
  } else {
    rows = (await sql`
      SELECT
        gr.id,
        gr.document_number,
        gr.supplier_name,
        gr.note,
        gr.source,
        gr.created_at,
        p.full_name AS created_by_name,
        COUNT(gri.id)::int AS items_count,
        COALESCE(SUM(gri.quantity), 0) AS total_quantity,
        COALESCE(SUM(gri.quantity * gri.buy_price), 0) AS total_value
      FROM goods_receipt gr
      LEFT JOIN profile p ON p.user_id = gr.uploaded_by
      LEFT JOIN goods_receipt_item gri ON gri.receipt_id = gr.id
      GROUP BY gr.id, p.full_name
      ORDER BY gr.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as any[];
  }

  return json({ ok: true, items: rows });
}
