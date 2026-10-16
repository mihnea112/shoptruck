import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { publicImageUrl } from "@/lib/storage-url";
export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT b.id, b.name, b.slug, b.logo_path, COUNT(p.id)::int AS product_count
      FROM brand b
      JOIN product p ON p.brand_id = b.id AND p.is_active = true
      GROUP BY b.id HAVING COUNT(p.id) > 0 ORDER BY b.name`);
    const items = rows.map(({ logo_path, ...r }) => ({ ...r, logo_url: publicImageUrl(logo_path) }));
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
