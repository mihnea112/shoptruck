import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ț/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function devDbError(e: any) {
  if (process.env.NODE_ENV === "production") return null;
  const code = e?.code ? String(e.code) : null;
  const detail = e?.detail ? String(e.detail) : null;
  const constraint = e?.constraint ? String(e.constraint) : null;
  const message = e?.message ? String(e.message) : null;
  return { code, constraint, detail, message };
}

function mkReqId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function dbg(...args: any[]) {
  if (process.env.NODE_ENV === "production") return;
  console.log(...args);
}

function dbgErr(...args: any[]) {
  if (process.env.NODE_ENV === "production") return;
  console.error(...args);
}

export async function GET(req: Request) {
  try {
    await requireStaff(req);
    const reqId = mkReqId();
    dbg(`[api/admin/brands][GET][${reqId}] start`, { url: req.url });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    dbg(`[api/admin/brands][GET][${reqId}] params`, { q, limit, offset });

    const rows = await sql`
      SELECT
        b.id,
        b.name,
        b.slug,
        (SELECT COUNT(*)::int FROM product p WHERE p.brand_id = b.id) AS product_count
      FROM brand b
      WHERE (${q} = '' OR b.name ILIKE '%' || ${q} || '%')
      ORDER BY b.name
      LIMIT ${limit} OFFSET ${offset}
    `;

    dbg(`[api/admin/brands][GET][${reqId}] rows`, { count: Array.isArray(rows) ? rows.length : null });

    return json({ ok: true, items: rows, limit, offset });
  } catch (e: any) {
    dbgErr(`[api/admin/brands][GET] error`, devDbError(e) ?? e);
    const status = e instanceof ApiError ? e.status : 500;
    return json(
      { ok: false, error: e?.message || "Eroare internă.", ...(devDbError(e) ? { debug: devDbError(e) } : {}) },
      status
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff(req);
    const reqId = mkReqId();
    dbg(`[api/admin/brands][POST][${reqId}] start`, { url: req.url });

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type invalid. Folosește application/json." }, 415);
    }

    const body = await req.json().catch(() => null);
    const name = String(body?.name ?? "").trim();
    const slugIn = String(body?.slug ?? "").trim();

    const baseSlug = slugify(slugIn || name);

    dbg(`[api/admin/brands][POST][${reqId}] payload`, { name, slugIn, baseSlug });

    if (!name || name.length < 2) return json({ ok: false, error: "Numele este obligatoriu." }, 400);
    if (!baseSlug || baseSlug.length < 2) return json({ ok: false, error: "Slug invalid." }, 400);

    try {
      // ensure unique slug by adding a numeric suffix if needed
      let slug = baseSlug;
      for (let i = 0; i < 25; i++) {
        const exists = await sql`SELECT 1 FROM brand WHERE slug = ${slug} LIMIT 1`;
        if (!Array.isArray(exists) || exists.length === 0) break;
        slug = `${baseSlug}-${i + 2}`;
      }

      const rows = await sql`
        INSERT INTO brand (name, slug)
        VALUES (${name}, ${slug})
        RETURNING id
      `;
      const id = (rows as any[])?.[0]?.id as string | undefined;
      dbg(`[api/admin/brands][POST][${reqId}] created`, { id });
      if (!id) return json({ ok: false, error: "Eroare la creare brand." }, 500);

      return json({ ok: true, id, slug });
    } catch (e: any) {
      dbgErr(`[api/admin/brands][POST][${reqId}] db error`, devDbError(e) ?? e);
      // Postgres unique violation
      if (e?.code === "23505") {
        return json({ ok: false, error: "Brand duplicat (nume/slug)." }, 409);
      }
      return json(
        { ok: false, error: "Eroare internă.", ...(devDbError(e) ? { debug: devDbError(e) } : {}) },
        500
      );
    }
  } catch (e: any) {
    dbgErr(`[api/admin/brands][POST] error`, devDbError(e) ?? e);
    const status = e instanceof ApiError ? e.status : 500;
    return json(
      { ok: false, error: e?.message || "Eroare internă.", ...(devDbError(e) ? { debug: devDbError(e) } : {}) },
      status
    );
  }
}