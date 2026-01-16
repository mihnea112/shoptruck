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
  const qLike = `%${qRaw}%`;

  const rows = await sql`
    WITH hit AS (
      SELECT p.id
      FROM product p
      WHERE p.sku ILIKE ${qLike}
         OR p.slug ILIKE ${qLike}
         OR p.name ILIKE ${qLike}

      UNION

      SELECT pc.product_id
      FROM product_code pc
      JOIN part_code c ON c.id = pc.code_id
      WHERE c.code_norm = ${qNorm}
         OR c.code_raw ILIKE ${qLike}

      LIMIT 20
    )
    SELECT
      p.id,
      p.sku,
      p.slug,
      p.name,

      p.buy_price_net,
      p.profit_margin_pct,
      p.is_active,

      tr.name AS tax_name,
      tr.rate AS tax_rate,

      -- Convenience fields for UI
      (CEILING((p.buy_price_net * (1 + (p.profit_margin_pct / 100.0))) * 100) / 100.0) AS price,
      (tr.rate * 100)::int AS vat_percent
    FROM hit
    JOIN product p ON p.id = hit.id
    LEFT JOIN tax_rate tr ON tr.id = p.tax_rate_id
    ORDER BY p.name
  `;

  return json({ ok: true, items: rows });
}