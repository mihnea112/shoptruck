import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";
import { sendEmail } from "@/lib/email/sender";
import { offerTemplate } from "@/lib/email/templates";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function errPayload(err: any) {
  const status = Number(err?.status ?? err?.statusCode ?? 500);
  const code = err?.code;
  const detail = err?.detail;
  const hint = err?.hint;
  const message = String(err?.message || "Eroare internă.");
  const isDev = process.env.NODE_ENV !== "production";
  return {
    status: status >= 400 && status <= 599 ? status : 500,
    body: {
      ok: false,
      error: message,
      ...(isDev ? { debug: { code, detail, hint, stack: err?.stack } } : {}),
    },
  };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff(req, ["admin", "sales", "sales_rep"]);
    const { id: offerId } = await ctx.params;

    // Fetch offer with all details
    const offers = (await sql`
      SELECT
        o.id,
        o.status,
        o.created_at,
        o.valid_until,
        o.total_net,
        o.total_tax,
        o.total_gross,
        o.notes,

        a.id AS account_id,
        a.display_name AS account_name,
        a.email AS account_email,

        v.id AS vehicle_id,
        v.plate_no,
        v.make,
        v.model,
        v.year
      FROM offer o
      JOIN account a ON a.id = o.account_id
      LEFT JOIN vehicle v ON v.id = o.vehicle_id
      WHERE o.id = ${offerId}::uuid
      LIMIT 1
    `) as any[];

    if (!offers || offers.length === 0) {
      return json({ ok: false, error: "Ofertă inexistentă." }, 404);
    }

    const offer = offers[0];

    if (!offer.account_email) {
      return json(
        { ok: false, error: "Clientul nu are adresă de email." },
        400
      );
    }

    // Fetch offer items
    const items = (await sql`
      SELECT
        name,
        quantity,
        unit_price_net,
        tax_rate,
        line_net,
        line_tax,
        line_gross
      FROM offer_item
      WHERE offer_id = ${offerId}::uuid
      ORDER BY created_at ASC
    `) as any[];

    // Build vehicle info string
    const vehicleInfo = offer.vehicle_id
      ? `${offer.plate_no || ""} (${offer.make || ""} ${offer.model || ""} ${offer.year || ""})`
        .trim()
      : undefined;

    // Create email template
    const emailData = {
      customerName: offer.account_name,
      offerId: offer.id,
      createdDate: new Date(offer.created_at).toLocaleDateString("ro-RO"),
      validUntil: offer.valid_until
        ? new Date(offer.valid_until).toLocaleDateString("ro-RO")
        : undefined,
      items: items.map((i: any) => ({
        name: i.name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price_net),
        taxRate: Number(i.tax_rate),
      })),
      totalNet: Number(offer.total_net),
      totalTax: Number(offer.total_tax),
      totalGross: Number(offer.total_gross),
      notes: offer.notes,
      vehicleInfo,
    };

    const emailTemplate = offerTemplate(emailData);

    // Send email
    await sendEmail({
      to: offer.account_email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    return json({
      ok: true,
      message: "Oferta a fost trimisă cu succes.",
    });
  } catch (err: any) {
    console.error("/api/admin/offers/[id]/send POST failed", err);
    const p = errPayload(err);
    return json(p.body, p.status);
  }
}
