import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

// Delete an unused code
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireStaff(req, ["admin"]);
  const { id } = await ctx.params;
  try {
    const del = (await sql`
      DELETE FROM discount_code WHERE id = ${id}::uuid AND used_at IS NULL RETURNING id
    `) as any[];
    if (!del.length)
      return NextResponse.json({ ok: false, error: "Codul nu există sau a fost deja folosit." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Eroare internă." }, { status: 500 });
  }
}
