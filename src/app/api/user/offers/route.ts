import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireCustomer } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    const user = await requireCustomer(req);

    // Find all account IDs linked to this user
    const accounts = await sql`
      SELECT id FROM account WHERE user_id = ${user.userId}::uuid
    ` as any[];

    if (accounts.length === 0) {
      return json({ ok: true, items: [] });
    }

    const accountIds = accounts.map((a: any) => a.id);

    const rows = await sql`
      SELECT
        o.id,
        o.status,
        o.created_at,
        o.valid_until,
        o.total_net,
        o.total_tax,
        o.total_gross,
        a.display_name AS account_name,
        v.plate_no,
        v.make AS vehicle_make,
        v.model AS vehicle_model
      FROM offer o
      JOIN account a ON a.id = o.account_id
      LEFT JOIN vehicle v ON v.id = o.vehicle_id
      WHERE o.account_id = ANY(${accountIds}::uuid[])
      ORDER BY o.created_at DESC
      LIMIT 50
    ` as any[];

    const items = rows.map((o: any) => ({
      id: o.id,
      status: o.status,
      createdAt: o.created_at,
      validUntil: o.valid_until,
      totalNet: Number(o.total_net || 0),
      totalTax: Number(o.total_tax || 0),
      totalGross: Number(o.total_gross || 0),
      accountName: o.account_name,
      vehicle: o.plate_no
        ? `${o.vehicle_make || ""} ${o.vehicle_model || ""} · ${o.plate_no}`.trim()
        : null,
    }));

    return json({ ok: true, items });
  } catch (e: any) {
    console.error("[API user offers GET]", e);
    return json({ error: e?.message || "Eroare la citire" }, e?.status ?? 500);
  }
}
