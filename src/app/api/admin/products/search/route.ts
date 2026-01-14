import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeCode(q: string) {
  return q.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function GET(req: Request) {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  if (!qRaw) return json({ ok: true, items: [] });

  const qNorm = normalizeCode(qRaw);

  const rows = await sql`
    WITH hit AS (
      SELECT p.id
      FROM product p
      WHERE p.sku ILIKE ${qRaw}
         OR p.slug ILIKE ${qRaw}
      UNION
      SELECT pc.product_id
      FROM product_code pc
      WHERE pc.code_normalized = ${qNorm}
      UNION
      SELECT pb.product_id
      FROM product_barcode pb
      WHERE pb.barcode = ${qRaw}
      LIMIT 20
    )
    SELECT
      p.id, p.sku, p.slug, p.name,
      p.price_gross, p.buy_price_net, p.profit_margin_pct,
      p.is_active,
      tr.name AS tax_name
    FROM hit
    JOIN product p ON p.id = hit.id
    LEFT JOIN tax_rate tr ON tr.id = p.tax_rate_id
    ORDER BY p.name
  `;

  return json({ ok: true, items: rows });
}