import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import argon2 from "argon2";
import { sql } from "@/lib/db";
import { newSessionToken, hashToken } from "@/lib/auth/crypto";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  kind: "staff" | "customer";
  is_active: boolean;
  roles: string[] | null;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const email = normalizeEmail(body?.email);
  const password = String(body?.password ?? "");
  const mode = String(body?.mode ?? "cookie"); // "cookie" | "token" | "both"

  // mode behavior:
  // - cookie: set httpOnly cookie (browser)
  // - token: return token in JSON (mobile)
  // - both: do both (useful for debugging)

  if (!email || !password) {
    return json({ ok: false, error: "Lipsesc credențialele." }, 400);
  }

  const rows = (await sql`
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.kind,
      u.is_active,
      COALESCE(array_agg(r.key) FILTER (WHERE r.key IS NOT NULL), '{}') AS roles
    FROM app_user u
    LEFT JOIN user_role ur ON ur.user_id = u.id
    LEFT JOIN role r ON r.id = ur.role_id
    WHERE lower(u.email) = ${email}
    GROUP BY u.id
    LIMIT 1
  `) as UserRow[];

  const user = rows[0];
  if (!user || !user.is_active) {
    return json({ ok: false, error: "Email sau parolă incorecte." }, 401);
  }

  const okPw = await argon2.verify(user.password_hash, password);
  if (!okPw) {
    return json({ ok: false, error: "Email sau parolă incorecte." }, 401);
  }

  // create session (single source of truth for web + mobile)
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

  await sql`
    INSERT INTO session (user_id, token_hash, expires_at)
    VALUES (${user.id}, ${tokenHash}, ${expires.toISOString()})
  `;

  // cookie for web
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

  // role-based redirect (kept)
  const roles = user.roles ?? [];
  let redirectTo = "/";

  if (user.kind === "staff") {
    redirectTo = roles.includes("ADMIN") || roles.includes("SALES_REP") ? "/admin" : "/";
  } else {
    redirectTo = "/account";
  }

  // response for mobile
  if (mode === "token") {
    return json({
      ok: true,
      token, // mobile stores and sends: Authorization: Bearer <token>
      expiresAt: expires.toISOString(),
      user: { id: user.id, email: user.email, kind: user.kind, roles },
      redirectTo, // optional, but useful
    });
  }

  // default web response (unchanged)
  return json({ ok: true, redirectTo, user: { id: user.id, email: user.email, kind: user.kind, roles } });
}