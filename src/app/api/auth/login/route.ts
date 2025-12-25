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
  roles: string[] | null;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeEmail(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
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
  const modeRaw = String(body?.mode ?? "cookie"); // cookie | token | both
  const mode = modeRaw === "token" || modeRaw === "both" ? modeRaw : "cookie";

  // IMPORTANT:
  // - cookie/both must pass same-origin in production (avoid CSRF cookie-setting)
  if ((mode === "cookie" || mode === "both") && !sameOriginCheck(req)) {
    return json(
      { ok: false, error: "Cerere respinsă (origine invalidă)." },
      403
    );
  }

  if (!email || !password || !isValidEmail(email) || password.length > 500) {
    // do not leak which field was wrong
    return json({ ok: false, error: "Email sau parolă incorecte." }, 401);
  }

  // cleanup (cheap, keeps session table healthy)
  await sql`DELETE FROM session WHERE expires_at < now()`;

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

  // Verify password
  const okPw = await argon2.verify(user.password_hash, password);
  if (!okPw) {
    return json({ ok: false, error: "Email sau parolă incorecte." }, 401);
  }

  // Create session (single source of truth for web + mobile)
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

  // Optional: rotate sessions => keep 1 active session/user
  // If you want that behavior, uncomment next line:
  // await sql`DELETE FROM session WHERE user_id = ${user.id}`;

  await sql`
    INSERT INTO session (user_id, token_hash, expires_at)
    VALUES (${user.id}, ${tokenHash}, ${expires.toISOString()})
  `;

  // Cookie for web
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

  // Role-based redirect
  const roles = user.roles ?? [];
  let redirectTo = "/";

  if (user.kind === "staff") {
    redirectTo =
      roles.includes("ADMIN") || roles.includes("SALES_REP") ? "/admin" : "/";
  } else {
    redirectTo = "/account";
  }

  const userSafe = { id: user.id, email: user.email, kind: user.kind, roles };

  // Mobile mode returns token
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
