import "server-only";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { hashToken } from "./crypto";

export type SessionUser = {
  userId: string;
  email: string;
  kind: "staff" | "customer";
  roles: string[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get("session")?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);

  type SessionRow = {
    user_id: string;
    email: string;
    kind: "staff" | "customer";
    roles: string[] | null;
  };

  const rows = (await sql`
    SELECT
      u.id as user_id,
      u.email as email,
      u.kind as kind,
      COALESCE(array_agg(r.key) FILTER (WHERE r.key IS NOT NULL), '{}') as roles
    FROM session s
    JOIN app_user u ON u.id = s.user_id
    LEFT JOIN user_role ur ON ur.user_id = u.id
    LEFT JOIN role r ON r.id = ur.role_id
    WHERE s.token_hash = ${tokenHash}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.is_active = true
    GROUP BY u.id, u.email, u.kind
    LIMIT 1
  `) as SessionRow[];

  if (!rows.length) return null;

  return {
    userId: rows[0].user_id,
    email: rows[0].email,
    kind: rows[0].kind,
    roles: rows[0].roles ?? [],
  };
}

export function hasAnyRole(user: SessionUser, roles: string[]) {
  return roles.some((r) => user.roles.includes(r));
}