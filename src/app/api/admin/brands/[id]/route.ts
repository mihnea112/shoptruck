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
    const slugRaw = body?.slug;

    if (!name || name.length < 2) {
      return json({ ok: false, error: "Numele este obligatoriu." }, 400);
    }

    // slug is optional for PATCH; if provided it must be valid.
    // If you want slug auto-generation, send slug from UI or rely on slugify(name).
    let slug: string | null = null;
    if (slugRaw !== undefined) {
      const s = String(slugRaw ?? "").trim();
      if (!s) {
        return json({ ok: false, error: "Slug invalid." }, 400);
      }
      slug = s;
    }

    // If slug explicitly provided but looks like plain name, you can normalize it.
    // Keep it conservative: only normalize if it contains spaces or uppercase.
    if (slug != null) {
      const shouldNormalize = /\s/.test(slug) || slug !== slug.toLowerCase();
      if (shouldNormalize) slug = slugify(slug);
      if (!slug || slug.length < 2) {
        return json({ ok: false, error: "Slug invalid." }, 400);
      }
    }

    let rows;
    try {
      if (slug != null) {
        rows = await sql`
          UPDATE brand
          SET name = ${name}, slug = ${slug}
          WHERE id = ${id}::uuid
          RETURNING id
        `;
      } else {
        rows = await sql`
          UPDATE brand
          SET name = ${name}
          WHERE id = ${id}::uuid
          RETURNING id
        `;
      }
    } catch (err: any) {
      const msg = err?.code === "23505" ? "Slug deja există." : (err?.message || "Eroare internă.");
      return json({ ok: false, error: msg }, 500);
    }
    const okId = (rows as any[])?.[0]?.id as string | undefined;
    if (!okId) return json({ ok: false, error: "Brand inexistent." }, 404);

    return json({ ok: true, id: okId });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);
    const id = await getId(ctx);

    const used = await sql`SELECT 1 FROM product WHERE brand_id=${id}::uuid LIMIT 1`;
    if (Array.isArray(used) && used.length > 0) {
      return json(
        { ok: false, error: "Brand-ul are produse asociate. Elimină brand-ul din produse înainte de ștergere." },
        409
      );
    }

    const rows = await sql`DELETE FROM brand WHERE id=${id}::uuid RETURNING id`;
    const deleted = (rows as any[])?.[0]?.id as string | undefined;
    if (!deleted) return json({ ok: false, error: "Brand inexistent." }, 404);

    return json({ ok: true, id: deleted });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare la ștergere." }, status);
  }
}