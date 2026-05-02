import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaign_id");
    const status = searchParams.get("status");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    if (!campaignId) {
      return json({ ok: false, error: "campaign_id necesar." }, 400);
    }

    const rows = await sql`
      SELECT cs.id, cs.status, cs.error_text, cs.sent_at, cs.created_at, ec.email
      FROM campaign_send cs
      JOIN email_contact ec ON ec.id = cs.contact_id
      WHERE cs.campaign_id = ${campaignId}
      ${status ? sql`AND cs.status = ${status}` : sql``}
      ORDER BY cs.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total FROM campaign_send
      WHERE campaign_id = ${campaignId}
      ${status ? sql`AND status = ${status}` : sql``}
    `;

    const total = countResult.length > 0 ? Number(countResult[0].total) : 0;

    const items = rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      status: row.status,
      error_text: row.error_text,
      sent_at: row.sent_at,
      created_at: row.created_at,
    }));

    return json({ ok: true, items, total, limit, offset });
  } catch (e: any) {
    console.error("[API campaign-sends GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
