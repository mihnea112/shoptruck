// src/app/api/auth/login/route.ts
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
  account_id: string | null;
  roles: string[]; // aggregated from role.key
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeMode(v: unknown): "cookie" | "token" | "both" {
  const m = String(v ?? "cookie").toLowerCase();
  if (m === "token" || m === "both") return m;
  return "cookie";
}

/**
 * CSRF hardening for cookie-setting requests.
 * - In production, require same-origin for mode cookie/both.
 * - Use Origin when available; fall back to Referer.
 */
function sameOriginCheck(req: Request) {
  if (process.env.NODE_ENV !== "production") return true;

  const host = req.headers.get("host");
  if (!host) return false;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const candidate = origin || referer;
  if (!candidate) return false;

  try {
    const u = new URL(candidate);
    return u.host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // Require JSON
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return json(
      { ok: false, error: "Content-Type invalid. Folosește application/json." },
      415
    );
  }

  const body = await req.json().catch(() => null);

  const email = normalizeEmail(body?.email);
  const password = String(body?.password ?? "");
  const mode = normalizeMode(body?.mode);

  // Cookie-setting requests must be same-origin (production)
  if ((mode === "cookie" || mode === "both") && !sameOriginCheck(req)) {
    return json({ ok: false, error: "Cerere respinsă (origine invalidă)." }, 403);
  }

  // Don’t leak details
  if (!email || !password || !isValidEmail(email) || password.length > 500) {
    return json({ ok: false, error: "Email sau parolă incorecte." }, 401);
  }

  // Cleanup expired sessions
  await sql`DELETE FROM session WHERE expires_at < now()`;

  const rows = (await sql`
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.kind,
      u.is_active,
      u.account_id,
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

  // Create session
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

  // Optional: keep only 1 active session/user
  // await sql`DELETE FROM session WHERE user_id = ${user.id}::uuid`;

  await sql`
    INSERT INTO session (user_id, token_hash, expires_at)
    VALUES (${user.id}::uuid, ${tokenHash}, ${expires.toISOString()})
  `;

  // Set cookie for web
  if (mode === "cookie" || mode === "both") {
    const c = await cookies(); // IMPORTANT: no await
    c.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });
  }

  const roles = Array.isArray(user.roles) ? user.roles : [];

  // Redirect logic:
  // - staff with ADMIN or SALES_REP => /admin
  // - everyone else => /
  let redirectTo = "/";
  if (user.kind === "staff") {
    redirectTo = roles.includes("ADMIN") || roles.includes("SALES_REP") ? "/admin" : "/";
  } else {
    redirectTo = "/";
  }

  const userSafe = {
    id: user.id,
    email: user.email,
    kind: user.kind,
    roles,
    account_id: user.account_id,
  };

  // Token-only for mobile
  if (mode === "token") {
    return json({
      ok: true,
      token,
      expiresAt: expires.toISOString(),
      user: userSafe,
      redirectTo,
    });
  }

  // Web (or both)
  return json({
    ok: true,
    redirectTo,
    user: userSafe,
    ...(mode === "both" ? { token, expiresAt: expires.toISOString() } : {}),
  });
}