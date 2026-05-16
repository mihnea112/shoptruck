import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { sendBrevoEmail } from "@/lib/email/sender";
import {
  injectUnsubscribeLink,
  stripHtmlToText,
} from "@/lib/email/campaign-utils";

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

    // Get campaign with full details
    const campaign = await sql`
      SELECT id, name, subject, body_html, status FROM campaign WHERE id = ${campaignId}
    `;

    if (campaign.length === 0) {
      return json({ ok: false, error: "Campanie nu găsită." }, 404);
    }

    const campaignData = campaign[0];

    // Allow sending for draft campaigns (initial send) or sent campaigns (resend)
    const allowedStatuses = ["draft", "sent"];
    if (!allowedStatuses.includes(campaignData.status)) {
      return json({
        ok: false,
        error: "Campanie nu poate fi trimisă. Doar campaniile în draft sau deja trimise pot fi trimise/retrimise.",
      }, 400);
    }

    if (!campaignData.body_html) {
      return json({
        ok: false,
        error: "Campania nu are conținut HTML. Completează campania înainte de trimitere.",
      }, 400);
    }

    // Get all active (non-unsubscribed) contacts with their emails
    const contacts = await sql`
      SELECT id, email FROM email_contact WHERE is_unsubscribed = false
    `;

    if (contacts.length === 0) {
      return json({
        ok: false,
        error: "Nu sunt contacte active pentru trimitere.",
      }, 400);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let sentCount = 0;
    let failedCount = 0;

    // Send emails to each contact
    for (const contact of contacts) {
      try {
        // Inject unsubscribe link for this specific contact
        const htmlWithUnsubscribe = injectUnsubscribeLink(
          campaignData.body_html,
          contact.id,
          appUrl
        );

        const textBody = stripHtmlToText(htmlWithUnsubscribe);

        // Send email via Brevo (marketing campaign)
        await sendBrevoEmail({
          to: contact.email,
          subject: campaignData.subject,
          html: htmlWithUnsubscribe,
          text: textBody,
        });

        // Mark as sent in database
        await sql`
          INSERT INTO campaign_send (campaign_id, contact_id, status, sent_at)
          VALUES (${campaignId}, ${contact.id}, 'sent', NOW())
          ON CONFLICT (campaign_id, contact_id) DO UPDATE
          SET status = 'sent', sent_at = NOW()
        `;

        sentCount++;
        console.log(`[Campaign Send] Email sent to ${contact.email} for campaign ${campaignId}`);
      } catch (error) {
        failedCount++;
        console.error(`[Campaign Send Error] Failed to send to ${contact.email}:`, error);

        // Mark as failed in database
        try {
          await sql`
            INSERT INTO campaign_send (campaign_id, contact_id, status, error_message)
            VALUES (${campaignId}, ${contact.id}, 'failed', ${String(error)})
            ON CONFLICT (campaign_id, contact_id) DO UPDATE
            SET status = 'failed', error_message = ${String(error)}
          `;
        } catch (dbError) {
          console.error("[Campaign Send] Failed to update campaign_send record:", dbError);
        }
      }
    }

    // Update campaign with final status and counts
    const updateResult = await sql`
      UPDATE campaign
      SET status = 'sent',
          sent_count = ${sentCount},
          failed_count = ${failedCount},
          total_count = ${sentCount + failedCount},
          updated_at = NOW()
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
    });
  } catch (e: any) {
    console.error("[API campaigns send POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
