import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) return NextResponse.json({ ok: true, items: [] });

  try {
    // MODIFICĂRI FAȚĂ DE VERSIUNEA ANTERIOARĂ:
    // 1. Folosim 'price_gross' în loc de 'price'.
    // 2. Folosim 'sku' (existent în lista ta la poz. 12).
    // 3. Punem '19' hardcoded la TVA pentru că avem doar 'tax_rate_id' și nu știm valoarea procentuală din tabela 'tax_rate'.

    const items = await sql`
      SELECT 
        id, 
        name, 
        price_gross AS price,    -- Mapăm coloana din DB la ce așteaptă UI-ul
        19 AS vat_percent,       -- Placeholder până când facem JOIN cu tabela tax_rate
        sku
      FROM product
      WHERE 
        name ILIKE ${`%${q}%`} 
        OR sku ILIKE ${`%${q}%`}
        OR code ILIKE ${`%${q}%`} -- Am adăugat și căutare după 'code' (poz 18) pentru siguranță
      LIMIT 20
    `;

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error("Product Search Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}