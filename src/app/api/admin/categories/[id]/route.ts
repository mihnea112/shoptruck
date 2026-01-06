import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };
async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params);
  return String((p as any).id);
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);
    const id = await getId(ctx);

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
      UPDATE category
      SET name=${name}, slug=${slug}, parent_id=${parentId}::uuid
      WHERE id = ${id}::uuid
      RETURNING id
    `;

    const okId = (rows as any[])?.[0]?.id as string | undefined;
    if (!okId) return json({ ok: false, error: "Categorie inexistentă." }, 404);

    return json({ ok: true, id: okId });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    const msg = e?.code === "23505" ? "Slug deja există." : e?.message || "Eroare internă.";
    return json({ ok: false, error: msg }, status);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);
    const id = await getId(ctx);

    const used = await sql`SELECT 1 FROM product_category WHERE category_id = ${id}::uuid LIMIT 1`;
    if (Array.isArray(used) && used.length > 0) {
      return json({ ok: false, error: "Categoria are produse asociate." }, 409);
    }

    const rows = await sql`DELETE FROM category WHERE id = ${id}::uuid RETURNING id`;
    const deleted = (rows as any[])?.[0]?.id as string | undefined;
    if (!deleted) return json({ ok: false, error: "Categorie inexistentă." }, 404);

    return json({ ok: true, id: deleted });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare la ștergere." }, status);
  }
}