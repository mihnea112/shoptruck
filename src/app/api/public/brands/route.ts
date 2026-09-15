import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT b.id, b.name, b.slug, COUNT(p.id)::int AS product_count
      FROM brand b
      JOIN product p ON p.brand_id = b.id AND p.is_active = true
      GROUP BY b.id HAVING COUNT(p.id) > 0 ORDER BY b.name`);
    return NextResponse.json({ ok: true, items: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
