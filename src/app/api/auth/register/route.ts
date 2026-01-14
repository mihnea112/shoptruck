// src/app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import argon2 from "argon2";
import { sql } from "@/lib/db";
import { newSessionToken, hashToken } from "@/lib/auth/crypto";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function sameOriginCheck(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;

  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(v: unknown, max = 2000) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function okPassword(pw: string) {
  return pw.length >= 8 && pw.length <= 500;
}

type RegisterBody =
  | {
      kind: "individual";
      email: string;
      password: string;
      mode?: "cookie" | "token" | "both";
      firstName: string;
      lastName: string;
      phone?: string;
    }
  | {
      kind: "company";
      email: string;
      password: string;
      mode?: "cookie" | "token" | "both";
      companyName: string;
      vatId?: string;
      regNo?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
    };

type UserRow = {
  id: string;
  email: string;
  kind: "staff" | "customer";
  roles: string[] | null;
};

function computeRedirect(userKind: string, roles: string[] | null) {
  const r = roles ?? [];
  const isStaff = userKind === "staff";
  const isAdminOrSales = r.includes("ADMIN") || r.includes("SALES_REP");
  if (isStaff && isAdminOrSales) return "/admin";
  return "/";
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      415
    );
  }

  const body = (await req.json().catch(() => null)) as RegisterBody | null;

  const modeRaw = String((body as any)?.mode ?? "cookie");
  const mode = modeRaw === "token" || modeRaw === "both" ? modeRaw : "cookie";

  if ((mode === "cookie" || mode === "both") && !sameOriginCheck(req)) {
    return json({ ok: false, error: "Cerere respinsă (origine invalidă)." }, 403);
  }

  const kind = String((body as any)?.kind ?? "");
  const email = normalizeEmail((body as any)?.email);
  const password = String((body as any)?.password ?? "");

  if (!email || !password || !isValidEmail(email) || !okPassword(password)) {
    return json({ ok: false, error: "Date invalide. Verifică email/parolă." }, 400);
  }

  if (kind !== "individual" && kind !== "company") {
    return json({ ok: false, error: "Tip cont invalid." }, 400);
  }

  // Optional cleanup
  // If you haven't created session table yet, remove this line.
  await sql`DELETE FROM session WHERE expires_at < now()`;

  // Ensure email not already used
  const existing = await sql`
    SELECT 1
    FROM app_user
    WHERE lower(email) = ${email}
    LIMIT 1
  `;
  if (Array.isArray(existing) && existing.length > 0) {
    return json({ ok: false, error: "Există deja un cont cu acest email." }, 409);
  }

  // Build account payload
  let accountKind: "INDIVIDUAL" | "COMPANY";
  let displayName: string | null = null;
  let legalName: string | null = null;
  let phone: string | null = null;
  let taxId: string | null = null;
  let regNo: string | null = null;
  let notes: string | null = null;

  let accountEmail = email;

  if (kind === "individual") {
    const firstName = cleanText((body as any)?.firstName, 120);
    const lastName = cleanText((body as any)?.lastName, 120);
    phone = cleanText((body as any)?.phone, 50);

    if (!firstName || !lastName) {
      return json({ ok: false, error: "Completează numele și prenumele." }, 400);
    }

    accountKind = "INDIVIDUAL";
    displayName = `${lastName} ${firstName}`.trim();
    legalName = null;
    notes = null;
  } else {
    const companyName = cleanText((body as any)?.companyName, 200);
    if (!companyName) return json({ ok: false, error: "Completează numele firmei." }, 400);

    accountKind = "COMPANY";
    displayName = companyName;
    legalName = companyName;

    taxId = cleanText((body as any)?.vatId, 50);
    regNo = cleanText((body as any)?.regNo, 80);

    const contactName = cleanText((body as any)?.contactName, 200);
    const contactPhone = cleanText((body as any)?.contactPhone, 50);
    const contactEmailRaw = normalizeEmail((body as any)?.contactEmail);
    const contactEmailOk = contactEmailRaw ? isValidEmail(contactEmailRaw) : false;

    notes =
      [contactName ? `Contact: ${contactName}` : null, contactPhone ? `Tel: ${contactPhone}` : null]
        .filter(Boolean)
        .join(" · ") || null;

    phone = contactPhone ?? null;
    accountEmail = contactEmailOk ? contactEmailRaw : email;
  }

  try {
    const passwordHash = await argon2.hash(password);

    const token = newSessionToken();
    const tokenHash = hashToken(token);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    const rows = await sql`
      WITH a AS (
        INSERT INTO account (
          kind, display_name, legal_name, email, phone,
          tax_id, reg_no, notes
        )
        VALUES (
          ${accountKind},
          ${displayName},
          ${legalName},
          ${accountEmail},
          ${phone},
          ${taxId},
          ${regNo},
          ${notes}
        )
        RETURNING id
      ),
      u AS (
        INSERT INTO app_user (
          email, password_hash, kind, is_active, account_id
        )
        VALUES (
          ${email},
          ${passwordHash},
          'customer',
          true,
          (SELECT id FROM a)
        )
        RETURNING id
      ),
      s AS (
        INSERT INTO session (user_id, token_hash, expires_at)
        VALUES ((SELECT id FROM u), ${tokenHash}, ${expires.toISOString()})
        RETURNING id
      )
      SELECT (SELECT id FROM u) AS user_id
    `;

    const userId = (rows as any[])?.[0]?.user_id as string | undefined;
    if (!userId) return json({ ok: false, error: "Eroare internă." }, 500);

    // Load kind + roles (roles likely empty for customers)
    const uinfo = (await sql`
      SELECT
        u.id,
        u.email,
        u.kind,
        COALESCE(array_agg(r.key) FILTER (WHERE r.key IS NOT NULL), '{}') AS roles
      FROM app_user u
      LEFT JOIN user_role ur ON ur.user_id = u.id
      LEFT JOIN role r ON r.id = ur.role_id
      WHERE u.id = ${userId}::uuid
      GROUP BY u.id
      LIMIT 1
    `) as UserRow[];

    const user = uinfo?.[0];
    const roles = user?.roles ?? [];
    const redirectTo = computeRedirect(user?.kind ?? "customer", roles);

    if (mode === "cookie" || mode === "both") {
      const c = await cookies();
      c.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires,
      });
    }

    const userSafe = user
      ? { id: user.id, email: user.email, kind: user.kind, roles }
      : { id: userId, email, kind: "customer" as const, roles: [] };

    if (mode === "token") {
      return json({
        ok: true,
        token,
        expiresAt: expires.toISOString(),
        redirectTo,
        user: userSafe,
      });
    }

    return json({
      ok: true,
      redirectTo,
      user: userSafe,
      ...(mode === "both" ? { token, expiresAt: expires.toISOString() } : {}),
    });
  } catch (e: any) {
    const msg =
      e?.code === "23505"
        ? "Date duplicate (email/CUI). Verifică și încearcă din nou."
        : "Eroare internă.";
    return json({ ok: false, error: msg }, 500);
  }
}