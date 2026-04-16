// src/app/api/admin/warehouses/[id]/users/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

type Ctx = { params: Promise<{ id: string }> };

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

// POST — assign a user to this warehouse
// Body: { user_id: uuid, role: "MANAGER" | "OPERATOR" }
export async function POST(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req, ["admin"]);
    const { id: warehouse_id } = await ctx.params;

    const body    = await req.json().catch(() => null);
    const user_id = String(body?.user_id ?? "").trim();
    const role    = String(body?.role ?? "OPERATOR").trim().toUpperCase();

    if (!user_id) return json({ ok: false, error: "user_id lipsă." }, 400);
    if (!["MANAGER", "OPERATOR"].includes(role))
      return json({ ok: false, error: "Rol invalid. Folosește MANAGER sau OPERATOR." }, 400);

    // Verify user exists in profile
    const pr = await sql`SELECT user_id FROM profile WHERE user_id = ${user_id}::uuid LIMIT 1`;
    if (!(pr as any[]).length) return json({ ok: false, error: "Utilizatorul nu există." }, 404);

    await sql`
      INSERT INTO warehouse_user (warehouse_id, user_id, role)
      VALUES (${warehouse_id}::uuid, ${user_id}::uuid, ${role})
      ON CONFLICT (warehouse_id, user_id)
      DO UPDATE SET role = ${role}
    `;

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, 500);
  }
}

// DELETE — remove a user from this warehouse
// Query param: ?user_id=uuid
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req, ["admin"]);
    const { id: warehouse_id } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const user_id = (searchParams.get("user_id") || "").trim();

    if (!user_id) return json({ ok: false, error: "user_id lipsă." }, 400);

    await sql`
      DELETE FROM warehouse_user
      WHERE warehouse_id = ${warehouse_id}::uuid
        AND user_id      = ${user_id}::uuid
    `;

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Eroare." }, 500);
  }
}