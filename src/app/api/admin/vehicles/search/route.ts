import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/server";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q"); // Poate fi VIN sau Nr. Inmatriculare

  // Dacă nu avem query sau e prea scurt, returnăm null (nu eroare 404)
  if (!q || q.length < 3) {
    return NextResponse.json({ ok: true, vehicle: null });
  }

  try {
    const term = `%${q}%`;

    // Căutăm o potrivire (LIKE) pe VIN sau Nr. Înmatriculare
    const rows = await sql`
      SELECT 
        id, 
        vin, 
        brand, 
        model, 
        plate_number, 
        year
      FROM vehicle
      WHERE vin ILIKE ${term} OR plate_number ILIKE ${term}
      LIMIT 1
    `;

    if (rows.length > 0) {
      return NextResponse.json({ ok: true, vehicle: rows[0] });
    } else {
      return NextResponse.json({ ok: true, vehicle: null });
    }

  } catch (err: any) {
    console.error("Vehicle Search Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}