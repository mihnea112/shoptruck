import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireAdmin, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    await requireStaff(req);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const parentId = (searchParams.get("parentId") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    const rows = await sql`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.parent_id,
        0::int AS product_count
      FROM category c
      WHERE
        (${q} = '' OR c.name ILIKE '%' || ${q} || '%' OR c.slug ILIKE '%' || ${q} || '%')
        AND (
          ${parentId} = ''
          OR c.parent_id = NULLIF(${parentId}, '')::uuid
        )
      ORDER BY c.name
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
    await requireStaff(req);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type invalid. Folosește application/json." }, 415);
    }

    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();
    const slug = String(body?.slug ?? "").trim();
    const parentIdRaw = body?.parent_id ?? null;
    const parentId = parentIdRaw ? String(parentIdRaw).trim() : null;

    if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
    if (!slug || slug.length < 2) return json({ ok: false, error: "Slug invalid." }, 400);

    const rows = await sql`
      INSERT INTO category (name, slug, parent_id)
      VALUES (${name}, ${slug}, ${parentId}::uuid)
      RETURNING id
    `;

    const id = (rows as any[])?.[0]?.id as string | undefined;
    if (!id) return json({ ok: false, error: "Eroare la creare categorie." }, 500);

    return json({ ok: true, id });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    const msg = e?.code === "23505" ? "Slug deja există." : e?.message || "Eroare internă.";
    return json({ ok: false, error: msg }, status);
  }
}