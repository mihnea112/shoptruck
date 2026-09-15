// src/app/api/admin/orders/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { sendOrderStatusEmail } from "@/lib/email/order-emails";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const client = await pool.connect();
  try {
    const user: any = await requireStaff(req);
    const { id } = await ctx.params;

    await client.query("BEGIN");
    if (user?.userId) {
      await client.query(`select set_config('app.user_id', $1, true)`, [
        String(user.userId),
      ]);
    }

    const { rows } = await client.query(
      `select public.cancel_order($1::uuid) as result`,
      [id],
    );

    await client.query("COMMIT");

    // Send cancellation notification email
    await sendOrderStatusEmail(pool, id, "cancelled");

    return NextResponse.json({ ok: true, result: rows[0]?.result ?? null });
  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return NextResponse.json(
      { ok: false, error: e?.message || "Cancel failed" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
