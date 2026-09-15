import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.slug, c.parent_id, COUNT(p.id)::int AS product_count
      FROM category c
      LEFT JOIN product p ON p.category_id = c.id AND p.is_active = true
      GROUP BY c.id ORDER BY c.name`);
    return NextResponse.json({ ok: true, items: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
