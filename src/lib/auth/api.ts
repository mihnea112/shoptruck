import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { hashToken } from "@/lib/auth/crypto";

export type SessionUser = {
  id: string;
  email: string;
  kind: string;        // "staff" | "customer" etc
  roles: string[];     // ["ADMIN", "SALES_REP", ...]
};

async function loadUserBySessionToken(token: string): Promise<SessionUser | null> {
  const tokenHash = hashToken(token);

  const rows = await sql`
    SELECT
      u.id,
      u.email,
      u.kind,
      COALESCE(array_agg(r.key) FILTER (WHERE r.key IS NOT NULL), '{}'::text[]) AS roles
    FROM session s
    JOIN app_user u ON u.id = s.user_id
    LEFT JOIN user_role ur ON ur.user_id = u.id
    LEFT JOIN role r ON r.id = ur.role_id
    WHERE s.token_hash = ${tokenHash}
      AND s.revoked_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND u.is_active = true
    GROUP BY u.id
    LIMIT 1
  `;

  const u = (rows as any[])?.[0];
  if (!u) return null;

  return {
    id: String(u.id),
    email: String(u.email),
    kind: String(u.kind),
    roles: Array.isArray(u.roles) ? u.roles.map(String) : [],
  };
}

export async function getApiUser(req: Request): Promise<SessionUser | null> {
  // 1) Bearer token (mobile)
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (!token) return null;
    return loadUserBySessionToken(token);
  }

  // 2) Cookie session (web)
  const c = await cookies();
  const token = c.get("session")?.value;
  if (!token) return null;
  return loadUserBySessionToken(token);
}

export async function requireAdmin(req: Request): Promise<SessionUser> {
  const me = await getApiUser(req);
  if (!me) {
    const err: any = new Error("Neautorizat.");
    err.status = 401;
    throw err;
  }
  if (me.kind !== "staff" || !me.roles.includes("ADMIN")) {
    const err: any = new Error("Acces interzis.");
    err.status = 403;
    throw err;
  }
  return me;
}