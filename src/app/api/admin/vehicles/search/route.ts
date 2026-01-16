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
      SELECT
        id,
        chassis_vin,
        plate_no,
        make,
        model,
        series,
        engine_code,
        year
      FROM vehicle
      WHERE chassis_vin ILIKE ${term} OR plate_no ILIKE ${term}
      LIMIT 1
    `;

    const v = rows.length > 0 ? (rows as any)[0] : null;

    // Return both new keys and legacy keys so older UI/components won't break.
    const vehicle = v
      ? {
          id: v.id,

          // New schema keys
          chassis_vin: v.chassis_vin,
          plate_no: v.plate_no,
          make: v.make,
          model: v.model,
          series: v.series,
          engine_code: v.engine_code,
          year: v.year,

          // Legacy aliases (temporary)
          vin: v.chassis_vin,
          plate_number: v.plate_no,
          brand: v.make,
        }
      : null;

    return NextResponse.json(
      { ok: true, vehicle },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e?.message || "Eroare internă." }, { status });
  }
}