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

export async function GET(req: Request) {
  try {
    await requireStaff(req);
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const type = searchParams.get("type"); // CLIENT, SUPPLIER, BOTH
    const limitRaw = Number(searchParams.get("limit") || 50);
    const limit = Math.min(Math.max(limitRaw, 1), 200);
    const offset = Number(searchParams.get("offset") || 0);

    let rows;
    if (q.length >= 2) {
      const term = `%${q}%`;
      if (type && ["CLIENT", "SUPPLIER", "BOTH"].includes(type)) {
        rows = await sql`
          SELECT p.*, dc.name as discount_class_name, dc.discount_pct
          FROM partner p
          LEFT JOIN discount_class dc ON dc.id = p.discount_class_id
          WHERE (p.partner_type = ${type} OR p.partner_type = 'BOTH')
            AND (
              p.display_name ILIKE ${term}
              OR p.legal_name ILIKE ${term}
              OR p.tax_id ILIKE ${term}
              OR p.reg_no ILIKE ${term}
              OR p.code ILIKE ${term}
              OR p.email ILIKE ${term}
            )
          ORDER BY p.display_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        rows = await sql`
          SELECT p.*, dc.name as discount_class_name, dc.discount_pct
          FROM partner p
          LEFT JOIN discount_class dc ON dc.id = p.discount_class_id
          WHERE p.display_name ILIKE ${term}
            OR p.legal_name ILIKE ${term}
            OR p.tax_id ILIKE ${term}
            OR p.reg_no ILIKE ${term}
            OR p.code ILIKE ${term}
            OR p.email ILIKE ${term}
          ORDER BY p.display_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    } else {
      if (type && ["CLIENT", "SUPPLIER", "BOTH"].includes(type)) {
        rows = await sql`
          SELECT p.*, dc.name as discount_class_name, dc.discount_pct
          FROM partner p
          LEFT JOIN discount_class dc ON dc.id = p.discount_class_id
          WHERE p.partner_type = ${type} OR p.partner_type = 'BOTH'
          ORDER BY p.display_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        rows = await sql`
          SELECT p.*, dc.name as discount_class_name, dc.discount_pct
          FROM partner p
          LEFT JOIN discount_class dc ON dc.id = p.discount_class_id
          ORDER BY p.display_name
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    }

    return json({ ok: true, items: rows });
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff(req);
    const body = await req.json().catch(() => null);
    if (!body) return json({ ok: false, error: "Body invalid." }, 400);

    const displayName = clean(body.display_name, 300);
    if (!displayName) return json({ ok: false, error: "Numele partenerului este obligatoriu." }, 400);

    const partnerType = ["CLIENT", "SUPPLIER", "BOTH"].includes(body.partner_type)
      ? body.partner_type : "CLIENT";
    const kind = ["COMPANY", "INDIVIDUAL", "PFA"].includes(body.kind) ? body.kind : "COMPANY";

    const rows = await sql`
      INSERT INTO partner (
        partner_type, kind, code, display_name, legal_name,
        tax_id, reg_no, is_vat_payer, vat_since, vat_on_receipt, split_vat, agri_reg,
        agent_name,
        country, county, city, zone, postal_code,
        street_type, street_name, street_number, block, staircase, floor, apartment, address_details,
        email, phone, website, sms_phone,
        delivery_method,
        credit_days, max_credit_days, credit_limit, payment_method, has_credit, blocked_billing,
        discount_class_id
      ) VALUES (
        ${partnerType}, ${kind}, ${clean(body.code, 20)}, ${displayName}, ${clean(body.legal_name, 300)},
        ${clean(body.tax_id, 60)}, ${clean(body.reg_no, 80)},
        ${body.is_vat_payer === true}, ${body.vat_since || null}, ${body.vat_on_receipt === true},
        ${body.split_vat === true}, ${clean(body.agri_reg, 100)},
        ${clean(body.agent_name, 200)},
        ${clean(body.country, 100) || 'Romania'}, ${clean(body.county, 100)}, ${clean(body.city, 100)},
        ${clean(body.zone, 200)}, ${clean(body.postal_code, 20)},
        ${clean(body.street_type, 50) || 'Strada'}, ${clean(body.street_name, 200)},
        ${clean(body.street_number, 20)}, ${clean(body.block, 20)}, ${clean(body.staircase, 20)},
        ${clean(body.floor, 20)}, ${clean(body.apartment, 100)}, ${clean(body.address_details, 500)},
        ${clean(body.email, 200)}, ${clean(body.phone, 60)}, ${clean(body.website, 300)},
        ${clean(body.sms_phone, 60)},
        ${clean(body.delivery_method, 200)},
        ${Number(body.credit_days) || 0}, ${body.max_credit_days ? Number(body.max_credit_days) : null},
        ${Number(body.credit_limit) || 0}, ${clean(body.payment_method, 200)},
        ${body.has_credit === true}, ${body.blocked_billing === true},
        ${body.discount_class_id || null}
      )
      RETURNING id
    `;

    const partnerId = (rows as any[])[0]?.id;

    // Insert bank accounts
    if (Array.isArray(body.banks)) {
      for (const b of body.banks) {
        if (!b.bank_name || !b.iban) continue;
        await sql`
          INSERT INTO partner_bank (partner_id, bank_name, branch, swift_code, iban, currency, is_default)
          VALUES (${partnerId}, ${clean(b.bank_name, 200)}, ${clean(b.branch, 200)},
                  ${clean(b.swift_code, 20)}, ${clean(b.iban, 60)}, ${clean(b.currency, 10) || 'LEI'},
                  ${b.is_default === true})
        `;
      }
    }

    // Insert contacts
    if (Array.isArray(body.contacts)) {
      for (const c of body.contacts) {
        if (!c.last_name || !c.first_name) continue;
        await sql`
          INSERT INTO partner_contact (partner_id, title, last_name, first_name, role, phone, email, is_primary)
          VALUES (${partnerId}, ${clean(c.title, 50)}, ${clean(c.last_name, 100)},
                  ${clean(c.first_name, 100)}, ${clean(c.role, 100)}, ${clean(c.phone, 60)},
                  ${clean(c.email, 200)}, ${c.is_primary === true})
        `;
      }
    }

    return json({ ok: true, id: partnerId }, 201);
  } catch (e: any) {
    const status = e instanceof ApiError ? e.status : 500;
    return json({ ok: false, error: e?.message || "Eroare internă." }, status);
  }
}
