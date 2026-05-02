import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireCustomer } from "@/lib/auth/api";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function PUT(req: Request) {
  try {
    const user = await requireCustomer(req);

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Cerere invalidă" }, 400);

    const { firstName, lastName, email, phone, address, city, postalCode, country } = body;

    await sql`
      INSERT INTO user_profile (user_id, first_name, last_name, email, phone, address, city, postal_code, country)
      VALUES (${user.userId}::uuid, ${firstName || null}, ${lastName || null}, ${email || null}, ${phone || null}, ${address || null}, ${city || null}, ${postalCode || null}, ${country || null})
      ON CONFLICT (user_id)
      DO UPDATE SET
        first_name = ${firstName || null},
        last_name = ${lastName || null},
        email = ${email || null},
        phone = ${phone || null},
        address = ${address || null},
        city = ${city || null},
        postal_code = ${postalCode || null},
        country = ${country || null},
        updated_at = now()
    `;

    return json({ ok: true, message: "Profil actualizat cu succes" }, 200);
  } catch (e: any) {
    console.error("[API user profile PUT]", e);
    return json({ error: e?.message || "Eroare la salvare" }, e?.status ?? 500);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireCustomer(req);

    const rows = await sql`
      SELECT first_name, last_name, email, phone, address, city, postal_code, country
      FROM user_profile
      WHERE user_id = ${user.userId}::uuid
      LIMIT 1
    `;

    const profile = (rows as any[])[0] || {
      first_name: null,
      last_name: null,
      email: user.email,
      phone: null,
      address: null,
      city: null,
      postal_code: null,
      country: "România",
    };

    return json({
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      city: profile.city,
      postalCode: profile.postal_code,
      country: profile.country,
    });
  } catch (e: any) {
    console.error("[API user profile GET]", e);
    return json({ error: e?.message || "Eroare la citire" }, e?.status ?? 500);
  }
}
