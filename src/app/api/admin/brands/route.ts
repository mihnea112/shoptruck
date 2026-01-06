import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    const rows = await sql`
      SELECT
        b.id,
        b.name,
        (SELECT COUNT(*)::int FROM product p WHERE p.brand_id = b.id) AS product_count
      FROM brand b
      WHERE (${q} = '' OR b.name ILIKE '%' || ${q} || '%')
      ORDER BY b.name
      LIMIT ${limit} OFFSET ${offset}
    `;

    return json({ ok: true, items: rows, limit, offset });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type invalid. Folosește application/json." }, 415);
    }

    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();

    if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);

    const rows = await sql`INSERT INTO brand (name) VALUES (${name}) RETURNING id`;
    const id = (rows as any[])?.[0]?.id as string | undefined;
    if (!id) return json({ ok: false, error: "Eroare la creare brand." }, 500);

    return json({ ok: true, id });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}