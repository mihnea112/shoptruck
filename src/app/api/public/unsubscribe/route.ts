import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

function html(content: string, status = 200) {
  return new NextResponse(content, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return json({ ok: false, error: "Token necesar." }, 400);
    }

    // Decode base64 token to get contact ID
    let contactId: string;
    try {
      contactId = Buffer.from(token, "base64").toString("utf-8");
    } catch (error) {
      return json({ ok: false, error: "Token invalid." }, 400);
    }

    // Validate UUID format
    if (!isValidUUID(contactId)) {
      return json({ ok: false, error: "ID invalid." }, 400);
    }

    // Check if contact exists
    const contact = await sql`
      SELECT id, email FROM email_contact WHERE id = ${contactId}
    `;

    if (contact.length === 0) {
      return html(
        `<html>
<head><meta charset="utf-8"><title>Dezabonare</title></head>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 40px;">
<h2>Contactul nu a fost găsit</h2>
<p>Linkul de dezabonare poate fi expirat sau invalid.</p>
</body>
</html>`,
        404
      );
    }

    // Mark as unsubscribed
    await sql`
      UPDATE email_contact
      SET is_unsubscribed = true, unsubscribed_at = NOW(), updated_at = NOW()
      WHERE id = ${contactId}
    `;

    // Return success HTML
    return html(
      `<html>
<head><meta charset="utf-8"><title>Dezabonare</title></head>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #f5f5f5;">
<div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
<h2 style="color: #2d3748; margin-bottom: 20px;">Ați fost dezabonat(ă) cu succes</h2>
<p style="color: #718096; line-height: 1.6; margin-bottom: 20px;">
E-mailul <strong>${escapeHtml(contact[0].email)}</strong> a fost eliminat din lista noastră de abonați.
</p>
<p style="color: #a0aec0; font-size: 12px;">
Nu veți mai primi emailuri marketing de la noi.
</p>
</div>
</body>
</html>`,
      200
    );
  } catch (e: any) {
    console.error("[API public unsubscribe GET]", e);
    return html(
      `<html>
<head><meta charset="utf-8"><title>Eroare</title></head>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 40px;">
<h2>Eroare la dezabonare</h2>
<p>A apărut o problemă. Vă rugăm să încercați din nou mai târziu.</p>
</body>
</html>`,
      500
    );
  }
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
