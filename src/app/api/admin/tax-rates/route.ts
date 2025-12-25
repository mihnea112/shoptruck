import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(req: Request) {
  await requireAdmin(req);

  const rows = await sql`
    SELECT id, name, rate
    FROM tax_rate
    ORDER BY rate DESC, name ASC
  `;

  return json({ ok: true, items: rows });
}