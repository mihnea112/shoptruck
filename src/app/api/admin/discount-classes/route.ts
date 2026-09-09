import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  try {
    await requireStaff(req);
    const rows = await sql`
      SELECT id, name, description, discount_pct, applies_to, is_active, created_at, updated_at
      FROM discount_class
      ORDER BY name
    `;
    return json({ ok: true, items: rows });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff(req);
    const body = await req.json().catch(() => null);
    if (!body) return json({ ok: false, error: "Body invalid." }, 400);

    const name = String(body.name ?? "").trim();
    if (!name) return json({ ok: false, error: "Numele clasei este obligatoriu." }, 400);

    const discountPct = Number(body.discount_pct ?? 0);
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      return json({ ok: false, error: "Procentul de discount trebuie să fie între 0 și 100." }, 400);
    }

    const appliesTo = ["CLIENT", "SUPPLIER", "BOTH"].includes(body.applies_to) ? body.applies_to : "BOTH";

    const rows = await sql`
      INSERT INTO discount_class (name, description, discount_pct, applies_to)
      VALUES (${name}, ${body.description || null}, ${discountPct}, ${appliesTo})
      RETURNING id
    `;
    return json({ ok: true, id: (rows as any[])[0]?.id }, 201);
  } catch (e: any) {
    if (e?.code === "23505") return json({ ok: false, error: "O clasă cu acest nume există deja." }, 409);
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function PUT(req: Request) {
  try {
    await requireStaff(req);
    const body = await req.json().catch(() => null);
    if (!body?.id) return json({ ok: false, error: "ID lipsă." }, 400);

    const name = String(body.name ?? "").trim();
    if (!name) return json({ ok: false, error: "Numele clasei este obligatoriu." }, 400);

    const discountPct = Number(body.discount_pct ?? 0);
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      return json({ ok: false, error: "Procentul de discount trebuie să fie între 0 și 100." }, 400);
    }

    const appliesTo = ["CLIENT", "SUPPLIER", "BOTH"].includes(body.applies_to) ? body.applies_to : "BOTH";

    await sql`
      UPDATE discount_class
      SET name = ${name},
          description = ${body.description || null},
          discount_pct = ${discountPct},
          applies_to = ${appliesTo},
          is_active = ${body.is_active !== false},
          updated_at = now()
      WHERE id = ${body.id}::uuid
    `;
    return json({ ok: true });
  } catch (e: any) {
    if (e?.code === "23505") return json({ ok: false, error: "O clasă cu acest nume există deja." }, 409);
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireStaff(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return json({ ok: false, error: "ID lipsă." }, 400);

    await sql`DELETE FROM discount_class WHERE id = ${id}::uuid`;
    return json({ ok: true });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}
