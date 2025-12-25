import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import argon2 from "argon2";
import { sql } from "@/lib/db";
import { newSessionToken, hashToken } from "@/lib/auth/crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const kind = body?.kind as "individual" | "company" | undefined;
  const email = body?.email?.toString()?.trim();
  const password = body?.password?.toString();

  if (!kind || (kind !== "individual" && kind !== "company")) {
    return NextResponse.json({ ok: false, error: "Tip client invalid." }, { status: 400 });
  }
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Email sau parolă invalidă (minim 8 caractere)." },
      { status: 400 }
    );
  }

  // Fields by kind
  const firstName = body?.firstName?.toString()?.trim();
  const lastName = body?.lastName?.toString()?.trim();
  const phone = body?.phone?.toString()?.trim() || null;

  const companyName = body?.companyName?.toString()?.trim();
  const vatId = body?.vatId?.toString()?.trim() || null;
  const regNo = body?.regNo?.toString()?.trim() || null;
  const contactName = body?.contactName?.toString()?.trim() || null;
  const contactPhone = body?.contactPhone?.toString()?.trim() || null;
  const contactEmail = (body?.contactEmail?.toString()?.trim() || email) as string;

  if (kind === "individual" && (!firstName || !lastName)) {
    return NextResponse.json(
      { ok: false, error: "Completează numele și prenumele." },
      { status: 400 }
    );
  }
  if (kind === "company" && !companyName) {
    return NextResponse.json(
      { ok: false, error: "Completează numele firmei." },
      { status: 400 }
    );
  }

  // Check existing email
  const existing = await sql`
    SELECT 1 FROM app_user WHERE email = ${email} LIMIT 1
  `;
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Există deja un cont cu acest email." },
      { status: 409 }
    );
  }

  const passwordHash = await argon2.hash(password);

  // One SQL call using CTEs to keep it consistent (no multi-call transaction needed)
  const rows = await sql`
    WITH new_user AS (
      INSERT INTO app_user (email, password_hash, kind)
      VALUES (${email}, ${passwordHash}, 'customer')
      RETURNING id, email, kind
    ),
    customer_row AS (
      INSERT INTO customer (kind, user_id)
      SELECT ${kind}::customer_kind, id
      FROM new_user
      RETURNING id as customer_id, user_id
    ),
    individual_ins AS (
      INSERT INTO customer_individual (customer_id, first_name, last_name, phone)
      SELECT customer_id, ${firstName}, ${lastName}, ${phone}
      FROM customer_row
      WHERE ${kind} = 'individual'
      RETURNING customer_id
    ),
    company_ins AS (
      INSERT INTO customer_company (
        customer_id, company_name, vat_id, reg_no,
        contact_name, contact_phone, contact_email
      )
      SELECT
        customer_id, ${companyName}, ${vatId}, ${regNo},
        ${contactName}, ${contactPhone}, ${contactEmail}
      FROM customer_row
      WHERE ${kind} = 'company'
      RETURNING customer_id
    ),
    role_link AS (
      INSERT INTO user_role (user_id, role_id)
      SELECT nu.id, r.id
      FROM new_user nu
      JOIN role r ON r.key = 'CUSTOMER'
      ON CONFLICT DO NOTHING
      RETURNING user_id
    )
    SELECT (SELECT id FROM new_user) as user_id
  `;

  const userId = (rows as any[])?.[0]?.user_id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Eroare la creare cont." }, { status: 500 });
  }

  // Create session + cookie (same as login)
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await sql`
    INSERT INTO session (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expires.toISOString()})
  `;

  const c = await cookies();
  c.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  return NextResponse.json({ ok: true, redirectTo: "/account" });
}