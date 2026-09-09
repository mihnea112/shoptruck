import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ApiError, requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

function clean(v: unknown, max = 200): string | null {
  const s = String(v ?? "").trim();
  return s ? (s.length > max ? s.slice(0, max) : s) : null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req);
    const { id } = await ctx.params;

    const rows = await sql`
      SELECT p.*, dc.name as discount_class_name, dc.discount_pct
      FROM partner p
      LEFT JOIN discount_class dc ON dc.id = p.discount_class_id
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `;
    if (!(rows as any[]).length) return json({ ok: false, error: "Partener inexistent." }, 404);

    const banks = await sql`
      SELECT * FROM partner_bank WHERE partner_id = ${id}::uuid ORDER BY is_default DESC, bank_name
    `;
    const contacts = await sql`
      SELECT * FROM partner_contact WHERE partner_id = ${id}::uuid ORDER BY is_primary DESC, last_name
    `;
    const addresses = await sql`
      SELECT * FROM partner_address WHERE partner_id = ${id}::uuid ORDER BY is_default DESC, label
    `;

    return json({
      ok: true,
      item: { ...(rows as any[])[0], banks, contacts, addresses },
    });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req);
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return json({ ok: false, error: "Body invalid." }, 400);

    const displayName = clean(body.display_name, 300);
    if (!displayName) return json({ ok: false, error: "Numele partenerului este obligatoriu." }, 400);

    const partnerType = ["CLIENT", "SUPPLIER", "BOTH"].includes(body.partner_type)
      ? body.partner_type : "CLIENT";
    const kind = ["COMPANY", "INDIVIDUAL", "PFA"].includes(body.kind) ? body.kind : "COMPANY";

    await sql`
      UPDATE partner SET
        partner_type = ${partnerType}, kind = ${kind}, code = ${clean(body.code, 20)},
        display_name = ${displayName}, legal_name = ${clean(body.legal_name, 300)},
        tax_id = ${clean(body.tax_id, 60)}, reg_no = ${clean(body.reg_no, 80)},
        is_vat_payer = ${body.is_vat_payer === true}, vat_since = ${body.vat_since || null},
        vat_on_receipt = ${body.vat_on_receipt === true}, split_vat = ${body.split_vat === true},
        agri_reg = ${clean(body.agri_reg, 100)}, agent_name = ${clean(body.agent_name, 200)},
        country = ${clean(body.country, 100) || 'Romania'}, county = ${clean(body.county, 100)},
        city = ${clean(body.city, 100)}, zone = ${clean(body.zone, 200)},
        postal_code = ${clean(body.postal_code, 20)},
        street_type = ${clean(body.street_type, 50) || 'Strada'}, street_name = ${clean(body.street_name, 200)},
        street_number = ${clean(body.street_number, 20)}, block = ${clean(body.block, 20)},
        staircase = ${clean(body.staircase, 20)}, floor = ${clean(body.floor, 20)},
        apartment = ${clean(body.apartment, 100)}, address_details = ${clean(body.address_details, 500)},
        email = ${clean(body.email, 200)}, phone = ${clean(body.phone, 60)},
        website = ${clean(body.website, 300)}, sms_phone = ${clean(body.sms_phone, 60)},
        delivery_method = ${clean(body.delivery_method, 200)},
        credit_days = ${Number(body.credit_days) || 0},
        max_credit_days = ${body.max_credit_days ? Number(body.max_credit_days) : null},
        credit_limit = ${Number(body.credit_limit) || 0},
        payment_method = ${clean(body.payment_method, 200)},
        has_credit = ${body.has_credit === true}, blocked_billing = ${body.blocked_billing === true},
        discount_class_id = ${body.discount_class_id || null},
        is_active = ${body.is_active !== false},
        updated_at = now()
      WHERE id = ${id}::uuid
    `;

    // Replace banks
    if (Array.isArray(body.banks)) {
      await sql`DELETE FROM partner_bank WHERE partner_id = ${id}::uuid`;
      for (const b of body.banks) {
        if (!b.bank_name || !b.iban) continue;
        await sql`
          INSERT INTO partner_bank (partner_id, bank_name, branch, swift_code, iban, currency, is_default)
          VALUES (${id}, ${clean(b.bank_name, 200)}, ${clean(b.branch, 200)},
                  ${clean(b.swift_code, 20)}, ${clean(b.iban, 60)}, ${clean(b.currency, 10) || 'LEI'},
                  ${b.is_default === true})
        `;
      }
    }

    // Replace contacts
    if (Array.isArray(body.contacts)) {
      await sql`DELETE FROM partner_contact WHERE partner_id = ${id}::uuid`;
      for (const c of body.contacts) {
        if (!c.last_name || !c.first_name) continue;
        await sql`
          INSERT INTO partner_contact (partner_id, title, last_name, first_name, role, phone, email, is_primary)
          VALUES (${id}, ${clean(c.title, 50)}, ${clean(c.last_name, 100)},
                  ${clean(c.first_name, 100)}, ${clean(c.role, 100)}, ${clean(c.phone, 60)},
                  ${clean(c.email, 200)}, ${c.is_primary === true})
        `;
      }
    }

    return json({ ok: true });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    await requireStaff(req);
    const { id } = await ctx.params;
    await sql`DELETE FROM partner WHERE id = ${id}::uuid`;
    return json({ ok: true });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}
