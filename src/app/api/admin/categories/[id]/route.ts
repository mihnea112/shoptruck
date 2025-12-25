import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };

async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params);
  return String((p as any).id);
}

export async function GET(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  const rows = await sql`
    SELECT id, name, slug, parent_id
    FROM category
    WHERE id = ${id}
    LIMIT 1
  `;
  const item = (rows as any[])?.[0];
  if (!item) return json({ ok: false, error: "Categoria nu a fost găsită." }, 404);

  const productCountRows = await sql`
    SELECT COUNT(*)::int AS product_count
    FROM product_category
    WHERE category_id = ${id}
  `;
  const productCount = (productCountRows as any[])?.[0]?.product_count ?? 0;

  const childrenRows = await sql`
    SELECT id, name, slug
    FROM category
    WHERE parent_id = ${id}::uuid
    ORDER BY name
    LIMIT 500
  `;

  return json({ ok: true, item, productCount, children: childrenRows });
}

export async function PATCH(req: Request, ctx: Ctx) {
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
  if (parentId && parentId === id) return json({ ok: false, error: "parent_id nu poate fi egal cu id." }, 400);

  try {
    const rows = await sql`
      UPDATE category
      SET name = ${name}, slug = ${slug}, parent_id = ${parentId}::uuid
      WHERE id = ${id}
      RETURNING id
    `;
    const okId = (rows as any[])?.[0]?.id as string | undefined;
    if (!okId) return json({ ok: false, error: "Categoria nu a fost găsită." }, 404);

    return json({ ok: true, id: okId });
  } catch (e: any) {
    const msg = e?.code === "23505" ? "Slug deja există." : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  try {
    const child = await sql`SELECT 1 FROM category WHERE parent_id = ${id}::uuid LIMIT 1`;
    if (Array.isArray(child) && child.length > 0) {
      return json({ ok: false, error: "Categoria are subcategorii. Șterge/relochează subcategoriile întâi." }, 409);
    }

    const used = await sql`SELECT 1 FROM product_category WHERE category_id = ${id}::uuid LIMIT 1`;
    if (Array.isArray(used) && used.length > 0) {
      return json({ ok: false, error: "Categoria are produse asociate. Elimină asocierea înainte de ștergere." }, 409);
    }

    const rows = await sql`DELETE FROM category WHERE id = ${id} RETURNING id`;
    const deleted = (rows as any[])?.[0]?.id as string | undefined;
    if (!deleted) return json({ ok: false, error: "Categoria nu a fost găsită." }, 404);

    return json({ ok: true, id: deleted });
  } catch {
    return json({ ok: false, error: "Eroare la ștergere." }, 500);
  }
}