import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email/smtp";
import { injectUnsubscribeLink } from "@/lib/email/campaign-utils";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

const BATCH_SIZE = 50;
const RETRY_COOLDOWN_MINUTES = 5;

export async function POST(req: Request) {
  try {
    // Optional: Validate secret token for external callers
    // const token = req.headers.get("authorization");
    // if (token !== `Bearer ${process.env.EMAIL_PROCESS_SECRET}`) {
    //   return json({ ok: false, error: "Unauthorized." }, 401);
    // }

    // Get pending campaign_send rows that haven't been retried too recently
    const pending = await sql`
      SELECT
        cs.id,
        cs.campaign_id,
        cs.contact_id,
        c.body_html,
        c.body_text,
        c.subject,
        ec.email
      FROM campaign_send cs
      JOIN campaign c ON c.id = cs.campaign_id
      JOIN email_contact ec ON ec.id = cs.contact_id
      WHERE cs.status = 'pending'
        AND (cs.error_text IS NULL OR cs.updated_at < NOW() - INTERVAL '${RETRY_COOLDOWN_MINUTES} minutes')
      ORDER BY cs.created_at ASC
      LIMIT ${BATCH_SIZE}
    `;

    if (pending.length === 0) {
      return json({ ok: true, processed: 0, sent: 0, failed: 0 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let sentCount = 0;
    let failedCount = 0;
    const results: any[] = [];

    for (const item of pending) {
      try {
        // Inject unsubscribe link into HTML
        const htmlWithLink = injectUnsubscribeLink(item.body_html, item.contact_id, appUrl);

        // Send email via SMTP
        const result = await sendEmail({
          to: item.email,
          subject: item.subject,
          html: htmlWithLink,
          text: item.body_text,
        });

        if (result.success) {
          // Mark as sent
          await sql`
            UPDATE campaign_send
            SET status = 'sent', sent_at = NOW(), updated_at = NOW()
            WHERE id = ${item.id}
          `;

          // Increment campaign sent_count
          await sql`
            UPDATE campaign
            SET sent_count = sent_count + 1, updated_at = NOW()
            WHERE id = ${item.campaign_id}
          `;

          sentCount++;
        } else {
          // Mark as failed with error
          await sql`
            UPDATE campaign_send
            SET status = 'failed', error_text = ${result.error || ''}, updated_at = NOW()
            WHERE id = ${item.id}
          `;

          // Increment campaign failed_count
          await sql`
            UPDATE campaign
            SET failed_count = failed_count + 1, updated_at = NOW()
            WHERE id = ${item.campaign_id}
          `;

          failedCount++;
        }

        results.push({
          id: item.id,
          email: item.email,
          success: result.success,
          error: result.error,
        });
      } catch (error: any) {
        console.error("[Process Batch Error]", item.id, error);

        // Mark as failed
        await sql`
          UPDATE campaign_send
          SET status = 'failed', error_text = ${error?.message || "Unknown error"}, updated_at = NOW()
          WHERE id = ${item.id}
        `;

        // Increment campaign failed_count
        await sql`
          UPDATE campaign
          SET failed_count = failed_count + 1, updated_at = NOW()
          WHERE id = ${item.campaign_id}
        `;

        failedCount++;
        results.push({
          id: item.id,
          email: item.email,
          success: false,
          error: error?.message || "Unknown error",
        });
      }
    }

    // Check if all campaign_send rows are processed (sent or failed)
    // If so, mark campaign as 'sent'
    for (const item of pending) {
      const remainingPending = await sql`
        SELECT COUNT(*) as count FROM campaign_send
        WHERE campaign_id = ${item.campaign_id} AND status = 'pending'
      `;

      if (remainingPending.length > 0 && Number(remainingPending[0].count) === 0) {
        // All rows are processed
        await sql`
          UPDATE campaign
          SET status = 'sent', updated_at = NOW()
          WHERE id = ${item.campaign_id}
        `;
      }
    }

    return json({
      ok: true,
      processed: pending.length,
      sent: sentCount,
      failed: failedCount,
    });
  } catch (e: any) {
    console.error("[API process-batch POST]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}
