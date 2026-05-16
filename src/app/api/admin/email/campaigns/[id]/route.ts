import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff(req, ["admin"]);

    const { id } = await params;
    const campaignId = id;
    if (!isValidUUID(campaignId)) {
      return json({ ok: false, error: "ID invalid." }, 400);
    }

    const result = await sql`
      SELECT id, name, subject, body_html, body_text, status, scheduled_at, sent_count, failed_count, total_count, created_by, created_at, updated_at
      FROM campaign
      WHERE id = ${campaignId}
    `;

    if (result.length === 0) {
      return json({ ok: false, error: "Campanie nu găsită." }, 404);
    }

    const campaign = result[0];
    return json({
      ok: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        body_html: campaign.body_html,
        body_text: campaign.body_text,
        status: campaign.status,
        scheduled_at: campaign.scheduled_at,
        sent_count: campaign.sent_count || 0,
        failed_count: campaign.failed_count || 0,
        total_count: campaign.total_count || 0,
        created_by: campaign.created_by,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
      },
    });
  } catch (e: any) {
    console.error("[API campaigns GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff(req, ["admin"]);

    const { id } = await params;
    const campaignId = id;
    if (!isValidUUID(campaignId)) {
      return json({ ok: false, error: "ID invalid." }, 400);
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { name, subject, body_html, body_text, scheduled_at } = body;

    // Check campaign exists and is draft
    const campaign = await sql`SELECT status FROM campaign WHERE id = ${campaignId}`;
    if (campaign.length === 0) {
      return json({ ok: false, error: "Campanie nu găsită." }, 404);
    }

    // Only allow editing if draft
    if (campaign[0].status !== "draft") {
      return json({
        ok: false,
        error: "Nu poți edita campanii care sunt în trimitere sau deja trimise.",
      }, 400);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      const nameStr = (String(name || "")).trim();
      if (!nameStr) {
        return json({ ok: false, error: "Nume nu poate fi gol." }, 400);
      }
      updates.push(`name = $${updates.length + 1}`);
      values.push(nameStr);
    }

    if (subject !== undefined) {
      const subjectStr = (String(subject || "")).trim();
      if (!subjectStr) {
        return json({ ok: false, error: "Subiect nu poate fi gol." }, 400);
      }
      updates.push(`subject = $${updates.length + 1}`);
      values.push(subjectStr);
    }

    if (body_html !== undefined) {
      const htmlStr = (String(body_html || "")).trim();
      if (!htmlStr) {
        return json({ ok: false, error: "Corp HTML nu poate fi gol." }, 400);
      }
      updates.push(`body_html = $${updates.length + 1}`);
      values.push(htmlStr);
    }

    if (body_text !== undefined) {
      const textStr = (String(body_text || "")).trim();
      updates.push(`body_text = $${updates.length + 1}`);
      values.push(textStr);
    }

    if (scheduled_at !== undefined && scheduled_at !== null) {
      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        return json({ ok: false, error: "Dată programării invalidă." }, 400);
      }
      updates.push(`scheduled_at = $${updates.length + 1}`);
      values.push(scheduledDate.toISOString());
    }

    if (updates.length === 0) {
      return json({ ok: false, error: "Nici un câmp de actualizat." }, 400);
    }

    updates.push(`updated_at = NOW()`);

    // Update campaign
    const result = await sql`
      UPDATE campaign
      SET ${sql(updates.join(", "))}
      WHERE id = ${campaignId}
      RETURNING id, name, subject, body_html, body_text, status, scheduled_at, sent_count, failed_count, total_count, created_by, created_at, updated_at
    `;

    if (result.length === 0) {
      return json({ ok: false, error: "Campanie nu găsită." }, 404);
    }

    const updatedCampaign = result[0];
    return json({
      ok: true,
      campaign: {
        id: updatedCampaign.id,
        name: updatedCampaign.name,
        subject: updatedCampaign.subject,
        body_html: updatedCampaign.body_html,
        body_text: updatedCampaign.body_text,
        status: updatedCampaign.status,
        scheduled_at: updatedCampaign.scheduled_at,
        sent_count: updatedCampaign.sent_count || 0,
        failed_count: updatedCampaign.failed_count || 0,
        total_count: updatedCampaign.total_count || 0,
        created_by: updatedCampaign.created_by,
        created_at: updatedCampaign.created_at,
        updated_at: updatedCampaign.updated_at,
      },
    });
  } catch (e: any) {
    console.error("[API campaigns PATCH]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff(req, ["admin"]);

    const { id } = await params;
    const campaignId = id;
    if (!isValidUUID(campaignId)) {
      return json({ ok: false, error: "ID invalid." }, 400);
    }

    // Check campaign exists and get full details
    const campaign = await sql`SELECT status, failed_count FROM campaign WHERE id = ${campaignId}`;
    if (campaign.length === 0) {
      return json({ ok: false, error: "Campanie nu găsită." }, 404);
    }

    // Allow deletion only for:
    // 1. Draft campaigns (status = "draft"), OR
    // 2. Sent campaigns with zero failures (status = "sent" AND failed_count = 0)
    const status = campaign[0].status;
    const failedCount = campaign[0].failed_count || 0;

    const canDelete = status === "draft" || (status === "sent" && failedCount === 0);

    if (!canDelete) {
      return json({
        ok: false,
        error: "Nu poți șterge campanii care sunt în trimitere sau cu trimiteri eșuate. Doar campaniile complet trimise fără erori pot fi șterse.",
      }, 400);
    }

    // Delete campaign (cascade will delete campaign_send rows)
    await sql`DELETE FROM campaign WHERE id = ${campaignId}`;

    return json({ ok: true, id: campaignId });
  } catch (e: any) {
    console.error("[API campaigns DELETE]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
