import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

export async function GET(req: NextRequest) {
  try {
    await requireStaff(req);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 3) {
      return NextResponse.json({ ok: true, vehicle: null }, { headers: { "cache-control": "no-store" } });
    }

    const term = `%${q}%`;
    const rows = await sql`
      SELECT id, vin, brand, model, plate_number, year
      FROM vehicle
      WHERE vin ILIKE ${term} OR plate_number ILIKE ${term}
      LIMIT 1
    `;

    return NextResponse.json(
      { ok: true, vehicle: rows.length > 0 ? rows[0] : null },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e?.message || "Eroare internă." }, { status });
  }
}