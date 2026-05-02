import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(
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

    // Get campaign
    const campaign = await sql`
      SELECT id, status FROM campaign WHERE id = ${campaignId}
    `;

    if (campaign.length === 0) {
      return json({ ok: false, error: "Campanie nu găsită." }, 404);
    }

    if (campaign[0].status !== "draft") {
      return json({
        ok: false,
        error: "Campanie nu este în draft. Poate fi deja în trimitere sau trimisă.",
      }, 400);
    }

    // Get all active (non-unsubscribed) contacts
    const contacts = await sql`
      SELECT id FROM email_contact WHERE is_unsubscribed = false
    `;

    if (contacts.length === 0) {
      return json({
        ok: false,
        error: "Nu sunt contacte active pentru trimitere.",
      }, 400);
    }

    // Create campaign_send rows for each contact
    let createdCount = 0;

    for (const contact of contacts) {
      try {
        await sql`
          INSERT INTO campaign_send (campaign_id, contact_id, status)
          VALUES (${campaignId}, ${contact.id}, 'pending')
          ON CONFLICT (campaign_id, contact_id) DO NOTHING
        `;
        createdCount++;
      } catch (error) {
        console.error("[Send Campaign Error]", error);
        // Continue with next contact if insert fails
        continue;
      }
    }

    // Update campaign: status = sending, total_count = count
    const updateResult = await sql`
      UPDATE campaign
      SET status = 'sending', total_count = ${createdCount}, updated_at = NOW()
      WHERE id = ${campaignId}
      RETURNING id, name, subject, status, sent_count, failed_count, total_count
    `;

    if (updateResult.length === 0) {
      return json({ ok: false, error: "Eroare la actualizarea campaniei." }, 500);
    }

    const updatedCampaign = updateResult[0];
    return json({
      ok: true,
      campaign: {
        id: updatedCampaign.id,
        name: updatedCampaign.name,
        subject: updatedCampaign.subject,
        status: updatedCampaign.status,
        sent_count: updatedCampaign.sent_count || 0,
        failed_count: updatedCampaign.failed_count || 0,
        total_count: updatedCampaign.total_count || 0,
      },
      created_campaign_sends: createdCount,
    });
  } catch (e: any) {
    console.error("[API campaigns send POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
