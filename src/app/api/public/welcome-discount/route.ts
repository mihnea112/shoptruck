import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email/sender";
import { welcomeDiscountTemplate } from "@/lib/email/templates";
import { generateCode, WELCOME_PCT, WELCOME_VALID_DAYS } from "@/lib/welcome-discount";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST /api/public/welcome-discount { email, consent }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return json({ ok: false, error: "Adresa de email nu este validă." }, 400);
    }

    const existing = (await sql`
      SELECT id FROM discount_code
      WHERE lower(email) = ${email} AND source = 'welcome_game'
      LIMIT 1
    `) as any[];
    if (existing.length) {
      return json({ ok: false, error: "Un cod a fost deja emis pentru această adresă de email." }, 409);
    }

    const code = generateCode();
    await sql`
      INSERT INTO discount_code (code, email, pct, source, expires_at)
      VALUES (${code}, ${email}, ${WELCOME_PCT}, 'welcome_game',
              now() + (${WELCOME_VALID_DAYS} || ' days')::interval)
    `;

    // Add to marketing contacts only if the visitor ticked the opt-in box.
    if (body?.marketing_consent === true) {
      await sql`
        INSERT INTO email_contact (email, tags, is_unsubscribed)
        VALUES (${email}, ARRAY['welcome-game']::text[], false)
        ON CONFLICT (email) DO UPDATE
        SET tags = ARRAY(SELECT DISTINCT unnest(email_contact.tags || EXCLUDED.tags)),
            updated_at = NOW()
      `.catch((e: any) => console.error("[welcome-discount] contact upsert failed", e));
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://shoptruck.ro").replace(/\/$/, "");
    const tpl = welcomeDiscountTemplate({
      code,
      pct: WELCOME_PCT,
      validDays: WELCOME_VALID_DAYS,
      shopUrl: `${appUrl}/catalog`,
    });
    let emailed = true;
    try {
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {
      emailed = false;
    }

    return json({ ok: true, code, pct: WELCOME_PCT, emailed });
  } catch (e: any) {
    console.error("[API welcome-discount POST]", e);
    return json({ ok: false, error: "Eroare internă. Încearcă din nou." }, 500);
  }
}
