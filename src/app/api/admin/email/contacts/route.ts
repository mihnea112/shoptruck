import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

type EmailContact = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  tags: string[];
  is_unsubscribed: boolean;
  created_at: string;
};

export async function GET(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const tags = (searchParams.get("tags") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    let query = `
      SELECT id, email, first_name, last_name, tags, is_unsubscribed, created_at
      FROM email_contact
      WHERE 1=1
    `;
    const params: any[] = [];

    // Search by email or name
    if (q && q.length >= 2) {
      query += ` AND (email ILIKE $${params.length + 1} OR first_name ILIKE $${params.length + 1} OR last_name ILIKE $${params.length + 1})`;
      params.push(`%${q}%`);
    }

    // Filter by tag
    if (tags) {
      query += ` AND tags @> $${params.length + 1}::text[]`;
      params.push(`{${tags}}`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await sql`
      SELECT id, email, first_name, last_name, tags, is_unsubscribed, created_at
      FROM email_contact
      WHERE 1=1
      ${q && q.length >= 2 ? sql`AND (email ILIKE ${`%${q}%`} OR first_name ILIKE ${`%${q}%`} OR last_name ILIKE ${`%${q}%`})` : sql``}
      ${tags ? sql`AND tags @> ${[tags]}::text[]` : sql``}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM email_contact
      WHERE 1=1
      ${q && q.length >= 2 ? sql`AND (email ILIKE ${`%${q}%`} OR first_name ILIKE ${`%${q}%`} OR last_name ILIKE ${`%${q}%`})` : sql``}
      ${tags ? sql`AND tags @> ${[tags]}::text[]` : sql``}
    `;

    const total = countResult.length > 0 ? Number(countResult[0].total) : 0;

    const contacts: EmailContact[] = rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      tags: row.tags || [],
      is_unsubscribed: row.is_unsubscribed,
      created_at: row.created_at,
    }));

    return json({ ok: true, items: contacts, total, limit, offset });
  } catch (e: any) {
    console.error("[API contacts GET]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

export async function POST(req: Request) {
  try {
    await requireStaff(req, ["admin"]);

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { email, first_name, last_name, tags } = body;

    // Validate email
    const emailStr = (email || "").trim().toLowerCase();
    if (!emailStr || !isValidEmail(emailStr)) {
      return json({ ok: false, error: "Email nevalid." }, 400);
    }

    const firstName = (first_name || "").trim() || null;
    const lastName = (last_name || "").trim() || null;
    const tagsArray = Array.isArray(tags)
      ? tags.map((t: any) => String(t).trim().toLowerCase()).filter((t: string) => t)
      : [];

    // Insert contact
    const result = await sql`
      INSERT INTO email_contact (email, first_name, last_name, tags)
      VALUES (${emailStr}, ${firstName}, ${lastName}, ${tagsArray}::text[])
      RETURNING id, email, first_name, last_name, tags, is_unsubscribed, created_at
    `;

    if (result.length === 0) {
      return json({ ok: false, error: "Eroare la crearea contactului." }, 500);
    }

    const contact = result[0];
    return json({
      ok: true,
      id: contact.id,
      contact: {
        id: contact.id,
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        tags: contact.tags || [],
        is_unsubscribed: contact.is_unsubscribed,
        created_at: contact.created_at,
      },
    });
  } catch (e: any) {
    console.error("[API contacts POST]", e);
    // Check for unique constraint violation
    if (e?.code === "23505") {
      return json({ ok: false, error: "Email deja există în bază." }, 409);
    }
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
