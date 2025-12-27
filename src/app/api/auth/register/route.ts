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

  // 1. Validări Generale
  if (!kind || (kind !== "individual" && kind !== "company")) {
    return NextResponse.json({ ok: false, error: "Tip client invalid." }, { status: 400 });
  }
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Email sau parolă invalidă (minim 8 caractere)." },
      { status: 400 }
    );
  }

  // 2. Extragere Câmpuri Specifice
  const firstName = body?.firstName?.toString()?.trim();
  const lastName = body?.lastName?.toString()?.trim();
  const phone = body?.phone?.toString()?.trim() || null;

  const companyName = body?.companyName?.toString()?.trim();
  const vatId = body?.vatId?.toString()?.trim() || null;
  const regNo = body?.regNo?.toString()?.trim() || null;
  const contactName = body?.contactName?.toString()?.trim() || null;
  const contactPhone = body?.contactPhone?.toString()?.trim() || null;
  const contactEmail = (body?.contactEmail?.toString()?.trim() || email) as string;

  // 3. Validări Specifice
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

  // 4. Verificare Email Existent
  const existing = await sql`
    SELECT 1 FROM app_user WHERE email = ${email} LIMIT 1
  `;
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "Există deja un cont cu acest email." },
      { status: 409 }
    );
  }

  try {
    const passwordHash = await argon2.hash(password);

    // 5. Creare Utilizator (app_user)
    const userRows = await sql`
      INSERT INTO app_user (email, password_hash, kind, is_active, created_at, updated_at)
      VALUES (${email}, ${passwordHash}, 'customer', true, NOW(), NOW())
      RETURNING id
    `;
    
    const userId = userRows[0]?.id;
    if (!userId) {
      throw new Error("Eroare internă: ID utilizator lipsă.");
    }

    // 6. Asignare Rol (Dacă ai tabel user_role)
    // Dacă primești eroare aici, asigură-te că există rolul 'CUSTOMER' în tabelul 'role'
    await sql`
      INSERT INTO user_role (user_id, role_id)
      SELECT ${userId}, id FROM role WHERE key = 'CUSTOMER'
      ON CONFLICT DO NOTHING
    `;

    // 7. Logica Client (Adoptare vs Creare)
    let customerLinked = false;

    // A. Căutăm "Client Orfan" (doar PF și dacă avem telefon)
    if (kind === "individual" && phone) {
      const orphans = await sql`
        SELECT c.id
        FROM customer c
        JOIN customer_individual ci ON c.id = ci.customer_id
        WHERE ci.phone = ${phone}
          AND c.user_id IS NULL       -- Nu aparține altcuiva
          AND c.kind = 'individual'
        LIMIT 1
      `;

      if (orphans.length > 0) {
        const customerId = orphans[0].id;
        
        // A1. Link User to Customer (CORECTAT: fără updated_at)
        await sql`
          UPDATE customer 
          SET user_id = ${userId}
          WHERE id = ${customerId}
        `;

        // A2. Actualizăm Numele (Userul suprascrie numele introdus de mecanic), Păstrăm Telefonul
        await sql`
          UPDATE customer_individual
          SET first_name = ${firstName}, last_name = ${lastName}
          WHERE customer_id = ${customerId}
        `;

        customerLinked = true;
      }
    }

    // B. Dacă nu am găsit orfan, Creăm Client Nou
    if (!customerLinked) {
      const custRes = await sql`
        INSERT INTO customer (kind, user_id, created_at)
        VALUES (${kind}::customer_kind, ${userId}, NOW())
        RETURNING id
      `;
      const customerId = custRes[0].id;

      if (kind === "individual") {
        await sql`
          INSERT INTO customer_individual (customer_id, first_name, last_name, phone)
          VALUES (${customerId}, ${firstName}, ${lastName}, ${phone})
        `;
      } else {
        await sql`
          INSERT INTO customer_company (
            customer_id, company_name, vat_id, reg_no,
            contact_name, contact_phone, contact_email
          )
          VALUES (
            ${customerId}, ${companyName}, ${vatId}, ${regNo},
            ${contactName}, ${contactPhone}, ${contactEmail}
          )
        `;
      }
    }

    // 8. Creare Sesiune
    const token = newSessionToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 zile

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

  } catch (err: any) {
    console.error("Register API Error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Eroare la server." }, { status: 500 });
  }
}