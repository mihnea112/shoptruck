import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff(req, ["admin"]);

    const { id } = await params;
    const contactId = id;
    if (!isValidUUID(contactId)) {
      return json({ ok: false, error: "ID invalid." }, 400);
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ ok: false, error: "Content-Type trebuie să fie application/json." }, 415);
    }

    const body = await req.json();
    const { first_name, last_name, tags } = body;

    const firstName = first_name !== undefined ? (String(first_name || "").trim() || null) : undefined;
    const lastName = last_name !== undefined ? (String(last_name || "").trim() || null) : undefined;
    const tagsArray = tags !== undefined
      ? Array.isArray(tags)
        ? tags.map((t: any) => String(t).trim().toLowerCase()).filter((t: string) => t)
        : undefined
      : undefined;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [contactId];

    if (firstName !== undefined) {
      updates.push(`first_name = $${updates.length + 2}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${updates.length + 2}`);
      values.push(lastName);
    }
    if (tagsArray !== undefined) {
      updates.push(`tags = $${updates.length + 2}::text[]`);
      values.push(tagsArray);
    }

    if (updates.length === 0) {
      return json({ ok: false, error: "Nici un câmp de actualizat." }, 400);
    }

    // Update contact
    const result = await sql`
      UPDATE email_contact
      SET ${updates.length > 0 ? sql(updates.join(", ")) : sql``}, updated_at = NOW()
      WHERE id = ${contactId}
      RETURNING id, email, first_name, last_name, tags, is_unsubscribed, created_at
    `;

    if (result.length === 0) {
      return json({ ok: false, error: "Contact nu găsit." }, 404);
    }

    const contact = result[0];
    return json({
      ok: true,
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
    console.error("[API contacts PATCH]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff(req, ["admin"]);

    const { id } = await params;
    const contactId = id;
    if (!isValidUUID(contactId)) {
      return json({ ok: false, error: "ID invalid." }, 400);
    }

    // Soft delete: mark as unsubscribed
    const result = await sql`
      UPDATE email_contact
      SET is_unsubscribed = true, unsubscribed_at = NOW(), updated_at = NOW()
      WHERE id = ${contactId}
      RETURNING id
    `;

    if (result.length === 0) {
      return json({ ok: false, error: "Contact nu găsit." }, 404);
    }

    return json({ ok: true, id: contactId });
  } catch (e: any) {
    console.error("[API contacts DELETE]", e);
    return json({ ok: false, error: e?.message || "Eroare internă." }, 500);
  }
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
