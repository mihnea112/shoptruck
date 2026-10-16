import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { publicImageUrl } from "@/lib/storage-url";
export async function GET() {
  try {
    // product_count includes products in all descendant categories
    const { rows } = await pool.query(`
      WITH RECURSIVE tree AS (
        SELECT id, id AS root_id FROM category
        UNION ALL
        SELECT c.id, t.root_id FROM category c JOIN tree t ON c.parent_id = t.id
      ),
      counts AS (
        SELECT t.root_id AS id, COUNT(p.id)::int AS product_count
        FROM tree t
        LEFT JOIN product p ON p.category_id = t.id AND p.is_active = true
        GROUP BY t.root_id
      )
      SELECT c.id, c.name, c.slug, c.parent_id, c.image_path, counts.product_count
      FROM category c JOIN counts ON counts.id = c.id
      ORDER BY c.name`);
    const items = rows.map(({ image_path, ...r }) => ({ ...r, image_url: publicImageUrl(image_path) }));
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
