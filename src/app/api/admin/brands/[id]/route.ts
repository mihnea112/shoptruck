import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

type Ctx = { params: { id: string } | Promise<{ id: string }> };
async function getId(ctx: Ctx) {
  const p = await Promise.resolve(ctx.params);
  return String((p as any).id);
}

export async function GET(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  const rows =
    await sql`SELECT id, name FROM brand WHERE id = ${id}::uuid LIMIT 1`;
  const item = (rows as any[])?.[0];
  if (!item) return json({ ok: false, error: "Brand inexistent." }, 404);

  const cnt = await sql`
    SELECT COUNT(*)::int AS product_count
    FROM product
    WHERE brand_id = ${id}::uuid
  `;
  const productCount = (cnt as any[])?.[0]?.product_count ?? 0;

  return json({ ok: true, item, productCount });
}

export async function PATCH(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      415
    );
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();

  if (!name || name.length < 2) {
    return json({ ok: false, error: "Numele este obligatoriu." }, 400);
  }

  try {
    const rows = await sql`
      UPDATE brand
      SET name = ${name}
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    const okId = (rows as any[])?.[0]?.id as string | undefined;
    if (!okId) return json({ ok: false, error: "Brand inexistent." }, 404);

    return json({ ok: true, id: okId });
  } catch (e: any) {
    const msg = e?.code === "23505" ? "Brand deja există." : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  await requireAdmin(req);
  const id = await getId(ctx);

  // protect: prevent deletion if used by products
  const used =
    await sql`SELECT 1 FROM product WHERE brand_id = ${id}::uuid LIMIT 1`;
  if (Array.isArray(used) && used.length > 0) {
    return json(
      {
        ok: false,
        error:
          "Brand-ul are produse asociate. Elimină brand-ul din produse înainte de ștergere.",
      },
      409
    );
  }

  try {
    const rows =
      await sql`DELETE FROM brand WHERE id = ${id}::uuid RETURNING id`;
    const deleted = (rows as any[])?.[0]?.id as string | undefined;
    if (!deleted) return json({ ok: false, error: "Brand inexistent." }, 404);

    return json({ ok: true, id: deleted });
  } catch {
    return json({ ok: false, error: "Eroare la ștergere." }, 500);
  }
}
