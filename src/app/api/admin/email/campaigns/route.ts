import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  sent_count: number;
  failed_count: number;
  total_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function GET(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const status = (searchParams.get("status") || "").trim();

    let rows;
    if (status) {
      rows = await sql`
        SELECT id, name, subject, status, sent_count, failed_count, total_count, created_by, created_at, updated_at
        FROM campaign
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = await sql`
        SELECT id, name, subject, status, sent_count, failed_count, total_count, created_by, created_at, updated_at
        FROM campaign
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM campaign
      ${status ? sql`WHERE status = ${status}` : sql``}
    `;

    const total = countResult.length > 0 ? Number(countResult[0].total) : 0;

    const campaigns: Campaign[] = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      subject: row.subject,
      status: row.status,
      sent_count: row.sent_count || 0,
      failed_count: row.failed_count || 0,
      total_count: row.total_count || 0,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return json({ ok: true, items: campaigns, total, limit, offset });
  } catch (e: any) {
    console.error("[API campaigns GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireStaff(req, ["admin"]);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { name, subject, body_html, body_text } = body;

    // Validate required fields
    const nameStr = (name || "").trim();
    const subjectStr = (subject || "").trim();
    const htmlStr = (body_html || "").trim();
    const textStr = (body_text || "").trim();

    if (!nameStr || !subjectStr || !htmlStr || !textStr) {
      return json({
        ok: false,
        error: "Nume, subiect, corp HTML și text sunt obligatorii.",
      }, 400);
    }

    // Insert campaign (status = draft by default)
    const result = await sql`
      INSERT INTO campaign (name, subject, body_html, body_text, created_by)
      VALUES (${nameStr}, ${subjectStr}, ${htmlStr}, ${textStr}, ${user.userId}::uuid)
      RETURNING id, name, subject, status, sent_count, failed_count, total_count, created_by, created_at, updated_at
    `;

    if (result.length === 0) {
      return json({ ok: false, error: "Eroare la crearea campaniei." }, 500);
    }

    const campaign = result[0];
    return json({
      ok: true,
      id: campaign.id,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        sent_count: campaign.sent_count || 0,
        failed_count: campaign.failed_count || 0,
        total_count: campaign.total_count || 0,
        created_by: campaign.created_by,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
      },
    });
  } catch (e: any) {
    console.error("[API campaigns POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
