import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";
import { encryptPII } from "@/lib/crypto/pii";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

// Ensures a partner has a linked `account` row (needed for offers) and returns its id.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(req);
    const { id } = await ctx.params;

    const body = await req.json().catch(() => null);
    const newEmail = String(body?.email ?? "").trim();
    if (newEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return json({ ok: false, error: "Adresa de email nu este validă." }, 400);
      }
      await sql`UPDATE partner SET email = ${newEmail} WHERE id = ${id}::uuid`;
    }

    const rows = (await sql`SELECT * FROM partner WHERE id = ${id}::uuid LIMIT 1`) as any[];
    const p = rows[0];
    if (!p) return json({ ok: false, error: "Partener inexistent." }, 404);
    if (p.account_id) return json({ ok: true, accountId: p.account_id });

    if (!p.email) {
      return json({ ok: false, needsEmail: true, error: "Partenerul nu are email." }, 400);
    }

    const kind = String(p.kind || "").toUpperCase() === "INDIVIDUAL" ? "INDIVIDUAL" : "COMPANY";
    const line1 = [p.street_type, p.street_name, p.street_number].filter(Boolean).join(" ") || null;

    let accountId: string | undefined;
    try {
      const ins = (await sql`
        INSERT INTO account (
          kind, display_name, legal_name, email, phone, tax_id, reg_no, is_vat_payer,
          billing_line1, billing_city, billing_zip, billing_country, updated_at
        ) VALUES (
          ${kind}, ${p.display_name}, ${p.legal_name || p.display_name}, ${p.email},
          ${p.phone ? encryptPII(p.phone) : null}, ${p.tax_id ? encryptPII(p.tax_id) : null},
          ${p.reg_no ? encryptPII(p.reg_no) : null}, ${p.is_vat_payer === true},
          ${line1 ? encryptPII(line1) : null}, ${p.city}, ${p.postal_code}, ${p.country || "Romania"}, now()
        ) RETURNING id
      `) as any[];
      accountId = ins[0]?.id;
    } catch (e: any) {
      if (e?.code === "23505") {
        return json({ ok: false, error: "Există deja un cont cu același CUI/email." }, 409);
      }
      throw e;
    }
    if (!accountId) return json({ ok: false, error: "Eroare internă." }, 500);

    await sql`UPDATE partner SET account_id = ${accountId}::uuid WHERE id = ${id}::uuid`;
    return json({ ok: true, accountId });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}
