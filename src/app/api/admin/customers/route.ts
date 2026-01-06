import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

export async function GET(req: Request) {
  try {
    await requireStaff(req);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (q.length < 2) {
      return NextResponse.json({ ok: true, items: [] }, { headers: { "cache-control": "no-store" } });
    }

    const term = `%${q}%`;
    const rows = await sql`
      SELECT id, name, email
      FROM customer
      WHERE name ILIKE ${term} OR email ILIKE ${term}
      ORDER BY name
      LIMIT 20
    `;

    return NextResponse.json({ ok: true, items: rows }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e?.message || "Eroare internă." }, { status });
  }
}